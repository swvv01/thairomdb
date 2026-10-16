import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { CacheKey, FirestoreCacheService } from './firestore-cache.service';
import { AuthService } from './auth.service';

export interface EdgeFetchResult<T> {
  data: T;
  isSameAsLocal?: boolean;
}

export function toRows(value: unknown): Record<string, unknown>[] {
  return Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>)
    .map(([id, data]) => ({ id, ...(data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) }));
}

@Injectable({ providedIn: 'root' })
export class EdgeDataService {
  private readonly cache = inject(FirestoreCacheService);
  private readonly auth = inject(AuthService, { optional: true });

  async fetchRaw<T>(
    collection: CacheKey,
    isForced?: boolean,
    localSavedAt?: number | null,
    fallback?: () => Promise<T>
  ): Promise<EdgeFetchResult<T>> {
    const isAdmin = typeof this.auth?.isAdmin === 'function' ? this.auth.isAdmin() : false;
    const canBypass = !!isForced && isAdmin;
    const workerUrl = environment.r2?.workerUrl;
    if (workerUrl) {
      try {
        // 1. ถ้าไม่ใช่ Force Reload (หรือไม่มีสิทธิ์ bypass) และมี timestamp แคชในเครื่อง ให้ส่ง HEAD ไปเช็คเวลาก่อน
        if (!canBypass && localSavedAt) {
          try {
            const headRes = await fetch(`${workerUrl}/api/data/${collection}`, {
              method: 'HEAD',
              cache: 'no-cache'
            });
            if (headRes.ok) {
              const edgeCachedAt = headRes.headers.get('X-Edge-Cached-At');
              if (edgeCachedAt) {
                const edgeTimestamp = Date.parse(edgeCachedAt);
                if (!Number.isNaN(edgeTimestamp) && edgeTimestamp === localSavedAt) {
                  // เวลาตรงกัน! ข้อมูลในเครื่องยังตรงกับ Edge Cache ไม่ต้องดาวน์โหลด JSON
                  return { data: {} as T, isSameAsLocal: true };
                }
              }
            }
          } catch (headErr) {
            console.warn(`HEAD check failed for ${collection}, continuing to GET:`, headErr);
          }
        }

        const query = canBypass ? `?fresh=true&t=${Date.now()}` : '';
        const headers: Record<string, string> = {};
        if (canBypass && environment.r2?.purgeKey) {
          headers['X-Purge-Key'] = environment.r2.purgeKey;
        }

        const res = await fetch(`${workerUrl}/api/data/${collection}${query}`, {
          headers,
          cache: canBypass ? 'no-store' : 'no-cache'
        });
        if (!res.ok) {
          throw new Error(`Worker HTTP ${res.status}`);
        }

        const edgeCachedAt = res.headers.get('X-Edge-Cached-At');
        if (edgeCachedAt) {
          const timestamp = Date.parse(edgeCachedAt);
          if (!Number.isNaN(timestamp)) {
            this.cache.setSavedAt(collection, timestamp);
          }
        }

        const data = (await res.json()) as T;
        return { data, isSameAsLocal: false };
      } catch (err) {
        console.warn(`Edge Worker fetch failed for ${collection}, falling back to Firebase RTDB:`, err);
      }
    }

    // Fallback: ดึงตรงจาก Firebase RTDB
    if (fallback) {
      const data = await fallback();
      return { data, isSameAsLocal: false };
    }

    return { data: {} as T, isSameAsLocal: false };
  }

  async fetchRows(
    collection: CacheKey,
    isForced?: boolean,
    localSavedAt?: number | null,
    fallback?: () => Promise<unknown>
  ): Promise<EdgeFetchResult<Record<string, unknown>[]>> {
    const result = await this.fetchRaw<unknown>(collection, isForced, localSavedAt, fallback);
    if (result.isSameAsLocal) {
      return { data: [], isSameAsLocal: true };
    }
    return { data: toRows(result.data), isSameAsLocal: false };
  }
}
