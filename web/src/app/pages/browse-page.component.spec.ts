import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { BrowsePageComponent } from './browse-page.component';
import { PatchRepository } from '../repositories/patch.repository';
import { TranslatorRepository } from '../repositories/translator.repository';
import { TagRepository } from '../repositories/tag.repository';
import { SystemRepository } from '../repositories/system.repository';
import { PatchCacheService } from '../services/patch-cache.service';
import { AuthService } from '../services/auth.service';
import { BrowseFilterStateService } from '../shared/browse-filter-state.service';
import { Patch } from '../models/patch.models';

describe('BrowsePageComponent - Load More Functionality', () => {
  let component: BrowsePageComponent;
  let fixture: ComponentFixture<BrowsePageComponent>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMapSubject: BehaviorSubject<ParamMap>;

  const mockPatches: Patch[] = Array.from({ length: 25 }, (_, i) => ({
    id: `patch-${i + 1}`,
    gameTitle: `Game ${i + 1}`,
    system: 'SNES',
    patchVersion: '1.0',
    translatedBy: 'Team A',
    translatorId: 'translator-1',
    haveUpdateFlag: false,
    patchTool: '',
    referenceText: '',
    referenceUrl: '',
    patchFileUrl: '',
    patchedRomUrl: '',
    walkthroughUrl: '',
    coverUrl: '',
    tags: [],
    updateDate: '2026-01-01T00:00:00Z'
  }));

  beforeEach(async () => {
    window.localStorage.clear();
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: PatchRepository,
          useValue: { watchAll: () => of(mockPatches) }
        },
        {
          provide: TranslatorRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: TagRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: SystemRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: PatchCacheService,
          useValue: { refreshRequested: () => 0 }
        },
        {
          provide: AuthService,
          useValue: { isAdmin: () => false }
        },
        BrowseFilterStateService,
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
            paramMap: of(convertToParamMap({})),
            queryParamMap: queryParamMapSubject.asObservable(),
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap({})
            }
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(BrowsePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with 10 patches displayed', () => {
    expect((component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches().length).toBe(10);
  });

  it('increments displayed patches by 10 when loadMore() is called without adding page queryParam', () => {
    (component as unknown as { loadMore: () => void }).loadMore();
    expect((component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches().length).toBe(20);
    expect(router.navigate).not.toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({ page: jasmine.anything() })
    }));
  });

  it('hasMore becomes false when all patches are loaded', () => {
    expect((component as unknown as { hasMore: () => boolean }).hasMore()).toBeTrue();
    (component as unknown as { loadMore: () => void }).loadMore(); // 20
    (component as unknown as { loadMore: () => void }).loadMore(); // 25 (all)
    expect((component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches().length).toBe(25);
    expect((component as unknown as { hasMore: () => boolean }).hasMore()).toBeFalse();
  });

  it('resets currentPage to 1 when filters are changed', () => {
    (component as unknown as { loadMore: () => void }).loadMore();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(2);

    (component as unknown as { setFilters: (f: unknown) => void }).setFilters({
      keyword: 'Game 1',
      tag: null,
      translatorId: null,
      system: null,
      sortBy: 'updateDate',
      sortDirection: 'desc'
    });
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(1);
  });

  it('does not read page parameter from URL query params', () => {
    queryParamMapSubject.next(convertToParamMap({ page: '3' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(1);
  });

  it('does not render floating add game button when user is not admin', () => {
    const authService = TestBed.inject(AuthService);
    spyOn(authService, 'isAdmin').and.returnValue(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.floating-action')).toBeNull();
  });

  it('renders floating add game button when user is admin regardless of scroll position', () => {
    const authService = TestBed.inject(AuthService);
    spyOn(authService, 'isAdmin').and.returnValue(true);
    fixture.detectChanges();
    const floatingBtn = fixture.nativeElement.querySelector('.floating-action');
    expect(floatingBtn).toBeTruthy();
    expect(floatingBtn.getAttribute('routerLink')).toBe('/add');
  });

  it('renders back to top button below floating add game inside browse-floating-actions', () => {
    const authService = TestBed.inject(AuthService);
    spyOn(authService, 'isAdmin').and.returnValue(true);
    (component as unknown as { showBackToTop: { set: (v: boolean) => void } }).showBackToTop.set(true);
    fixture.detectChanges();

    const actionsContainer = fixture.nativeElement.querySelector('.browse-floating-actions');
    expect(actionsContainer).toBeTruthy();
    const children = actionsContainer.children;
    expect(children.length).toBe(2);
    expect(children[0].classList.contains('floating-action')).toBeTrue();
    expect(children[1].classList.contains('back-to-top')).toBeTrue();
  });

  it('calculates total play time stats correctly and renders HUD stat bar with formatted duration', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    patchesSignal.set([
      { ...mockPatches[0], id: 'p1', playTime: 12.5 },
      { ...mockPatches[1], id: 'p2', playTime: 20 },
      { ...mockPatches[2], id: 'p3', playTime: null }
    ]);
    fixture.detectChanges();

    const stats = (component as unknown as { playTimeStats: () => { formattedDuration: string; count: number; hasData: boolean } }).playTimeStats();
    expect(stats.hasData).toBeTrue();
    expect(stats.formattedDuration).toBe('1 วัน 8.5 ชั่วโมง');
    expect(stats.count).toBe(2);

    const statBar = fixture.nativeElement.querySelector('.browse-stat-bar');
    expect(statBar).toBeTruthy();
    expect(statBar.textContent).toContain('1 วัน 8.5 ชั่วโมง');
    expect(statBar.textContent).toContain('(จาก 2 เกม)');
  });

  it('formats large duration into years, months, days, and hours correctly', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    // 8760 (1 year) + 720 (1 month) + 48 (2 days) + 3 hours = 9531 hours
    patchesSignal.set([
      { ...mockPatches[0], id: 'p1', playTime: 9531 }
    ]);
    fixture.detectChanges();

    const stats = (component as unknown as { playTimeStats: () => { formattedDuration: string } }).playTimeStats();
    expect(stats.formattedDuration).toBe('1 ปี 1 เดือน 2 วัน 3 ชั่วโมง');
  });

  it('does not render HUD stat bar when no games have play time', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    patchesSignal.set([
      { ...mockPatches[0], id: 'p1', playTime: null },
      { ...mockPatches[1], id: 'p2', playTime: 0 }
    ]);
    fixture.detectChanges();

    const stats = (component as unknown as { playTimeStats: () => { hasData: boolean } }).playTimeStats();
    expect(stats.hasData).toBeFalse();

    const statBar = fixture.nativeElement.querySelector('.browse-stat-bar');
    expect(statBar).toBeNull();
  });

  it('sorts patches by playTime in ascending order with 0 and null placed at the end', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    patchesSignal.set([
      { ...mockPatches[0], id: 'p-null', gameTitle: 'Game Null', playTime: null },
      { ...mockPatches[1], id: 'p-20', gameTitle: 'Game 20', playTime: 20 },
      { ...mockPatches[2], id: 'p-0', gameTitle: 'Game Zero', playTime: 0 },
      { ...mockPatches[0], id: 'p-5', gameTitle: 'Game 5', playTime: 5 }
    ]);
    (component as unknown as { setFilters: (f: unknown) => void }).setFilters({
      keyword: '',
      tag: null,
      translatorId: null,
      system: null,
      sortBy: 'playTime',
      sortDirection: 'asc'
    });
    fixture.detectChanges();

    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    expect(sorted.map((p) => p.id)).toEqual(['p-5', 'p-20', 'p-0', 'p-null']);
  });

  it('sorts patches by playTime in descending order with 0 and null placed at the end', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    patchesSignal.set([
      { ...mockPatches[0], id: 'p-null', gameTitle: 'Game Null', playTime: null },
      { ...mockPatches[1], id: 'p-5', gameTitle: 'Game 5', playTime: 5 },
      { ...mockPatches[2], id: 'p-0', gameTitle: 'Game Zero', playTime: 0 },
      { ...mockPatches[0], id: 'p-20', gameTitle: 'Game 20', playTime: 20 }
    ]);
    (component as unknown as { setFilters: (f: unknown) => void }).setFilters({
      keyword: '',
      tag: null,
      translatorId: null,
      system: null,
      sortBy: 'playTime',
      sortDirection: 'desc'
    });
    fixture.detectChanges();

    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    expect(sorted.map((p) => p.id)).toEqual(['p-20', 'p-5', 'p-0', 'p-null']);
  });

  it('uses game title as the secondary playTime sort in both directions', () => {
    const patchesSignal = (component as unknown as { patches: { set: (v: Patch[]) => void } }).patches;
    patchesSignal.set([
      { ...mockPatches[0], id: 'p-z', gameTitle: 'เกม ซ', playTime: 10 },
      { ...mockPatches[1], id: 'p-a', gameTitle: 'เกม ก', playTime: 10 },
      { ...mockPatches[2], id: 'p-zero-z', gameTitle: 'เกม ซ ศูนย์', playTime: 0 },
      { ...mockPatches[0], id: 'p-zero-a', gameTitle: 'เกม ก ศูนย์', playTime: 0 }
    ]);

    const setFilters = (sortDirection: 'asc' | 'desc') => {
      (component as unknown as { setFilters: (f: unknown) => void }).setFilters({
        keyword: '', tag: null, translatorId: null, system: null,
        sortBy: 'playTime', sortDirection
      });
      fixture.detectChanges();
      return (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    };

    expect(setFilters('asc').map((p) => p.id)).toEqual(['p-a', 'p-z', 'p-zero-a', 'p-zero-z']);
    expect(setFilters('desc').map((p) => p.id)).toEqual(['p-a', 'p-z', 'p-zero-a', 'p-zero-z']);
  });

  it('reads sort=playTime from URL query params', () => {
    queryParamMapSubject.next(convertToParamMap({ sort: 'playTime' }));
    fixture.detectChanges();
    expect((component as unknown as { sortBy: () => string }).sortBy()).toBe('playTime');
  });

  it('renders mode toggle button in load more mode and toggles to page mode', () => {
    fixture.detectChanges();
    const modeToggle = fixture.nativeElement.querySelector('.mode-toggle-link');
    expect(modeToggle).toBeTruthy();
    expect(modeToggle.textContent).toContain('สลับไปโหมดแบ่งหน้า');

    modeToggle.click();
    fixture.detectChanges();

    expect((component as unknown as { isPageMode: () => boolean }).isPageMode()).toBeTrue();
    expect(window.localStorage.getItem(BrowsePageComponent.viewModeStorageKey)).toBe('page');
    expect(fixture.nativeElement.querySelector('.mode-toggle-link').textContent).toContain('สลับไปโหมดโหลดต่อเนื่อง');
  });
});

describe('BrowsePageComponent - Page Mode Functionality', () => {
  let component: BrowsePageComponent;
  let fixture: ComponentFixture<BrowsePageComponent>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMapSubject: BehaviorSubject<ParamMap>;

  const mockPatches: Patch[] = Array.from({ length: 25 }, (_, i) => ({
    id: `patch-${i + 1}`,
    gameTitle: `Game ${i + 1}`,
    system: 'SNES',
    patchVersion: '1.0',
    translatedBy: 'Team A',
    translatorId: 'translator-1',
    haveUpdateFlag: false,
    patchTool: '',
    referenceText: '',
    referenceUrl: '',
    patchFileUrl: '',
    patchedRomUrl: '',
    walkthroughUrl: '',
    coverUrl: '',
    tags: [],
    updateDate: '2026-01-01T00:00:00Z'
  }));

  beforeEach(async () => {
    window.localStorage.clear();
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: PatchRepository,
          useValue: { watchAll: () => of(mockPatches) }
        },
        {
          provide: TranslatorRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: TagRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: SystemRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: PatchCacheService,
          useValue: { refreshRequested: () => 0 }
        },
        {
          provide: AuthService,
          useValue: { isAdmin: () => false }
        },
        BrowseFilterStateService,
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ pageMode: true }),
            paramMap: of(convertToParamMap({})),
            queryParamMap: queryParamMapSubject.asObservable(),
            snapshot: {
              data: { pageMode: true },
              queryParamMap: convertToParamMap({})
            }
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(BrowsePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes with pageMode true and displays only first 10 patches', () => {
    expect((component as unknown as { isPageMode: () => boolean }).isPageMode()).toBeTrue();
    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    const paginated = (component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches();
    expect(paginated.length).toBe(10);
    expect(paginated).toEqual(sorted.slice(0, 10));
  });

  it('navigates with page number queryParam when setPage(2) is called', () => {
    (component as unknown as { setPage: (p: number) => void }).setPage(2);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: { page: 2 },
      queryParamsHandling: 'merge'
    });
    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    const paginated = (component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches();
    expect(paginated.length).toBe(10);
    expect(paginated).toEqual(sorted.slice(10, 20));
  });

  it('navigates with page: null when returning to page 1', () => {
    (component as unknown as { setPage: (p: number) => void }).setPage(2);
    router.navigate.calls.reset();
    (component as unknown as { setPage: (p: number) => void }).setPage(1);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: { page: null },
      queryParamsHandling: 'merge'
    });
  });

  it('initializes currentPage from queryParamMap page parameter when in pageMode', () => {
    queryParamMapSubject.next(convertToParamMap({ page: '3' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(3);
    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    const paginated = (component as unknown as { paginatedPatches: () => Patch[] }).paginatedPatches();
    expect(paginated.length).toBe(5);
    expect(paginated).toEqual(sorted.slice(20, 25));
  });

  it('resets currentPage to 1 when filters are changed in pageMode', () => {
    queryParamMapSubject.next(convertToParamMap({ page: '2' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(2);

    (component as unknown as { setFilters: (f: unknown) => void }).setFilters({
      keyword: 'Game 1',
      tag: null,
      translatorId: null,
      system: null,
      sortBy: 'updateDate',
      sortDirection: 'desc'
    });
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(1);
  });

  it('clamps currentPage to totalPages if page in URL exceeds maximum pages', () => {
    queryParamMapSubject.next(convertToParamMap({ page: '99' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(3);
  });

  it('defaults to page 1 for invalid page numbers in URL', () => {
    queryParamMapSubject.next(convertToParamMap({ page: '-5' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(1);

    queryParamMapSubject.next(convertToParamMap({ page: 'not-a-number' }));
    fixture.detectChanges();
    expect((component as unknown as { currentPage: () => number }).currentPage()).toBe(1);
  });

  it('stays on /page when clearAllFilters() is called in pageMode', () => {
    (component as unknown as { clearAllFilters: () => void }).clearAllFilters();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/page', { replaceUrl: true });
  });

  it('renders top and bottom pagination controls and does not render mode toggle button on /page', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pagination--top')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.pagination--bottom')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.mode-toggle-link')).toBeNull();
  });

  it('renders load-more-end message only on the last page in pageMode', () => {
    // mockPatches has 25 items, pageSize = 10, totalPages = 3
    fixture.detectChanges();
    // On page 1: shouldn't show load-more-end
    expect(fixture.nativeElement.querySelector('.load-more-end')).toBeNull();

    // Navigate to page 3 (last page)
    (component as unknown as { setPage: (p: number) => void }).setPage(3);
    fixture.detectChanges();

    const endMsg = fixture.nativeElement.querySelector('.load-more-end');
    expect(endMsg).toBeTruthy();
    expect(endMsg.textContent).toContain('แสดงรายการทั้งหมดครบแล้ว (25 เกม)');
  });
});

describe('BrowsePageComponent - Persistent View Mode', () => {
  let component: BrowsePageComponent;
  let fixture: ComponentFixture<BrowsePageComponent>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMapSubject: BehaviorSubject<ParamMap>;

  const mockPatches: Patch[] = Array.from({ length: 25 }, (_, i) => ({
    id: `patch-${i + 1}`,
    gameTitle: `Game ${i + 1}`,
    system: 'SNES',
    patchVersion: '1.0',
    translatedBy: 'Team A',
    translatorId: 'translator-1',
    haveUpdateFlag: false,
    patchTool: '',
    referenceText: '',
    referenceUrl: '',
    patchFileUrl: '',
    patchedRomUrl: '',
    walkthroughUrl: '',
    coverUrl: '',
    tags: [],
    updateDate: '2026-01-01T00:00:00Z'
  }));

  beforeEach(async () => {
    window.localStorage.clear();
    window.localStorage.setItem(BrowsePageComponent.viewModeStorageKey, 'page');
    queryParamMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: PatchRepository,
          useValue: { watchAll: () => of(mockPatches) }
        },
        {
          provide: TranslatorRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: TagRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: SystemRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: PatchCacheService,
          useValue: { refreshRequested: () => 0 }
        },
        {
          provide: AuthService,
          useValue: { isAdmin: () => false }
        },
        BrowseFilterStateService,
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
            paramMap: of(convertToParamMap({})),
            queryParamMap: queryParamMapSubject.asObservable(),
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap({})
            }
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(BrowsePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('restores page mode from localStorage when accessing root route without forced pageMode', () => {
    expect((component as unknown as { isPageMode: () => boolean }).isPageMode()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.pagination--top')).toBeTruthy();
    const modeToggle = fixture.nativeElement.querySelector('.mode-toggle-link');
    expect(modeToggle).toBeTruthy();
    expect(modeToggle.textContent).toContain('สลับไปโหมดโหลดต่อเนื่อง');
  });

  it('toggles from saved page mode back to scroll mode, updates localStorage, and clears page queryParam', () => {
    const modeToggle = fixture.nativeElement.querySelector('.mode-toggle-link');
    modeToggle.click();
    fixture.detectChanges();

    expect((component as unknown as { isPageMode: () => boolean }).isPageMode()).toBeFalse();
    expect(window.localStorage.getItem(BrowsePageComponent.viewModeStorageKey)).toBe('scroll');
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: { page: null },
      queryParamsHandling: 'merge'
    });
    expect(fixture.nativeElement.querySelector('.mode-toggle-link').textContent).toContain('สลับไปโหมดแบ่งหน้า');
  });
});

describe('BrowsePageComponent - PortMaster Filtering and /port Route', () => {
  let component: BrowsePageComponent;
  let fixture: ComponentFixture<BrowsePageComponent>;
  let routeDataSubject: BehaviorSubject<Record<string, unknown>>;

  const testPatches: Patch[] = [
    {
      id: 'patch-retro-1',
      gameTitle: 'Super Mario World',
      system: 'SNES',
      patchVersion: '1.0',
      translatedBy: 'Team A',
      translatorId: 'translator-1',
      haveUpdateFlag: false,
      patchTool: '',
      referenceText: '',
      referenceUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      walkthroughUrl: '',
      coverUrl: '',
      tags: [],
      updateDate: '2026-01-01T00:00:00Z'
    },
    {
      id: 'patch-retro-2',
      gameTitle: 'Pokemon Emerald',
      system: 'GBA',
      patchVersion: '1.0',
      translatedBy: 'Team A',
      translatorId: 'translator-1',
      haveUpdateFlag: false,
      patchTool: '',
      referenceText: '',
      referenceUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      walkthroughUrl: '',
      coverUrl: '',
      tags: [],
      updateDate: '2026-01-02T00:00:00Z'
    },
    {
      id: 'patch-portmaster-1',
      gameTitle: 'Celeste',
      system: 'PortMaster',
      patchVersion: '1.0',
      translatedBy: 'Team A',
      translatorId: 'translator-1',
      haveUpdateFlag: false,
      patchTool: '',
      referenceText: '',
      referenceUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      walkthroughUrl: '',
      coverUrl: '',
      tags: [],
      updateDate: '2026-01-03T00:00:00Z'
    },
    {
      id: 'patch-port-2',
      gameTitle: 'Grand Theft Auto: San Andreas',
      system: 'PORT',
      patchVersion: '1.1',
      translatedBy: 'Team A',
      translatorId: 'translator-1',
      haveUpdateFlag: false,
      patchTool: '',
      referenceText: '',
      referenceUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      walkthroughUrl: '',
      coverUrl: '',
      tags: [],
      updateDate: '2026-01-04T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    routeDataSubject = new BehaviorSubject<Record<string, unknown>>({});

    await TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: PatchRepository,
          useValue: { watchAll: () => of(testPatches) }
        },
        {
          provide: TranslatorRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: TagRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: SystemRepository,
          useValue: { watchAll: () => of([]) }
        },
        {
          provide: PatchCacheService,
          useValue: { refreshRequested: () => 0 }
        },
        {
          provide: AuthService,
          useValue: { isAdmin: () => false }
        },
        BrowseFilterStateService,
        {
          provide: ActivatedRoute,
          useValue: {
            data: routeDataSubject.asObservable(),
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({})),
            snapshot: {
              data: {},
              queryParamMap: convertToParamMap({})
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BrowsePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('filters out PortMaster and PORT games on the main page (routeKind is null)', () => {
    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    expect(sorted.length).toBe(2);
    expect(sorted.some((p) => p.system === 'PortMaster' || p.system === 'PORT')).toBeFalse();
    expect(sorted.map((p) => p.id)).toEqual(['patch-retro-2', 'patch-retro-1']);
  });

  it('excludes PortMaster and PORT from systems dropdown list on main page', () => {
    const systems = (component as unknown as { systems: () => string[] }).systems();
    expect(systems).toEqual(['GBA', 'SNES']);
    expect(systems.includes('PortMaster')).toBeFalse();
    expect(systems.includes('PORT')).toBeFalse();
  });

  it('shows only PortMaster/PORT games and sets label when browseKind is port', () => {
    routeDataSubject.next({ browseKind: 'port' });
    fixture.detectChanges();

    const sorted = (component as unknown as { sortedPatches: () => Patch[] }).sortedPatches();
    expect(sorted.length).toBe(2);
    expect(sorted.map((p) => p.id)).toEqual(['patch-port-2', 'patch-portmaster-1']);
    expect(sorted.every((p) => p.system === 'PortMaster' || p.system === 'PORT')).toBeTrue();

    const label = (component as unknown as { activeRouteLabel: () => string }).activeRouteLabel();
    expect(label).toBe('Port Master');

    const systems = (component as unknown as { systems: () => string[] }).systems();
    expect(systems).toEqual(['PORT', 'PortMaster']);
  });
});

