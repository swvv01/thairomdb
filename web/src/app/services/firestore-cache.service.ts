import { Injectable, signal } from '@angular/core';
import { Observable, catchError, defer, map, of, shareReplay, tap } from 'rxjs';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
type CacheKey = 'patches' | 'translators' | 'tags' | 'systems' | 'sidebarLinks' | 'articles' | 'marquees';

interface CacheEntry<T> { savedAt: number; value: T; }
type CacheTimestamps = Record<CacheKey, number | null>;

@Injectable({ providedIn: 'root' })
export class FirestoreCacheService {
  private readonly memory = new Map<CacheKey, Observable<unknown>>();
  private readonly forceFreshKeys = new Set<CacheKey>();
  private readonly timestamps = signal<CacheTimestamps>({ patches: null, translators: null, tags: null, systems: null, sidebarLinks: null, articles: null, marquees: null });

  timestamp(key: CacheKey): number | null {
    const current = this.timestamps()[key];
    if (current !== null) return current;
    const { entry } = this.readEntry<unknown>(key);
    if (entry) {
      this.timestamps.update((timestamps) => ({ ...timestamps, [key]: entry.savedAt }));
      return entry.savedAt;
    }
    return null;
  }

  timestampSignal(key: CacheKey) {
    return () => this.timestamps()[key];
  }

  invalidate(key: CacheKey): void {
    this.memory.delete(key);
    this.forceFreshKeys.add(key);
  }

  invalidateAll(): void {
    (['patches', 'translators', 'tags', 'systems', 'sidebarLinks', 'articles', 'marquees'] as const).forEach((key) => this.invalidate(key));
  }

  get<T>(key: CacheKey, loadFresh: (isForced?: boolean, localSavedAt?: number | null) => Observable<{ data: T; isSameAsLocal?: boolean } | T>): Observable<T> {
    const existing = this.memory.get(key);
    if (existing) return existing as Observable<T>;

    const { entry, isStale } = this.readEntry<T>(key);
    if (entry) this.timestamps.update((timestamps) => ({ ...timestamps, [key]: entry.savedAt }));

    const isForced = this.forceFreshKeys.delete(key);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const source: Observable<T> = (entry && isOffline)
      ? of(entry.value)
      : (!entry || isStale || isForced)
        ? defer(() => loadFresh(isForced, entry?.savedAt ?? null)).pipe(
            map((result: { data: T; isSameAsLocal?: boolean } | T): T => {
              if (result && typeof result === 'object' && 'isSameAsLocal' in result && (result as { isSameAsLocal?: boolean }).isSameAsLocal && entry) {
                return entry.value;
              }
              const value = (result && typeof result === 'object' && 'data' in result)
                ? (result as { data: T }).data
                : (result as T);
              this.write(key, value);
              return value;
            }),
            catchError((error) => {
              if (entry) return of(entry.value);
              throw error;
            })
          )
        : of(entry.value);
    const shared = source.pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      catchError((error) => { this.memory.delete(key); throw error; })
    );
    this.memory.set(key, shared as Observable<unknown>);
    return shared;
  }

  clear(key: CacheKey): void {
    this.memory.delete(key);
    this.forceFreshKeys.delete(key);
    try { window.localStorage.removeItem(this.storageKey(key)); } catch { /* storage can be unavailable */ }
    this.timestamps.update((timestamps) => ({ ...timestamps, [key]: null }));
  }

  clearAll(): void {
    (['patches', 'translators', 'tags', 'systems', 'sidebarLinks', 'articles'] as const).forEach((key) => this.clear(key));
  }

  setSavedAt(key: CacheKey, timestamp: number): void {
    this.timestamps.update((timestamps) => ({ ...timestamps, [key]: timestamp }));
    const { entry } = this.readEntry<unknown>(key);
    if (entry) {
      entry.savedAt = timestamp;
      try {
        window.localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
      } catch { /* ignore storage errors */ }
    }
  }

  private storageKey(key: CacheKey): string { return `rom-collector:realtime-database:${key}`; }

  private readEntry<T>(key: CacheKey): { entry?: CacheEntry<T>; isStale: boolean } {
    try {
      const raw = window.localStorage.getItem(this.storageKey(key));
      if (!raw) return { isStale: true };
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (!entry || typeof entry.savedAt !== 'number') {
        window.localStorage.removeItem(this.storageKey(key));
        return { isStale: true };
      }
      return { entry, isStale: key === 'patches' ? true : Date.now() - entry.savedAt >= CACHE_TTL_MS };
    } catch {
      try { window.localStorage.removeItem(this.storageKey(key)); } catch { /* ignore storage errors */ }
      return { isStale: true };
    }
  }

  private write<T>(key: CacheKey, value: T, customSavedAt?: number): void {
    const current = this.timestamps()[key];
    const savedAt = customSavedAt ?? current ?? Date.now();
    this.timestamps.update((timestamps) => ({ ...timestamps, [key]: savedAt }));
    try { window.localStorage.setItem(this.storageKey(key), JSON.stringify({ savedAt, value } satisfies CacheEntry<T>)); }
    catch { /* storage can be unavailable or full */ }
  }
}

export type { CacheKey };
