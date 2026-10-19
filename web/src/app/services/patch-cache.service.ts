import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FirestoreCacheService } from './firestore-cache.service';

@Injectable({ providedIn: 'root' })
export class PatchCacheService {
  readonly refreshRequested = signal(0);
  private readonly cache = inject(FirestoreCacheService);
  readonly lastUpdated = this.cache.timestampSignal('patches');

  get<T>(loadFresh: (isForced?: boolean, localSavedAt?: number | null) => Observable<{ data: T; isSameAsLocal?: boolean } | T>): Observable<T> {
    return this.cache.get('patches', loadFresh);
  }

  clear(): void { this.cache.clear('patches'); }

  clearAll(): void { this.cache.clearAll(); }

  requestForceRefresh(): void {
    this.cache.invalidate('patches');
    this.refreshRequested.update((value) => value + 1);
  }

  setSavedAt(timestamp: number): void {
    this.cache.setSavedAt('patches', timestamp);
  }

}
