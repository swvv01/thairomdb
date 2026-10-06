import { Injectable, signal } from '@angular/core';
import { Observable, catchError, defer, of, shareReplay, tap } from 'rxjs';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
type CacheKey = 'patches' | 'translators' | 'tags' | 'systems' | 'sidebarLinks' | 'articles';

interface CacheEntry<T> { savedAt: number; value: T; }
type CacheTimestamps = Record<CacheKey, number | null>;

@Injectable({ providedIn: 'root' })
export class FirestoreCacheService {
  private readonly memory = new Map<CacheKey, Observable<unknown>>();
  private readonly forceFreshKeys = new Set<CacheKey>();
  private readonly timestamps = signal<CacheTimestamps>({ patches: null, translators: null, tags: null, systems: null, sidebarLinks: null, articles: null });

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
    (['patches', 'translators', 'tags', 'systems', 'sidebarLinks', 'articles'] as const).forEach((key) => this.invalidate(key));
  }

  get<T>(key: CacheKey, loadFresh: () => Observable<T>): Observable<T> {
    const existing = this.memory.get(key);
    if (existing) return existing as Observable<T>;

    const { entry, isStale } = this.readEntry<T>(key);
    if (entry) this.timestamps.update((timestamps) => ({ ...timestamps, [key]: entry.savedAt }));

    const isForced = this.forceFreshKeys.delete(key);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const source = (entry && isOffline)
      ? of(entry.value)
      : (!entry || isStale || isForced)
        ? defer(loadFresh).pipe(
            tap((value) => this.write(key, value)),
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
    this.memory.set(key, shared);
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
      return { entry, isStale: Date.now() - entry.savedAt >= CACHE_TTL_MS };
    } catch {
      try { window.localStorage.removeItem(this.storageKey(key)); } catch { /* ignore storage errors */ }
      return { isStale: true };
    }
  }

  private write<T>(key: CacheKey, value: T): void {
    const savedAt = Date.now();
    this.timestamps.update((timestamps) => ({ ...timestamps, [key]: savedAt }));
    try { window.localStorage.setItem(this.storageKey(key), JSON.stringify({ savedAt, value } satisfies CacheEntry<T>)); }
    catch { /* storage can be unavailable or full */ }
  }
}

export type { CacheKey };
