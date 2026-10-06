import { TestBed } from '@angular/core/testing';
import { FirestoreCacheService } from './firestore-cache.service';
import { of, throwError } from 'rxjs';

describe('FirestoreCacheService', () => {
  let service: FirestoreCacheService;
  const storageKey = 'rom-collector:realtime-database:systems';

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirestoreCacheService);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('fetches fresh data and writes to localStorage when no cache exists', (done) => {
    const freshData = [{ id: '1', name: 'FC' }];
    service.get('systems', () => of(freshData)).subscribe((data) => {
      expect(data).toEqual(freshData);
      const raw = window.localStorage.getItem(storageKey);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.value).toEqual(freshData);
      done();
    });
  });

  it('returns valid cache immediately without calling loadFresh', (done) => {
    const cachedData = [{ id: '1', name: 'SFC' }];
    window.localStorage.setItem(storageKey, JSON.stringify({
      savedAt: Date.now(),
      value: cachedData
    }));

    let loadFreshCalled = false;
    service.get('systems', () => {
      loadFreshCalled = true;
      return of<Array<{ id: string; name: string }>>([]);
    }).subscribe((data) => {
      expect(data).toEqual(cachedData);
      expect(loadFreshCalled).toBeFalse();
      done();
    });
  });

  it('falls back to stale cache when loadFresh errors and cache is expired', (done) => {
    const staleData = [{ id: '1', name: 'GB' }];
    const thirteenHoursAgo = Date.now() - (13 * 60 * 60 * 1000);
    window.localStorage.setItem(storageKey, JSON.stringify({
      savedAt: thirteenHoursAgo,
      value: staleData
    }));

    service.get('systems', () => throwError(() => new Error('Network error'))).subscribe({
      next: (data) => {
        expect(data).toEqual(staleData);
        done();
      },
      error: () => {
        fail('Should have fallen back to stale cache instead of throwing');
      }
    });
  });

  it('forces fresh fetch on invalidate but falls back to cache if fetch fails', (done) => {
    const initialData = [{ id: '1', name: 'GBA' }];
    window.localStorage.setItem(storageKey, JSON.stringify({
      savedAt: Date.now(),
      value: initialData
    }));

    service.invalidate('systems');

    service.get('systems', () => throwError(() => new Error('Adblock blocked connection'))).subscribe({
      next: (data) => {
        expect(data).toEqual(initialData);
        done();
      },
      error: () => {
        fail('Should have preserved existing cache on network failure');
      }
    });
  });

  it('throws error when no cache exists and loadFresh fails', (done) => {
    service.get('systems', () => throwError(() => new Error('Failed to load'))).subscribe({
      next: () => fail('Should have failed'),
      error: (err) => {
        expect(err.message).toBe('Failed to load');
        done();
      }
    });
  });

  it('returns cached data immediately when navigator.onLine is false even if cache is stale', (done) => {
    const cachedData = [{ id: '1', name: 'PS1' }];
    const staleTime = Date.now() - (24 * 60 * 60 * 1000);
    window.localStorage.setItem(storageKey, JSON.stringify({
      savedAt: staleTime,
      value: cachedData
    }));

    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);

    let loadFreshCalled = false;
    service.get('systems', () => {
      loadFreshCalled = true;
      return of<Array<{ id: string; name: string }>>([]);
    }).subscribe((data) => {
      expect(data).toEqual(cachedData);
      expect(loadFreshCalled).toBeFalse();
      done();
    });
  });
});
