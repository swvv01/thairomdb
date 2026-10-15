import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = 'thairomdb';
const FIREBASE_DATABASE_URL = 'https://thairomdb-default-rtdb.asia-southeast1.firebasedatabase.app';
const JWKS_URI = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export interface Env {
  COVERS_BUCKET: R2Bucket;
  PUBLIC_URL_BASE: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // ปรับเป็นโดเมนของแอปจริงเมื่อ deploy production
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Purge-Key',
      'Access-Control-Expose-Headers': 'X-Edge-Cached-At, X-Cache-Status',
    };

    // จัดการ Preflight Request (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Endpoint: ดึงข้อมูลแพตช์พร้อม Cloudflare Edge Cache (รองรับทั้ง GET และ HEAD)
    if (['GET', 'HEAD'].includes(request.method) && url.pathname === '/api/data/patches') {
      const isFresh = url.searchParams.get('fresh') === 'true' || url.searchParams.get('fresh') === '1';
      const purgeKey = request.headers.get('X-Purge-Key');
      const expectedKey = (env as unknown as { PURGE_KEY?: string }).PURGE_KEY || 'thairomdb-cache-key-2026';
      const isAuthorizedBypass = isFresh && purgeKey === expectedKey;

      const cacheUrl = new URL(url.pathname, url.origin);
      const cacheKey = new Request(cacheUrl.toString());
      const cache = caches.default;

      if (!isAuthorizedBypass) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          const headers = new Headers(cachedResponse.headers);
          Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
          headers.set('X-Cache-Status', 'HIT');
          return new Response(request.method === 'HEAD' ? null : cachedResponse.body, {
            status: cachedResponse.status,
            headers
          });
        }
      }

      try {
        const fbRes = await fetch(`${FIREBASE_DATABASE_URL}/patches.json`);
        if (!fbRes.ok) {
          return new Response(JSON.stringify({ error: `Firebase responded with status ${fbRes.status}` }), {
            status: fbRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const data = await fbRes.text();
        const cachedAt = new Date().toISOString();
        const response = new Response(data, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=64800',
            'X-Edge-Cached-At': cachedAt,
            'X-Cache-Status': isAuthorizedBypass ? 'BYPASS' : 'MISS'
          }
        });

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        if (request.method === 'HEAD') {
          return new Response(null, { status: 200, headers: response.headers });
        }
        return response;
      } catch (err) {
        console.error('Fetch from Firebase failed:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch from Firebase RTDB' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Endpoint: เคลียร์ Cloudflare Edge Cache สำหรับ patches (กรณีฉุกเฉินหรือ manual maintenance)
    if (request.method === 'POST' && url.pathname === '/api/clear-cache') {
      const purgeKey = request.headers.get('X-Purge-Key');
      const expectedKey = (env as unknown as { PURGE_KEY?: string }).PURGE_KEY || 'thairomdb-cache-key-2026';
      if (purgeKey !== expectedKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      try {
        const cache = caches.default;
        const cacheUrl = new URL('/api/data/patches', url.origin);
        await cache.delete(new Request(cacheUrl.toString()));
        return new Response(JSON.stringify({ success: true, message: 'Patches cache cleared' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Clear cache failed:', err);
        return new Response(JSON.stringify({ error: 'Failed to clear cache' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ตรวจสอบสิทธิ์ สำหรับ POST (/upload) และ DELETE (/delete)
    if (['POST', 'DELETE'].includes(request.method)) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: No token provided' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const token = authHeader.split('Bearer ')[1];
      try {
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
          audience: FIREBASE_PROJECT_ID,
        });

        if (!payload.sub) {
          throw new Error('Invalid token payload');
        }
      } catch (e) {
        console.error('JWT Verification failed:', e);
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Endpoint: อัปโหลดรูปภาพ
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const patchId = formData.get('patchId') as string | null;

        if (!file) {
          return new Response(JSON.stringify({ error: 'Missing file' }), { status: 400, headers: corsHeaders });
        }

        // จัดการชื่อไฟล์ โดยใช้ patchId หรือ random UUID
        const extension = file.name.split('.').pop() || 'jpg';
        const filename = patchId ? `${patchId}.${extension}` : `${crypto.randomUUID()}.${extension}`;
        const objectName = `covers/${filename}`;

        // บันทึกไฟล์ลง R2 Bucket
        await env.COVERS_BUCKET.put(objectName, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = `${env.PUBLIC_URL_BASE}/${objectName}`;

        return new Response(JSON.stringify({ 
          success: true, 
          url: publicUrl,
          objectName: objectName
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500, headers: corsHeaders });
      }
    }

    // Endpoint: ลบรูปภาพ
    if (request.method === 'DELETE' && url.pathname === '/delete') {
      try {
        const body = (await request.json()) as { url?: string; objectName?: string };
        let objectName = body.objectName;
        
        // หากส่ง url มา ให้สกัด objectName ออกมา (ตัด PUBLIC_URL_BASE ออก)
        if (body.url && env.PUBLIC_URL_BASE) {
          const parsedUrl = new URL(body.url);
          // เอา path ที่ไม่มี / นำหน้ามาใช้เป็น objectName (หรือปรับตาม logic ของ PUBLIC_URL_BASE)
          // เช่น https://pub-xxx.r2.dev/covers/xxx.jpg -> objectName = covers/xxx.jpg
          if (body.url.startsWith(env.PUBLIC_URL_BASE)) {
             objectName = body.url.substring(env.PUBLIC_URL_BASE.length + 1);
          } else {
             // Fallback
             objectName = parsedUrl.pathname.substring(1);
          }
        }

        if (!objectName) {
           return new Response(JSON.stringify({ error: 'Missing objectName or url' }), { status: 400, headers: corsHeaders });
        }

        await env.COVERS_BUCKET.delete(objectName);
        
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: 'Delete failed' }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
