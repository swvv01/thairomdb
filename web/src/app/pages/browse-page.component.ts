import { Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PatchRepository } from '../repositories/patch.repository';
import { TranslatorRepository } from '../repositories/translator.repository';
import { GameListSortField, Patch, Tag, Translator } from '../models/patch.models';
import { GameListControlsComponent } from '../components/game-list-controls.component';
import { PatchCardListComponent } from '../components/patch-card-list.component';
import { AuthService } from '../services/auth.service';
import { BrowseFilterStateService } from '../shared/browse-filter-state.service';
import { BrowseRouteKind, isPortMasterSystem, normalizeBrowseName } from '../shared/browse-route.util';
import { SystemMaster, SystemRepository } from '../repositories/system.repository';
import { PatchCacheService } from '../services/patch-cache.service';
import { TagRepository } from '../repositories/tag.repository';

@Component({
  selector: 'app-browse-page',
  standalone: true,
  imports: [RouterLink, GameListControlsComponent, PatchCardListComponent],
  styleUrl: './browse-page.component.css',
  templateUrl: './browse-page.component.html'
})
export class BrowsePageComponent implements OnInit {
  private static readonly todayWindowMs = 24 * 60 * 60 * 1000;
  private static readonly weekWindowMs = 7 * 24 * 60 * 60 * 1000;
  private readonly patchRepository = inject(PatchRepository);
  private readonly filterState = inject(BrowseFilterStateService);
  private readonly translatorRepository = inject(TranslatorRepository);
  private readonly tagRepository = inject(TagRepository);
  private readonly systemRepository = inject(SystemRepository);
  private readonly patchCache = inject(PatchCacheService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private lastClearAllRequest = this.filterState.clearAllRequested();
  protected readonly patches = signal<Patch[]>([]);
  protected readonly keyword = signal('');
  protected readonly selectedTag = this.filterState.selectedTag;
  protected readonly selectedTranslatorId = this.filterState.selectedTranslatorId;
  protected readonly selectedSystem = this.filterState.selectedSystem;
  protected readonly systems = computed(() => {
    const kind = this.routeKind();
    const patches = this.patches().filter((patch) => {
      if (kind === 'port') return isPortMasterSystem(patch.system);
      if (kind === null) return !isPortMasterSystem(patch.system);
      return true;
    });
    return [...new Set(patches.map((patch) => patch.system.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { sensitivity: 'base' }));
  });
  protected readonly translators = signal<Translator[]>([]);
  protected readonly tags = signal<Tag[]>([]);
  protected readonly systemMasters = signal<SystemMaster[]>([]);
  private readonly systemsLoaded = signal(false);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly showBackToTop = signal(false);
  protected readonly showFloatingAddGame = signal(false);
  protected readonly isPageMode = signal(!!this.route.snapshot.data['pageMode']);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 10;
  protected readonly sortBy = signal<GameListSortField>('updateDate');
  protected readonly direction = signal<'asc' | 'desc'>('desc');
  private readonly queryStateReady = signal(false);
  private readonly translatorQuery = signal<string | null>(null);
  protected readonly routeKind = signal<BrowseRouteKind | null>(null);
  private readonly routeSlug = signal<string | null>(null);
  private readonly clearAllEffect = effect(() => {
    const request = this.filterState.clearAllRequested();
    if (request === this.lastClearAllRequest) return;
    this.lastClearAllRequest = request;
    this.keyword.set('');
    this.sortBy.set('updateDate');
    this.direction.set('desc');
  }, { allowSignalWrites: true });
  private readonly queryStateEffect = effect(() => {
    if (!this.queryStateReady()) return;
    const filters = this.filters();
    const page = untracked(() => this.currentPage());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: filters.keyword.trim() || null,
        translator: this.translators().find((item) => item.id === filters.translatorId)?.shortName || null,
        system: filters.system || null,
        sort: filters.sortBy === 'updateDate' ? null : filters.sortBy,
        dir: filters.sortDirection === 'desc' ? null : filters.sortDirection,
        page: this.isPageMode() && page > 1 ? page : null
      },
      replaceUrl: true
    });
  });
  private readonly forceRefreshEffect = effect(() => {
    if (this.patchCache.refreshRequested() === 0) return;
    this.loading.set(true);
    this.unavailable.set(false);
    this.loadPatches();
  }, { allowSignalWrites: true });
  private readonly selectedRouteLabels = computed(() => {
    const translator = this.translators().find((item) => item.id === this.selectedTranslatorId());
    return [translator?.name.trim() ?? '', this.selectedSystem()?.trim() ?? ''].filter(Boolean);
  });
  protected readonly activeRouteLabel = computed(() => {
    const kind = this.routeKind();
    const selectedLabels = this.selectedRouteLabels();
    if (kind === 'rom') return this.joinRouteLabels('รอมแปลไทย', ...selectedLabels);
    if (kind === 'port') return this.joinRouteLabels('Port Master', ...selectedLabels);
    if (kind === 'walkthrough') return this.joinRouteLabels('บทสรุป', ...selectedLabels);
    if (kind === 'today') return this.joinRouteLabels('เกมใหม่วันนี้', ...selectedLabels);
    if (kind === 'week') return this.joinRouteLabels('เกมใหม่สัปดาห์นี้', ...selectedLabels);
    if (kind === 'tag') {
      const slug = this.routeSlug();
      const tag = this.tags().find((item) => item.slug === (slug ? decodeURIComponent(slug) : ''));
      return this.joinRouteLabels(tag?.name ?? '', ...selectedLabels) || 'เกมทั้งหมด';
    }
    return this.joinRouteLabels(...selectedLabels) || 'เกมทั้งหมด';
  });

  private joinRouteLabels(...labels: string[]): string {
    return labels.filter(Boolean).join(' - ');
  }
  private readonly patchesLoaded = signal(false);
  private readonly translatorsLoaded = signal(false);
  private readonly tagsLoaded = signal(false);
  protected readonly filters = computed(() => ({ keyword: this.keyword(), tag: this.selectedTag(), translatorId: this.selectedTranslatorId(), system: this.selectedSystem(), sortBy: this.sortBy(), sortDirection: this.direction() }));
  protected readonly sortedPatches = computed(() => this.patches().filter((patch) => {
    if (this.routeKind() === 'rom' && !patch.patchedRomUrl?.trim()) return false;
    if (this.routeKind() === 'walkthrough' && !patch.walkthroughUrl?.trim()) return false;
    if (this.routeKind() === 'port' && !isPortMasterSystem(patch.system)) return false;
    if (this.routeKind() === null && isPortMasterSystem(patch.system)) return false;
    const kind = this.routeKind();
    if ((kind === 'today' || kind === 'week') && !this.isInRecentWindow(patch.updateDate, kind)) return false;
    const tag = this.selectedTag();
    if (tag && !patch.tags.includes(tag)) return false;
    const translatorId = this.selectedTranslatorId();
    if (translatorId && patch.translatorId !== translatorId) return false;
    const system = this.selectedSystem();
    if (system && normalizeBrowseName(patch.system).toLocaleLowerCase('th') !== normalizeBrowseName(system).toLocaleLowerCase('th')) return false;
    const query = this.keyword().trim().toLocaleLowerCase('th');
    if (!query) return true;
    return [patch.gameTitle, patch.patchVersion, patch.system, patch.translatedBy]
      .some((value) => value.trim().toLocaleLowerCase('th').includes(query));
  }).sort((a, b) => {
    const field = this.sortBy();
    if (field === 'playTime') {
      const tierA = typeof a.playTime === 'number' && a.playTime > 0 ? 1 : a.playTime === 0 ? 2 : 3;
      const tierB = typeof b.playTime === 'number' && b.playTime > 0 ? 1 : b.playTime === 0 ? 2 : 3;
      if (tierA !== tierB) return tierA - tierB;
      if (tierA === 1) {
        const diff = (a.playTime! - b.playTime!) * (this.direction() === 'asc' ? 1 : -1);
        if (diff !== 0) return diff;
      }
      return a.gameTitle.localeCompare(b.gameTitle, 'th', { sensitivity: 'base' });
    }
    const primary = field === 'updateDate'
      ? (Number.isNaN(Date.parse(a.updateDate)) ? Number.NEGATIVE_INFINITY : Date.parse(a.updateDate))
      - (Number.isNaN(Date.parse(b.updateDate)) ? Number.NEGATIVE_INFINITY : Date.parse(b.updateDate))
      : a[field].localeCompare(b[field], 'th', { sensitivity: 'base' });
    if (primary !== 0) return primary * (this.direction() === 'asc' ? 1 : -1);
    return a.id.localeCompare(b.id);
  }));
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sortedPatches().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));
  protected readonly paginatedPatches = computed(() => {
    if (this.isPageMode()) {
      const page = Math.min(this.currentPage(), this.totalPages());
      const start = (page - 1) * this.pageSize;
      return this.sortedPatches().slice(start, start + this.pageSize);
    }
    const count = Math.min(this.currentPage() * this.pageSize, this.sortedPatches().length);
    return this.sortedPatches().slice(0, count);
  });
  protected readonly hasMore = computed(() => this.paginatedPatches().length < this.sortedPatches().length);
  protected readonly remainingCount = computed(() => Math.max(0, this.sortedPatches().length - this.paginatedPatches().length));
  protected readonly nextLoadCount = computed(() => Math.min(this.pageSize, this.remainingCount()));
  protected readonly playTimeStats = computed(() => {
    let total = 0;
    let count = 0;
    for (const patch of this.sortedPatches()) {
      if (patch.playTime && patch.playTime > 0) {
        total += patch.playTime;
        count++;
      }
    }
    return {
      formattedDuration: this.formatPlayDuration(total),
      count,
      hasData: count > 0
    };
  });

  private formatPlayDuration(totalHours: number): string {
    if (totalHours <= 0) return '0 ชั่วโมง';

    const hoursInDay = 24;
    const daysInMonth = 30;
    const daysInYear = 365;

    let remaining = totalHours;

    const years = Math.floor(remaining / (daysInYear * hoursInDay));
    remaining %= (daysInYear * hoursInDay);

    const months = Math.floor(remaining / (daysInMonth * hoursInDay));
    remaining %= (daysInMonth * hoursInDay);

    const days = Math.floor(remaining / hoursInDay);
    remaining %= hoursInDay;

    const hours = Number(remaining.toFixed(1));

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0) parts.push(`${days} วัน`);
    if (hours > 0 || parts.length === 0) {
      parts.push(`${hours} ชั่วโมง`);
    }

    return parts.join(' ');
  }
  private readonly paginationClampEffect = effect(() => {
    if (!this.patchesLoaded()) return;
    const lastPage = this.totalPages();
    if (this.currentPage() > lastPage) {
      if (this.isPageMode()) {
        this.setPage(lastPage);
      } else {
        this.currentPage.set(lastPage);
      }
    }
  }, { allowSignalWrites: true });
  private readonly routeFilterEffect = effect(() => {
    const kind = this.routeKind();
    const slug = this.routeSlug();
    if (kind === null) {
      return;
    }
    if (!slug) return;
    const value = decodeURIComponent(slug);
    if (kind === 'system') {
      if (!this.patchesLoaded() || !this.systemsLoaded()) return;
      const master = this.systemMasters().find((system) => normalizeBrowseName(system.shortName) === normalizeBrowseName(value));
      if (!master) return void this.router.navigateByUrl('/');
      this.filterState.selectedSystem.set(master.shortName);
      this.filterState.selectedTranslatorId.set(null);
      this.filterState.selectedTag.set(null);
    } else if (kind === 'translator') {
      if (!this.translatorsLoaded()) return;
      const translator = this.translators().find((item) => normalizeBrowseName(item.shortName) === normalizeBrowseName(value));
      if (!translator) return void this.router.navigateByUrl('/');
      this.filterState.selectedSystem.set(null);
      this.filterState.selectedTranslatorId.set(translator.id);
      this.filterState.selectedTag.set(null);
    } else if (kind === 'tag') {
      if (!this.patchesLoaded() || !this.tagsLoaded()) return;
      const tag = this.tags().find((item) => item.slug === value);
      if (!tag) return void this.router.navigateByUrl('/');
      this.filterState.selectedSystem.set(null);
      this.filterState.selectedTranslatorId.set(null);
      this.filterState.selectedTag.set(tag.id);
    } else if (kind === 'rom' || kind === 'walkthrough' || kind === 'port') {
      this.filterState.selectedSystem.set(null);
      this.filterState.selectedTranslatorId.set(null);
      this.filterState.selectedTag.set(null);
    }
  }, { allowSignalWrites: true });
  private readonly queryTranslatorEffect = effect(() => {
    const queryValue = this.translatorQuery();
    if (!this.translatorsLoaded()) return;
    const normalized = queryValue ? normalizeBrowseName(queryValue).toLocaleLowerCase('th') : '';
    const translator = this.translators().find((item) => normalizeBrowseName(item.shortName).toLocaleLowerCase('th') === normalized);
    this.filterState.selectedTranslatorId.set(translator?.id ?? null);
    this.queryStateReady.set(true);
  }, { allowSignalWrites: true });
  protected setSort(value: GameListSortField): void { this.sortBy.set(value); }
  protected isInRecentWindow(updateDate: string, window: 'today' | 'week'): boolean {
    const timestamp = Date.parse(updateDate);
    const now = Date.now();
    return !Number.isNaN(timestamp)
      && timestamp >= now - (window === 'today' ? BrowsePageComponent.todayWindowMs : BrowsePageComponent.weekWindowMs)
      && timestamp <= now;
  }
  protected toggleDirection(): void { this.direction.update((value) => value === 'asc' ? 'desc' : 'asc'); }
  protected setKeyword(value: string): void { this.keyword.set(value); }
  protected clearKeyword(): void { this.keyword.set(''); }
  protected clearAllFilters(): void {
    this.filterState.clearAll();
    this.currentPage.set(1);
    const targetUrl = this.isPageMode() ? '/page' : '/';
    void this.router.navigateByUrl(targetUrl, { replaceUrl: true });
  }
  protected toggleTag(tag: string): void { this.selectedTag.update((current) => current === tag ? null : tag); this.currentPage.set(1); }
  protected clearTag(): void { this.selectedTag.set(null); this.currentPage.set(1); }
  protected setTranslator(value: string): void { this.selectedTranslatorId.set(value || null); }
  protected setSystem(value: string): void { this.selectedSystem.set(value || null); }
  protected clearSystem(): void { this.selectedSystem.set(null); }
  protected clearTranslator(): void { this.selectedTranslatorId.set(null); }
  protected setFilters(value: import('../models/patch.models').GameListFilters): void { this.keyword.set(value.keyword); this.selectedTag.set(value.tag); this.selectedTranslatorId.set(value.translatorId); this.selectedSystem.set(value.system); this.sortBy.set(value.sortBy); this.direction.set(value.sortDirection); this.currentPage.set(1); }
  protected setPage(page: number): void {
    const nextPage = Math.max(1, Math.min(page, this.totalPages()));
    if (nextPage === this.currentPage()) return;
    this.currentPage.set(nextPage);
    if (this.isPageMode()) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: nextPage > 1 ? nextPage : null },
        queryParamsHandling: 'merge'
      });
    }
    requestAnimationFrame(() => {
      document.querySelector('.browse-route-label')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  protected readonly currentFilterQueryParams = computed(() => {
    const filters = this.filters();
    const translator = this.translators().find((item) => item.id === filters.translatorId)?.shortName || null;
    const params: Record<string, string> = {};
    if (filters.keyword.trim()) params['q'] = filters.keyword.trim();
    if (translator) params['translator'] = translator;
    if (filters.system) params['system'] = filters.system;
    if (filters.sortBy !== 'updateDate') params['sort'] = filters.sortBy;
    if (filters.sortDirection !== 'desc') params['dir'] = filters.sortDirection;
    return params;
  });
  protected switchMode(event: MouseEvent, route: string): void {
    event.preventDefault();
    const scrollY = window.scrollY;
    this.router.navigate([route], { queryParams: this.currentFilterQueryParams() }).then(() => {
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    });
  }
  protected loadMore(): void {
    if (!this.hasMore()) return;
    this.currentPage.update((page) => page + 1);
  }

  protected retry(): void {
    this.loading.set(true);
    this.unavailable.set(false);
    this.loadPatches();
  }
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected updateScrollVisibility(): void {
    this.updateBackToTopVisibility();
  }

  protected updateBackToTopVisibility(): void {
    this.showBackToTop.set(typeof window !== 'undefined' && window.scrollY > 400);
  }

  ngOnInit(): void {
    this.updateScrollVisibility();
  }

  protected backToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  private loadPatches(): void {
    this.patchRepository.watchAll().subscribe({ next: (patches) => { this.patches.set(patches); this.patchesLoaded.set(true); this.loading.set(false); }, error: () => { this.unavailable.set(true); this.loading.set(false); } });
  }
  constructor() {
    this.loadPatches();
    this.systemRepository.watchAll().subscribe({ next: (systems) => { this.systemMasters.set(systems); this.systemsLoaded.set(true); }, error: () => this.unavailable.set(true) });
    this.translatorRepository.watchAll().subscribe({ next: (translators) => { this.translators.set(translators); this.translatorsLoaded.set(true); }, error: () => this.unavailable.set(true) });
    this.tagRepository.watchAll().subscribe({ next: (tags) => { this.tags.set(tags); this.tagsLoaded.set(true); }, error: () => this.unavailable.set(true) });
    this.route.data.subscribe((data) => {
      this.routeKind.set((data['browseKind'] as BrowseRouteKind | undefined) ?? null);
      const pageMode = !!data['pageMode'];
      this.isPageMode.set(pageMode);
      if (pageMode) {
        const pageParam = this.route.snapshot.queryParamMap.get('page');
        const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
        if (Number.isInteger(parsedPage) && parsedPage > 0) {
          this.currentPage.set(parsedPage);
        }
      }
    });
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      this.routeSlug.set(slug);
      if (!slug) return;
      const kind = this.route.snapshot.data['browseKind'] as 'system' | 'translator' | undefined;
      const queryKey = kind === 'system' ? 'system' : kind === 'translator' ? 'translator' : null;
      if (!queryKey || this.route.snapshot.queryParamMap.has(queryKey)) return;
      void this.router.navigate([`/${kind}`], {
        queryParams: { [queryKey]: decodeURIComponent(slug) },
        replaceUrl: true
      });
    });
    this.route.queryParamMap.subscribe((params) => {
      const sort = params.get('sort');
      const direction = params.get('dir');
      this.keyword.set(params.get('q') ?? '');
      this.translatorQuery.set(params.get('translator'));
      this.filterState.selectedSystem.set(params.get('system'));
      this.sortBy.set(sort === 'gameTitle' || sort === 'translatedBy' || sort === 'system' || sort === 'updateDate' || sort === 'playTime' ? sort : 'updateDate');
      this.direction.set(direction === 'asc' ? 'asc' : 'desc');
      if (this.isPageMode()) {
        const pageParam = params.get('page');
        const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
        this.currentPage.set(Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1);
      }
    });
  }
}
