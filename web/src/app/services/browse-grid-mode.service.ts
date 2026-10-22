import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BrowseGridModeService {
  private readonly router = inject(Router);

  private readonly browseSegments = new Set([
    '',
    'page',
    'today',
    'new',
    'system',
    'translator',
    'tag',
    'rom',
    'port',
    'walkthrough',
    'guide',
    'library'
  ]);

  public static readonly storageKey = 'thairomdb_browse_grid_mode';

  private static getSavedGridMode(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const saved = window.localStorage.getItem(BrowseGridModeService.storageKey);
      if (saved !== null) {
        return saved === 'grid';
      }
      return true;
    } catch {
      return true;
    }
  }

  private static saveGridMode(isGrid: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BrowseGridModeService.storageKey, isGrid ? 'grid' : 'list');
    } catch {
      // storage can be unavailable
    }
  }

  readonly isGridMode = signal(BrowseGridModeService.getSavedGridMode());
  readonly isGameListRoute = signal(false);
  readonly isDesktopOrTablet = signal(true);

  readonly activeGridMode = computed(() =>
    this.isGridMode() && this.isGameListRoute() && this.isDesktopOrTablet()
  );

  constructor() {
    this.updateRoute(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateRoute(event.urlAfterRedirects || event.url);
      });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(min-width: 480px)');
      this.isDesktopOrTablet.set(mql.matches);
      mql.addEventListener('change', (e) => {
        this.isDesktopOrTablet.set(e.matches);
      });
    }
  }

  toggle(): void {
    this.isGridMode.update((v) => {
      const next = !v;
      BrowseGridModeService.saveGridMode(next);
      return next;
    });
  }

  setGridMode(value: boolean): void {
    this.isGridMode.set(value);
    BrowseGridModeService.saveGridMode(value);
  }

  private updateRoute(url: string): void {
    const cleanUrl = (url || '').split('?')[0].split('#')[0].replace(/^\//, '');
    const firstSegment = cleanUrl.split('/')[0];
    this.isGameListRoute.set(this.browseSegments.has(firstSegment));
  }
}
