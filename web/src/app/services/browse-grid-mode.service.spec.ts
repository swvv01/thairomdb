import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { BrowseGridModeService } from './browse-grid-mode.service';

describe('BrowseGridModeService', () => {
  let service: BrowseGridModeService;
  let routerEvents$: Subject<any>;
  let mockRouter: any;

  beforeEach(() => {
    window.localStorage.clear();
    routerEvents$ = new Subject();
    mockRouter = {
      url: '/',
      events: routerEvents$.asObservable()
    };

    TestBed.configureTestingModule({
      providers: [
        BrowseGridModeService,
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(BrowseGridModeService);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('should initialize with grid mode false and recognize home route as game list route', () => {
    expect(service.isGridMode()).toBeFalse();
    expect(service.isGameListRoute()).toBeTrue();
  });

  it('should toggle grid mode', () => {
    service.toggle();
    expect(service.isGridMode()).toBeTrue();
    service.toggle();
    expect(service.isGridMode()).toBeFalse();
  });

  it('should explicitly set grid mode', () => {
    service.setGridMode(true);
    expect(service.isGridMode()).toBeTrue();
    service.setGridMode(false);
    expect(service.isGridMode()).toBeFalse();
  });

  it('should update isGameListRoute on navigation', () => {
    routerEvents$.next(new NavigationEnd(1, '/donate', '/donate'));
    expect(service.isGameListRoute()).toBeFalse();

    routerEvents$.next(new NavigationEnd(2, '/system?system=sfc', '/system?system=sfc'));
    expect(service.isGameListRoute()).toBeTrue();

    routerEvents$.next(new NavigationEnd(3, '/article/some-article', '/article/some-article'));
    expect(service.isGameListRoute()).toBeFalse();

    routerEvents$.next(new NavigationEnd(4, '/port', '/port'));
    expect(service.isGameListRoute()).toBeTrue();
  });

  it('should calculate activeGridMode correctly', () => {
    service.isDesktopOrTablet.set(true);
    service.setGridMode(true);
    routerEvents$.next(new NavigationEnd(1, '/', '/'));
    expect(service.activeGridMode()).toBeTrue();

    routerEvents$.next(new NavigationEnd(2, '/donate', '/donate'));
    expect(service.activeGridMode()).toBeFalse();

    routerEvents$.next(new NavigationEnd(3, '/', '/'));
    service.isDesktopOrTablet.set(false);
    expect(service.activeGridMode()).toBeFalse();
  });

  it('should save grid mode to localStorage when toggling or setting', () => {
    service.toggle();
    expect(window.localStorage.getItem(BrowseGridModeService.storageKey)).toBe('grid');

    service.toggle();
    expect(window.localStorage.getItem(BrowseGridModeService.storageKey)).toBe('list');

    service.setGridMode(true);
    expect(window.localStorage.getItem(BrowseGridModeService.storageKey)).toBe('grid');
  });

  it('should restore grid mode from localStorage on initialization', () => {
    window.localStorage.setItem(BrowseGridModeService.storageKey, 'grid');
    const newService = new BrowseGridModeService();
    expect(newService.isGridMode()).toBeTrue();
    window.localStorage.clear();
  });
});
