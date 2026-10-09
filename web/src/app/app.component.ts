import { AfterViewInit, Component, computed, effect, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

import { StatusMessageService } from './shared/status-message.service';
import { AuthService } from './services/auth.service';
import { Patch, Tag, Translator } from './models/patch.models';
import { SystemMaster, SystemRepository } from './repositories/system.repository';
import { TagRepository } from './repositories/tag.repository';
import { TranslatorRepository } from './repositories/translator.repository';
import { ServerCostRepository } from './repositories/server-cost.repository';
import { BrowseFilterStateService } from './shared/browse-filter-state.service';
import { browseRoute, isPortMasterSystem, normalizeBrowseName } from './shared/browse-route.util';
import { PatchCacheService } from './services/patch-cache.service';
import { PatchRepository } from './repositories/patch.repository';
import { SidebarLink, SidebarLinkSection } from './models/sidebar-link.models';
import { SidebarLinkRepository } from './repositories/sidebar-link.repository';
import { Article } from './models/article.models';
import { ArticleRepository } from './repositories/article.repository';
import { GameLibraryService } from './services/game-library.service';

export type AppTheme = 'default' | 'pocket-pet' | 'classic-blue';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgTemplateOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  protected readonly isDesktop = signal(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1200px)').matches
      : false
  );

  @HostListener('window:resize')
  protected onResize(): void {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.isDesktop.set(window.matchMedia('(min-width: 1200px)').matches);
    }
  }
  private static readonly themeStorageKey = 'rom-collector-theme';
  protected readonly theme = signal<AppTheme>('default');
  private readonly document = inject(DOCUMENT);
  protected readonly statusMessageService = inject(StatusMessageService);
  protected readonly authService = inject(AuthService);
  private readonly tagRepository = inject(TagRepository);
  private readonly translatorRepository = inject(TranslatorRepository);
  private readonly systemRepository = inject(SystemRepository);
  private readonly serverCostRepository = inject(ServerCostRepository);
  private readonly patchCache = inject(PatchCacheService);
  private readonly patchRepository = inject(PatchRepository);
  private readonly sidebarLinkRepository = inject(SidebarLinkRepository);
  private readonly articleRepository = inject(ArticleRepository);
  private readonly router = inject(Router);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  protected readonly libraryService = inject(GameLibraryService);
  protected readonly filterState = inject(BrowseFilterStateService);
  protected readonly statusMessage = this.statusMessageService.message;
  protected readonly platforms = signal<SystemMaster[]>([]);
  protected readonly tags = signal<Tag[]>([]);
  protected readonly sidebarLinks = signal<SidebarLink[]>([]);
  protected readonly translators = signal<Translator[]>([]);
  protected readonly articles = signal<Article[]>([]);
  protected readonly serverCost = signal<number | null>(this.serverCostRepository.getCached());
  protected readonly patches = signal<Patch[]>([]);
  protected readonly patchesLoaded = signal(false);

  private static readonly todayWindowMs = 24 * 60 * 60 * 1000;
  private static readonly weekWindowMs = 7 * 24 * 60 * 60 * 1000;

  protected readonly sidebarPlatforms = computed(() =>
    this.platforms().filter((p) => !isPortMasterSystem(p.shortName) && !isPortMasterSystem(p.name))
  );

  protected readonly patchCounts = computed(() => {
    const list = this.patches();
    const now = Date.now();
    let total = 0;
    let today = 0;
    let week = 0;
    let rom = 0;
    let port = 0;
    let walkthrough = 0;
    let missingPlayTime = 0;
    let missingPlayTimeMax = 0;
    const bySystem: Record<string, number> = {};
    const byTranslator: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    for (const patch of list) {
      const isPortMaster = isPortMasterSystem(patch.system);
      if (isPortMaster) {
        port++;
      } else {
        total++;
        if (patch.playTime == null) {
          missingPlayTime++;
        }
        if (typeof patch.playTime === 'number' && patch.playTime > 0 && patch.playTimeFull == null) {
          missingPlayTimeMax++;
        }
      }

      if (patch.patchedRomUrl?.trim()) rom++;
      if (patch.walkthroughUrl?.trim()) walkthrough++;

      const timestamp = Date.parse(patch.updateDate);
      if (!Number.isNaN(timestamp) && timestamp <= now) {
        if (timestamp >= now - AppComponent.todayWindowMs) today++;
        if (timestamp >= now - AppComponent.weekWindowMs) week++;
      }

      const sysKey = normalizeBrowseName(patch.system).toLocaleLowerCase('th');
      if (sysKey) {
        bySystem[sysKey] = (bySystem[sysKey] ?? 0) + 1;
      }

      if (patch.translatorId) {
        byTranslator[patch.translatorId] = (byTranslator[patch.translatorId] ?? 0) + 1;
      }

      if (Array.isArray(patch.tags)) {
        for (const tagId of patch.tags) {
          if (tagId) {
            byTag[tagId] = (byTag[tagId] ?? 0) + 1;
          }
        }
      }
    }

    return { total, today, week, rom, port, walkthrough, missingPlayTime, missingPlayTimeMax, bySystem, byTranslator, byTag };
  });

  protected systemCount(shortName: string): number {
    const key = normalizeBrowseName(shortName).toLocaleLowerCase('th');
    return this.patchCounts().bySystem[key] ?? 0;
  }

  protected translatorCount(translatorId: string): number {
    return this.patchCounts().byTranslator[translatorId] ?? 0;
  }

  protected tagCount(tagId: string): number {
    return this.patchCounts().byTag[tagId] ?? 0;
  }

  private readonly patchRefreshEffect = effect(() => {
    const req = this.patchCache.refreshRequested();
    if (req > 0) {
      this.loadPatches();
    }
  }, { allowSignalWrites: true });
  private readonly sidebarScrollLock = effect(() => {
    this.document.body.classList.toggle('sidebar-open', this.sidebarOpen());
  });
  protected readonly sidebarOpen = signal(false);
  protected readonly browseRoute = browseRoute;
  protected readonly isOffline = signal(false);
  protected readonly appUpdateReady = signal(false);
  protected readonly updatingApp = signal(false);
  protected readonly refreshingPatches = signal(false);
  protected sidebarLinksFor(section: SidebarLinkSection): SidebarLink[] { return this.sidebarLinks().filter((link) => link.section === section); }
  protected readonly browserInfo = this.getBrowserInfo();
  protected readonly userAgent = typeof navigator === 'undefined' ? 'ไม่ทราบ' : navigator.userAgent;
  protected readonly patchCacheLastUpdated = this.patchCache.lastUpdated;
  protected readonly patchCacheLastUpdatedLabel = () => {
    const timestamp = this.patchCacheLastUpdated();
    return timestamp === null ? 'ยังไม่มีข้อมูล cache' : new Intl.DateTimeFormat('th-TH', {
      timeStyle: 'short'
    }).format(timestamp);
  };

  ngAfterViewInit(): void {
    const adsWindow = window as Window & { adsbygoogle?: unknown[] };
    (adsWindow.adsbygoogle ??= []).push({});
  }

  private getBrowserInfo(): string {
    if (typeof navigator === 'undefined') return 'ไม่ทราบ browser';

    const userAgent = navigator.userAgent;
    const browser = /EdgA|EdgiOS|Edg\//.test(userAgent) ? 'Edge'
      : /CriOS|Chrome\//.test(userAgent) ? 'Chrome'
        : /FxiOS|Firefox\//.test(userAgent) ? 'Firefox'
          : /OPiOS|OPR\//.test(userAgent) ? 'Opera'
            : /Safari\//.test(userAgent) ? 'Safari'
              : 'ไม่ทราบ browser';
    const os = /iPad|iPhone|iPod/.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iOS'
      : /Android/.test(userAgent) ? 'Android'
        : /Windows/.test(userAgent) ? 'Windows'
          : /Mac OS X/.test(userAgent) ? 'macOS'
            : /Linux/.test(userAgent) ? 'Linux'
              : 'ไม่ทราบ OS';

    return `${browser} / ${os}`;
  }
  private readonly onlineHandler = () => {
    this.isOffline.set(false);
    this.loadServerCost();
  };
  private readonly offlineHandler = () => this.isOffline.set(true);

  protected toggleSidebar(): void { this.sidebarOpen.update((open) => !open); }
  protected closeSidebar(): void { this.sidebarOpen.set(false); }
  protected clearAllFilters(): void {
    this.filterState.clearAll();
    this.closeSidebar();
  }
  protected selectPlatform(platform: string | null): void {
    this.filterState.selectedSystem.set(platform);
    this.filterState.selectedTranslatorId.set(null);
    this.filterState.selectedTag.set(null);
    this.closeSidebar();
  }
  protected selectTranslator(translatorId: string | null): void {
    this.filterState.selectedTranslatorId.set(translatorId);
    this.filterState.selectedSystem.set(null);
    this.filterState.selectedTag.set(null);
    this.closeSidebar();
  }
  protected selectRouteTag(tagId: string): void {
    this.filterState.selectedTag.set(tagId);
    this.filterState.selectedSystem.set(null);
    this.filterState.selectedTranslatorId.set(null);
    this.closeSidebar();
  }
  protected async forceRefreshPatches(): Promise<void> {
    if (this.refreshingPatches()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.statusMessageService.show('ไม่สามารถดึงข้อมูลล่าสุดได้ขณะออฟไลน์', 'error');
      return;
    }
    this.refreshingPatches.set(true);
    this.statusMessageService.show('กำลังดึงข้อมูลล่าสุด...', 'info', false);
    try {
      this.patchCache.requestForceRefresh();
      this.tagRepository.refreshAll();
      this.translatorRepository.refreshAll();
      this.systemRepository.refreshAll();
      this.articleRepository.refreshAll();
      await this.libraryService.refreshFromRemote();
      const patches = await firstValueFrom(this.patchRepository.watchAll());
      this.patches.set(patches);
      this.patchesLoaded.set(true);
      this.loadServerCost();
      this.statusMessageService.show('รีเฟรชข้อมูลล่าสุดเรียบร้อยแล้ว', 'success');
    } catch {
      this.statusMessageService.show('ไม่สามารถดึงข้อมูลล่าสุดได้ กรุณาตรวจสอบการเชื่อมต่อ', 'error');
    } finally {
      this.refreshingPatches.set(false);
      this.closeSidebar();
    }
  }

  private loadPatches(): void {
    this.patchRepository.watchAll().subscribe({
      next: (patches) => {
        this.patches.set(patches);
        this.patchesLoaded.set(true);
      },
      error: () => {
        this.statusMessageService.show('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือปิดตัวบล็อกโฆษณา', 'error', false);
      }
    });
  }

  private loadServerCost(): void {
    this.serverCostRepository.read()
      .then((cost) => this.serverCost.set(cost))
      .catch(() => {
        const cached = this.serverCostRepository.getCached();
        if (cached !== null) this.serverCost.set(cached);
      });
  }

  constructor() {
    this.restoreTheme();
    this.isOffline.set(typeof navigator !== 'undefined' && !navigator.onLine);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.watchForAppUpdates();
    let lastPath = '';
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart && !this.appUpdateReady()) {
        this.statusMessageService.clear();
      }
      if (event instanceof NavigationEnd) {
        const currentPath = event.urlAfterRedirects.split('?')[0];
        if (lastPath && lastPath !== currentPath) {
          window.scrollTo(0, 0);
        }
        lastPath = currentPath;
      }
    });
    this.loadPatches();
    this.tagRepository.watchAll().subscribe({ next: (tags) => this.tags.set(tags) });
    this.sidebarLinkRepository.watchAll().subscribe({ next: (links) => this.sidebarLinks.set(links) });
    this.translatorRepository.watchAll().subscribe({ next: (translators) => this.translators.set(translators) });
    this.systemRepository.watchAll().subscribe({ next: (systems) => this.platforms.set(systems) });
    this.articleRepository.watchAll().subscribe({ next: (articles) => this.articles.set(articles) });
    this.loadServerCost();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.document.body.classList.remove('sidebar-open');
    this.sidebarScrollLock.destroy();
  }

  private watchForAppUpdates(): void {
    if (!this.swUpdate?.isEnabled) return;
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.appUpdateReady.set(true);
        this.statusMessageService.show('มีเวอร์ชันใหม่พร้อมใช้งาน กดอัปเดตเมื่อสะดวก', 'info', false);
      }
    });
  }

  protected toggleTheme(): void {
    const current = this.theme();
    const nextTheme: AppTheme =
      current === 'default' ? 'pocket-pet' : current === 'pocket-pet' ? 'classic-blue' : 'default';
    this.applyTheme(nextTheme);
  }

  protected selectTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppTheme;
    if (value === this.theme()) return;
    this.applyTheme(value);
  }

  private applyTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.document.body.dataset['theme'] = theme === 'default' ? '' : theme;
    try { window.localStorage.setItem(AppComponent.themeStorageKey, theme); } catch { /* storage can be unavailable */ }
  }

  private restoreTheme(): void {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem(AppComponent.themeStorageKey); } catch { /* storage can be unavailable */ }
    const theme: AppTheme =
      savedTheme === 'pocket-pet' || savedTheme === 'classic-blue' ? savedTheme : 'default';
    this.theme.set(theme);
    if (theme !== 'default') this.document.body.dataset['theme'] = theme;
  }

  protected dismissStatusMessage(): void {
    this.appUpdateReady.set(false);
    this.statusMessageService.clear();
  }

  protected async updateApp(): Promise<void> {
    if (!this.swUpdate?.isEnabled || this.updatingApp()) return;
    this.updatingApp.set(true);
    this.statusMessageService.show('กำลังอัปเดต...', 'info', false);
    try {
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch {
      this.updatingApp.set(false);
      this.statusMessageService.show('ไม่สามารถอัปเดตได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  protected async signIn(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
      this.statusMessageService.show('เข้าสู่ระบบแล้ว กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ');
    } catch {
      this.statusMessageService.show('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    this.statusMessageService.show('ออกจากระบบแล้ว');
  }
}
