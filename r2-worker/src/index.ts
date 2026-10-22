import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = 'thairomdb';
const FIREBASE_DATABASE_URL = 'https://thairomdb-default-rtdb.asia-southeast1.firebasedatabase.app';
const JWKS_URI = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));
const ALLOWED_COLLECTIONS = new Set(['patches', 'tags', 'systems', 'translators', 'sidebarLinks', 'articles', 'marquees']);

export interface Env {
  COVERS_BUCKET: R2Bucket;
  PUBLIC_URL_BASE: string;
  PURGE_KEY?: string;
  FIREBASE_DB_SECRET?: string;
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

    // Endpoint: ดึงข้อมูลพร้อม R2 Global Cache (รองรับทั้ง GET และ HEAD)
    const dataMatch = url.pathname.match(/^\/api\/data\/([a-zA-Z0-9_-]+)$/);
    if (['GET', 'HEAD'].includes(request.method) && dataMatch) {
      const collection = dataMatch[1];
      if (!ALLOWED_COLLECTIONS.has(collection)) {
        return new Response(JSON.stringify({ error: `Collection '${collection}' not found or not allowed` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isFresh = url.searchParams.get('fresh') === 'true' || url.searchParams.get('fresh') === '1';
      const purgeKey = request.headers.get('X-Purge-Key');
      const expectedKey = (env as unknown as { PURGE_KEY?: string }).PURGE_KEY || 'thairomdb-cache-key-2026';
      const isAuthorizedBypass = isFresh && purgeKey === expectedKey;

      const cacheUrl = new URL(url.pathname, url.origin);
      const cacheKey = new Request(cacheUrl.toString());
      const r2CacheKey = `cache/${collection}.json`;

      // 1. ตรวจสอบ Global Cache ใน R2 (เมื่อไม่ได้ส่งคำสั่ง Bypass)
      if (!isAuthorizedBypass && env.COVERS_BUCKET) {
        if (request.method === 'HEAD') {
          try {
            const r2Head = await env.COVERS_BUCKET.head(r2CacheKey);
            if (r2Head) {
              const cachedAt = r2Head.customMetadata?.['cachedAt'] || r2Head.uploaded.toISOString();
              return new Response(null, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache, must-revalidate',
                  'X-Edge-Cached-At': cachedAt,
                  'X-Cache-Status': 'R2-HIT'
                }
              });
            }
          } catch (r2Err) {
            console.warn(`R2 head check failed for ${collection}:`, r2Err);
          }
        } else {
          try {
            const r2Object = await env.COVERS_BUCKET.get(r2CacheKey);
            if (r2Object) {
              const data = await r2Object.text();
              const cachedAt = r2Object.customMetadata?.['cachedAt'] || r2Object.uploaded.toISOString();
              return new Response(data, {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache, must-revalidate',
                  'X-Edge-Cached-At': cachedAt,
                  'X-Cache-Status': 'R2-HIT'
                }
              });
            }
          } catch (r2Err) {
            console.warn(`R2 cache read failed for ${collection}:`, r2Err);
          }
        }
      }

      // 2. ถ้าไม่มีใน R2 หรือเป็นคำสั่ง Bypass (Admin Force Refresh) -> ดึงจาก Firebase RTDB
      try {
        const dbSecret = env.FIREBASE_DB_SECRET;
        const authParam = dbSecret ? `?auth=${encodeURIComponent(dbSecret)}` : '';
        const fbRes = await fetch(`${FIREBASE_DATABASE_URL}/${collection}.json${authParam}`);
        if (!fbRes.ok) {
          return new Response(JSON.stringify({ error: `Firebase responded with status ${fbRes.status}` }), {
            status: fbRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const data = await fbRes.text();
        const cachedAt = new Date().toISOString();

        // บันทึกเข้า R2 เป็น Global Cache สำหรับทุก POP ทั่วโลก
        if (env.COVERS_BUCKET) {
          await env.COVERS_BUCKET.put(r2CacheKey, data, {
            customMetadata: { cachedAt },
            httpMetadata: { contentType: 'application/json' }
          });
        }

        // ล้าง Local POP Cache ตกค้างถ้ามี
        ctx.waitUntil(caches.default.delete(cacheKey).catch(() => undefined));

        const responseHeaders = {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, must-revalidate',
          'X-Edge-Cached-At': cachedAt,
          'X-Cache-Status': isAuthorizedBypass ? 'BYPASS' : 'MISS'
        };

        if (request.method === 'HEAD') {
          return new Response(null, { status: 200, headers: responseHeaders });
        }
        return new Response(data, { status: 200, headers: responseHeaders });
      } catch (err) {
        console.error(`Fetch from Firebase failed for ${collection}:`, err);
        return new Response(JSON.stringify({ error: `Failed to fetch ${collection} from Firebase RTDB` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Endpoint: เคลียร์ Cloudflare Edge Cache และ R2 Cache (กรณีฉุกเฉินหรือ manual maintenance)
    if (request.method === 'POST' && url.pathname === '/api/clear-cache') {
      const purgeKey = request.headers.get('X-Purge-Key');
      const expectedKey = (env as unknown as { PURGE_KEY?: string }).PURGE_KEY || 'thairomdb-cache-key-2026';
      if (purgeKey !== expectedKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      try {
        let targetCollection = url.searchParams.get('collection');
        if (!targetCollection) {
          try {
            const body = await request.clone().json() as { collection?: string };
            if (body && typeof body.collection === 'string') {
              targetCollection = body.collection;
            }
          } catch {
            // body is optional or not JSON
          }
        }

        const cache = caches.default;
        const collectionsToPurge = targetCollection
          ? [targetCollection]
          : Array.from(ALLOWED_COLLECTIONS);

        await Promise.all(
          collectionsToPurge.flatMap((col) => {
            const cacheUrl = new URL(`/api/data/${col}`, url.origin);
            const ops: Promise<unknown>[] = [cache.delete(new Request(cacheUrl.toString()))];
            if (env.COVERS_BUCKET) {
              ops.push(env.COVERS_BUCKET.delete(`cache/${col}.json`).catch(() => undefined));
            }
            return ops;
          })
        );

        return new Response(JSON.stringify({
          success: true,
          message: targetCollection ? `Cache cleared for ${targetCollection}` : 'All data caches cleared'
        }), {
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
