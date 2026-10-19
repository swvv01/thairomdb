import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { StatusMessageService } from './shared/status-message.service';
import { TagRepository } from './repositories/tag.repository';
import { TranslatorRepository } from './repositories/translator.repository';
import { SystemRepository } from './repositories/system.repository';
import { ServerCostRepository } from './repositories/server-cost.repository';
import { PatchCacheService } from './services/patch-cache.service';
import { PatchRepository } from './repositories/patch.repository';
import { SidebarLinkRepository } from './repositories/sidebar-link.repository';
import { ArticleRepository } from './repositories/article.repository';
import { GameLibraryService } from './services/game-library.service';
import { Patch } from './models/patch.models';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;

  const mockPatches: Patch[] = [
    {
      id: 'p1',
      updateDate: new Date().toISOString(),
      haveUpdateFlag: false,
      patchVersion: '1.0',
      gameTitle: 'Chrono Trigger',
      system: 'SFC',
      translatorId: 'trans1',
      translatedBy: 'G-Translators',
      patchTool: '',
      tags: ['tag1'],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: 'https://rom.zip',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: 'https://guide.html'
    },
    {
      id: 'p2',
      updateDate: '2020-01-01T00:00:00.000Z',
      haveUpdateFlag: false,
      patchVersion: '1.0',
      gameTitle: 'Final Fantasy VI',
      system: 'SFC',
      translatorId: 'trans1',
      translatedBy: 'G-Translators',
      patchTool: '',
      tags: ['tag1'],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    },
    {
      id: 'p3',
      updateDate: '2020-01-02T00:00:00.000Z',
      haveUpdateFlag: false,
      patchVersion: '1.0',
      gameTitle: 'Celeste',
      system: 'PortMaster',
      translatorId: 'trans1',
      translatedBy: 'G-Translators',
      patchTool: '',
      tags: ['tag1'],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    },
    {
      id: 'p4',
      updateDate: '2020-01-03T00:00:00.000Z',
      haveUpdateFlag: false,
      patchVersion: '1.1',
      gameTitle: 'Grand Theft Auto: San Andreas',
      system: 'PORT',
      translatorId: 'trans1',
      translatedBy: 'G-Translators',
      patchTool: '',
      tags: ['tag1'],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal(null),
            isAdmin: signal(false),
            isVip: signal(false)
          }
        },
        {
          provide: StatusMessageService,
          useValue: {
            message: signal(null),
            show: jasmine.createSpy('show'),
            clear: jasmine.createSpy('clear')
          }
        },
        {
          provide: TagRepository,
          useValue: {
            watchAll: () => of([
              { id: 'tag1', name: 'RPG', slug: 'rpg' },
              { id: 'tag2', name: 'Action', slug: 'action' }
            ]),
            refreshAll: jasmine.createSpy('refreshAll')
          }
        },
        {
          provide: TranslatorRepository,
          useValue: {
            watchAll: () => of([
              { id: 'trans1', shortName: 'G-Trans', name: 'G-Translators' },
              { id: 'trans2', shortName: 'Solo', name: 'Solo Translators' }
            ]),
            refreshAll: jasmine.createSpy('refreshAll')
          }
        },
        {
          provide: SystemRepository,
          useValue: {
            watchAll: () => of([
              { id: 'sys1', shortName: 'SFC', name: 'Super Famicom' },
              { id: 'sys2', shortName: 'PortMaster', name: 'PortMaster' },
              { id: 'sys3', shortName: 'PORT', name: 'PortMaster' },
              { id: 'sys4', shortName: 'GBA', name: 'Game Boy Advance' }
            ]),
            refreshAll: jasmine.createSpy('refreshAll')
          }
        },
        {
          provide: SidebarLinkRepository,
          useValue: {
            watchAll: () => of([])
          }
        },
        {
          provide: ArticleRepository,
          useValue: {
            watchAll: () => of([{ id: 'art1', title: 'คู่มือการเล่น', slug: 'guide-1', status: 'published' }]),
            refreshAll: jasmine.createSpy('refreshAll')
          }
        },
        {
          provide: ServerCostRepository,
          useValue: {
            read: () => Promise.resolve(null),
            getCached: () => null
          }
        },
        {
          provide: PatchCacheService,
          useValue: {
            lastUpdated: () => null,
            refreshRequested: signal(0),
            requestForceRefresh: jasmine.createSpy('requestForceRefresh'),
            clearAll: jasmine.createSpy('clearAll')
          }
        },
        {
          provide: GameLibraryService,
          useValue: {
            libraryCount: signal(0),
            refreshFromRemote: jasmine.createSpy('refreshFromRemote').and.returnValue(Promise.resolve())
          }
        },
        {
          provide: PatchRepository,
          useValue: {
            watchAll: () => of(mockPatches)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(app).toBeTruthy();
  });

  it('should calculate patch counts accurately', () => {
    const counts = (app as unknown as {
      patchCounts: () => {
        total: number;
        today: number;
        week: number;
        rom: number;
        port: number;
        walkthrough: number;
        missingPlayTime: number;
        missingPlayTimeMax: number;
        bySystem: Record<string, number>;
        byTranslator: Record<string, number>;
        byTag: Record<string, number>;
      }
    }).patchCounts();

    expect(counts.total).toBe(2);
    expect(counts.port).toBe(2);
    expect(counts.today).toBe(1);
    expect(counts.week).toBe(1);
    expect(counts.rom).toBe(1);
    expect(counts.walkthrough).toBe(1);
    expect(counts.missingPlayTime).toBe(2);
    expect(counts.missingPlayTimeMax).toBe(0);
    expect(counts.bySystem['sfc']).toBe(2);
    expect(counts.bySystem['portmaster']).toBe(1);
    expect(counts.bySystem['port']).toBe(1);
    expect(counts.byTranslator['trans1']).toBe(4);
    expect(counts.byTag['tag1']).toBe(4);
  });

  it('should render counts in sidebar links and exclude PortMaster from systems list', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('เกมทั้งหมด (2)');
    expect(text).toContain('Port Master (2)');
    expect(text).toContain('รอมแปลไทย (1)');
    expect(text).toContain('บทสรุป (1)');

    const platforms = (app as unknown as { sidebarPlatforms: () => Array<{ shortName: string }> }).sidebarPlatforms();
    expect(platforms.map((p) => p.shortName)).toEqual(['SFC']);
    expect(platforms.some((p) => p.shortName === 'PortMaster' || p.shortName === 'PORT')).toBeFalse();
  });

  it('should exclude systems, translators, and tags with 0 games from sidebar when patches are loaded', () => {
    expect((app as any).patchesLoaded()).toBeTrue();
    const platforms = (app as any).sidebarPlatforms();
    expect(platforms.some((p: any) => p.shortName === 'GBA')).toBeFalse();
    expect(platforms.some((p: any) => p.shortName === 'SFC')).toBeTrue();

    const translators = (app as any).sidebarTranslators();
    expect(translators.some((t: any) => t.id === 'trans2')).toBeFalse();
    expect(translators.some((t: any) => t.id === 'trans1')).toBeTrue();

    const tags = (app as any).sidebarTags();
    expect(tags.some((t: any) => t.id === 'tag2')).toBeFalse();
    expect(tags.some((t: any) => t.id === 'tag1')).toBeTrue();
  });

  it('should show all systems, translators, and tags when patches are not yet loaded', () => {
    (app as any).patchesLoaded.set(false);

    const platforms = (app as any).sidebarPlatforms();
    expect(platforms.some((p: any) => p.shortName === 'GBA')).toBeTrue();
    expect(platforms.some((p: any) => p.shortName === 'SFC')).toBeTrue();

    const translators = (app as any).sidebarTranslators();
    expect(translators.some((t: any) => t.id === 'trans2')).toBeTrue();

    const tags = (app as any).sidebarTags();
    expect(tags.some((t: any) => t.id === 'tag2')).toBeTrue();
  });

  it('should render published articles in sidebar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('คู่มือการเล่น');
  });

  it('should render secondary sections in left sidebar when not desktop', () => {
    const isDesktopSignal = (app as unknown as { isDesktop: { set: (val: boolean) => void } }).isDesktop;
    isDesktopSignal.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const leftHitCounter = compiled.querySelector('#system-sidebar .hit-counter');
    const rightHitCounter = compiled.querySelector('.right-ad-sidebar .hit-counter');

    expect(leftHitCounter).toBeTruthy();
    expect(rightHitCounter).toBeNull();
  });

  it('should render secondary sections in right sidebar when desktop', () => {
    const isDesktopSignal = (app as unknown as { isDesktop: { set: (val: boolean) => void } }).isDesktop;
    isDesktopSignal.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const leftHitCounter = compiled.querySelector('#system-sidebar .hit-counter');
    const rightHitCounter = compiled.querySelector('.right-ad-sidebar .hit-counter');

    expect(leftHitCounter).toBeNull();
    expect(rightHitCounter).toBeTruthy();
  });

  it('should support switching to classic-blue theme and cycling themes', () => {
    const themeSignal = (app as unknown as { theme: () => string }).theme;
    const toggleTheme = (app as unknown as { toggleTheme: () => void }).toggleTheme.bind(app);
    const selectTheme = (app as unknown as { selectTheme: (e: Event) => void }).selectTheme.bind(app);

    expect(themeSignal()).toBe('default');

    // Toggle: default -> pocket-pet -> classic-blue -> default
    toggleTheme();
    expect(themeSignal()).toBe('pocket-pet');
    expect(document.body.dataset['theme']).toBe('pocket-pet');

    toggleTheme();
    expect(themeSignal()).toBe('classic-blue');
    expect(document.body.dataset['theme']).toBe('classic-blue');

    toggleTheme();
    expect(themeSignal()).toBe('default');
    expect(document.body.dataset['theme']).toBe('');

    // Select theme directly
    selectTheme({ target: { value: 'classic-blue' } } as unknown as Event);
    expect(themeSignal()).toBe('classic-blue');
    expect(document.body.dataset['theme']).toBe('classic-blue');

    // Clean up
    selectTheme({ target: { value: 'default' } } as unknown as Event);
  });

  it('should render admin playTime status links when user is admin', () => {
    const authService = TestBed.inject(AuthService);
    (authService.isAdmin as any).set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('ยังไม่ระบุเวลาเล่น');
    expect(text).toContain('ยังไม่ระบุเวลาเล่นสูงสุด');
    expect(text).toContain('(2)');
    expect(text).toContain('(0)');
  });

  it('should render action button when status message has an action', () => {
    const statusService = TestBed.inject(StatusMessageService);
    let clicked = false;
    (statusService.message as any).set({
      text: 'ทดสอบการดำเนินการ',
      tone: 'info',
      action: {
        label: 'ลองใหม่',
        onClick: () => { clicked = true; }
      }
    });
    fixture.detectChanges();

    const actionBtn = fixture.nativeElement.querySelector('.status-message-action');
    expect(actionBtn).toBeTruthy();
    expect(actionBtn.textContent.trim()).toBe('ลองใหม่');
    actionBtn.click();
    expect(clicked).toBe(true);

    const closeBtn = fixture.nativeElement.querySelector('.status-message-close');
    expect(closeBtn).toBeTruthy();
  });

  it('should render user pull latest data button in sidebar for all users', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('.first-section .retro-rail-link'));
    const refreshLink = links.find((link) => link.textContent?.includes('ดึงข้อมูลล่าสุด'));
    expect(refreshLink).toBeTruthy();
  });

  it('should clear local cache, refresh repositories, and show success toast when refreshUserCache is called', async () => {
    const patchCache = TestBed.inject(PatchCacheService);
    const tagRepo = TestBed.inject(TagRepository);
    const transRepo = TestBed.inject(TranslatorRepository);
    const sysRepo = TestBed.inject(SystemRepository);
    const statusService = TestBed.inject(StatusMessageService);

    await (app as any).refreshUserCache();

    expect(patchCache.clearAll).toHaveBeenCalled();
    expect(patchCache.requestForceRefresh).toHaveBeenCalled();
    expect(tagRepo.refreshAll).toHaveBeenCalled();
    expect(transRepo.refreshAll).toHaveBeenCalled();
    expect(sysRepo.refreshAll).toHaveBeenCalled();
    expect(statusService.show).toHaveBeenCalledWith('ดึงข้อมูลล่าสุดเรียบร้อยแล้ว', 'success');
  });

  it('should render syncEdgeData button for admin and trigger sync successfully', async () => {
    const authService = TestBed.inject(AuthService);
    (authService.isAdmin as any).set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('ซิงค์ข้อมูล Edge');

    const statusService = TestBed.inject(StatusMessageService);
    const patchCache = TestBed.inject(PatchCacheService);

    await (app as any).syncEdgeData();

    expect(patchCache.requestForceRefresh).toHaveBeenCalled();
    expect(statusService.show).toHaveBeenCalledWith('ซิงค์ข้อมูล Edge เรียบร้อยแล้ว', 'success');
  });
});
