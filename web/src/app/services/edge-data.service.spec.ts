import { TestBed } from '@angular/core/testing';
import { EdgeDataService, toRows } from './edge-data.service';
import { FirestoreCacheService } from './firestore-cache.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

describe('EdgeDataService', () => {
  let service: EdgeDataService;
  let cacheService: FirestoreCacheService;
  const mockIsAdmin = signal<boolean>(false);

  beforeEach(() => {
    mockIsAdmin.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAdmin: mockIsAdmin } }
      ]
    });
    service = TestBed.inject(EdgeDataService);
    cacheService = TestBed.inject(FirestoreCacheService);
  });

  afterEach(() => {
    jasmine.getEnv().allowRespy(true);
  });

  it('toRows converts an object dictionary to array with id', () => {
    const raw = {
      tag1: { name: 'Action', slug: 'action' },
      tag2: { name: 'RPG', slug: 'rpg' }
    };
    const rows = toRows(raw);
    expect(rows.length).toBe(2);
    expect(rows[0]['id']).toBe('tag1');
    expect(rows[0]['name']).toBe('Action');
    expect(rows[1]['id']).toBe('tag2');
  });

  it('toRows handles empty, null or undefined input', () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
    expect(toRows({})).toEqual([]);
  });

  it('returns isSameAsLocal when HEAD check matches localSavedAt', async () => {
    const timestamp = 1700000000000;
    spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, {
      status: 200,
      headers: { 'X-Edge-Cached-At': new Date(timestamp).toISOString() }
    })));

    const result = await service.fetchRaw('tags', false, timestamp, async () => ({}));
    expect(result.isSameAsLocal).toBeTrue();
  });

  it('fetches fresh data via GET and sets savedAt when timestamp differs', async () => {
    const oldTimestamp = 1600000000000;
    const newDate = new Date(1700000000000).toISOString();
    const mockData = { tag1: { name: 'Action' } };

    let fetchCount = 0;
    spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL, init?: RequestInit) => {
      fetchCount++;
      if (init?.method === 'HEAD') {
        return Promise.resolve(new Response(null, {
          status: 200,
          headers: { 'X-Edge-Cached-At': newDate }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'X-Edge-Cached-At': newDate, 'Content-Type': 'application/json' }
      }));
    });

    const setSavedAtSpy = spyOn(cacheService, 'setSavedAt');
    const result = await service.fetchRaw('tags', false, oldTimestamp, async () => ({}));

    expect(result.isSameAsLocal).toBeFalse();
    expect(result.data).toEqual(mockData);
    expect(setSavedAtSpy).toHaveBeenCalledWith('tags', 1700000000000);
  });

  it('falls back to fallback callback when worker fetch fails', async () => {
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('Network error')));
    const fallbackData = { fallbackKey: { name: 'From RTDB' } };

    const result = await service.fetchRaw('tags', false, null, async () => fallbackData);
    expect(result.isSameAsLocal).toBeFalse();
    expect(result.data).toEqual(fallbackData);
  });

  it('does not bypass cache or send X-Purge-Key when isForced is true but user is not admin', async () => {
    mockIsAdmin.set(false);
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> | undefined;

    spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await service.fetchRaw('tags', true, null, async () => ({}));
    expect(capturedUrl).not.toContain('fresh=true');
    expect(capturedHeaders?.['X-Purge-Key']).toBeUndefined();
  });

  it('bypasses cache and sends X-Purge-Key when isForced is true and user is admin', async () => {
    mockIsAdmin.set(true);
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> | undefined;

    spyOn(window, 'fetch').and.callFake((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await service.fetchRaw('tags', true, null, async () => ({}));
    expect(capturedUrl).toContain('fresh=true');
    expect(capturedHeaders?.['X-Purge-Key']).toBeDefined();
  });
});
