import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AdminPatchPageComponent } from './admin-patch-page.component';
import { TranslatorRepository } from '../repositories/translator.repository';
import { TagRepository } from '../repositories/tag.repository';
import { SystemRepository } from '../repositories/system.repository';
import { PatchRepository } from '../repositories/patch.repository';
import { CoverStorageService } from '../services/cover-storage.service';
import { StatusMessageService } from '../shared/status-message.service';
import { AuthService } from '../services/auth.service';
import { ParamMap, convertToParamMap } from '@angular/router';

/**
 * Bug Condition Exploration Test - Property 1
 *
 * Validates: Requirements 1.1, 1.2
 *
 * EXPECTED: This test FAILS on unfixed code.
 * Failure confirms the bug exists: save() in edit mode does not call
 * router.navigate(['/add-patch'], { replaceUrl: true }) and does not clear editId.
 *
 * Bug condition (isBugCondition):
 *   editId IS NOT NULL AND saveJustCompleted = true
 */
describe('AdminPatchPageComponent - Bug Condition Exploration', () => {
  let component: AdminPatchPageComponent;
  let routerNavigateSpy: jasmine.Spy;
  let routerNavigateByUrlSpy: jasmine.Spy;
  let paramMapSubject: Subject<ParamMap>;

  // Minimal stub for PatchRepository - update() resolves successfully to simulate a successful save
  const patchRepositoryStub = {
    watchAll: () => of([]),
    getById: jasmine.createSpy('getById').and.returnValue(Promise.resolve(undefined)),
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve('new-id')),
    update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
  };

  const translatorRepositoryStub = {
    watchAll: () => of([]),
  };

  const tagRepositoryStub = {
    watchAll: () => of([]),
  };

  const systemRepositoryStub = {
    watchAll: () => of([]),
  };

  const coverStorageStub = {
    upload: jasmine.createSpy('upload').and.returnValue(Promise.resolve('http://cover-url')),
    remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
  };

  const statusMessageStub = {
    show: jasmine.createSpy('show'),
    clear: jasmine.createSpy('clear'),
  };

  beforeEach(async () => {
    // Reset spies between tests
    patchRepositoryStub.update.calls.reset();
    patchRepositoryStub.create.calls.reset();
    statusMessageStub.show.calls.reset();
    statusMessageStub.clear.calls.reset();

    paramMapSubject = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [AdminPatchPageComponent, ReactiveFormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
            navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
          },
        },
        { provide: TranslatorRepository, useValue: translatorRepositoryStub },
        { provide: TagRepository, useValue: tagRepositoryStub },
        { provide: SystemRepository, useValue: systemRepositoryStub },
        { provide: PatchRepository, useValue: patchRepositoryStub },
        { provide: CoverStorageService, useValue: coverStorageStub },
        { provide: StatusMessageService, useValue: statusMessageStub },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            waitForAdminCheck: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminPatchPageComponent);
    component = fixture.componentInstance;

    // Grab the router spy after TestBed is created
    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
    routerNavigateByUrlSpy = TestBed.inject(Router).navigateByUrl as jasmine.Spy;

    // Emit an initial null paramMap so constructor subscription doesn't hang
    paramMapSubject.next(convertToParamMap({}));
    fixture.detectChanges();
  });

  /**
   * Property 1: Bug Condition - URL Not Reset After Save in Edit Mode
   *
   * Validates: Requirements 1.1, 1.2
   *
   * For any non-null patch ID (editId != null) when save() completes successfully,
   * the component SHALL call router.navigateByUrl('/add', { replaceUrl: true })
   * and editId SHALL be null after save completes.
   *
   * EXPECTED TO FAIL on unfixed code - this failure IS the success criterion for Task 1.
   * Counterexamples: router.navigateByUrl not called; editId still 'patch-abc123' after save.
   */
  it('Property 1 (Bug Condition): save() in edit mode should navigate to /add and clear editId', async () => {
    // Use type cast to access protected members from outside the class in tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = component as any;

    // Arrange: simulate edit mode by setting editId to a non-null patch ID
    comp.editId = 'patch-abc123';

    // Fill the form with valid values required to pass the form.invalid guard
    comp.form.controls.updateDate.setValue('2024-01-15T10:00');
    comp.form.controls.gameTitle.setValue('Test Game');
    comp.form.controls.system.setValue('SNES');
    comp.form.controls.translatorId.setValue('translator-001');

    // Act: call save() - it should succeed because patchRepository.update resolves
    await comp.save();

    // Assert 1: router.navigateByUrl('/add', { replaceUrl: true }) must have been called
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/add', { replaceUrl: true });

    // Assert 2: editId must be null after save completes
    expect(comp.editId).toBeNull();
  });
});

/**
 * Preservation Property Tests - Property 2
 *
 * Validates: Requirements 2.3, 3.1, 3.2, 3.3
 *
 * These tests MUST PASS on unfixed code — they establish baseline behavior for all
 * non-buggy inputs (cases where isBugCondition returns false).
 *
 * Covered preservation requirements:
 *  2.3 - save() in add-new mode (editId = null) does NOT navigate — URL stays at /add
 *  3.1 - save() in add-new mode resets form, clears cover, scrolls to top, shows success toast
 *  3.2 - confirmDelete() navigates to '/' via router.navigateByUrl('/', { replaceUrl: true })
 *  3.3 - loadEditRecord(id) with preserveFormOnNextLoad=false populates the form from Firestore
 */
describe('AdminPatchPageComponent - Preservation Properties', () => {
  // -------------------------------------------------------------------------
  // Shared test infrastructure (mirrors the Bug Condition describe block above)
  // -------------------------------------------------------------------------

  let component: AdminPatchPageComponent;
  let routerNavigateSpy: jasmine.Spy;
  let routerNavigateByUrlSpy: jasmine.Spy;
  let paramMapSubject: Subject<ParamMap>;

  const patchRepositoryStub = {
    watchAll: () => of([]),
    getById: jasmine.createSpy('getById').and.returnValue(Promise.resolve(undefined)),
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve('new-id')),
    update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
    delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()),
  };

  const translatorRepositoryStub = { watchAll: () => of([]) };
  const tagRepositoryStub = { watchAll: () => of([]) };
  const systemRepositoryStub = { watchAll: () => of([]) };

  const coverInputSpy = { clear: jasmine.createSpy('clear') };

  const coverStorageStub = {
    upload: jasmine.createSpy('upload').and.returnValue(Promise.resolve('http://cover-url')),
    remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
  };

  const statusMessageStub = { show: jasmine.createSpy('show'), clear: jasmine.createSpy('clear') };

  /** Helper: create a fresh TestBed and return the component instance. */
  async function buildComponent(): Promise<AdminPatchPageComponent> {
    patchRepositoryStub.update.calls.reset();
    patchRepositoryStub.create.calls.reset();
    patchRepositoryStub.delete.calls.reset();
    patchRepositoryStub.getById.calls.reset();
    statusMessageStub.show.calls.reset();
    statusMessageStub.clear.calls.reset();
    coverInputSpy.clear.calls.reset();

    paramMapSubject = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [AdminPatchPageComponent, ReactiveFormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMapSubject.asObservable() },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
            navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
          },
        },
        { provide: TranslatorRepository, useValue: translatorRepositoryStub },
        { provide: TagRepository, useValue: tagRepositoryStub },
        { provide: SystemRepository, useValue: systemRepositoryStub },
        { provide: PatchRepository, useValue: patchRepositoryStub },
        { provide: CoverStorageService, useValue: coverStorageStub },
        { provide: StatusMessageService, useValue: statusMessageStub },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            waitForAdminCheck: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminPatchPageComponent);
    const comp = fixture.componentInstance;

    routerNavigateSpy = TestBed.inject(Router).navigate as jasmine.Spy;
    routerNavigateByUrlSpy = TestBed.inject(Router).navigateByUrl as jasmine.Spy;

    // Inject the CoverInput spy so clear() calls are trackable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (comp as any).coverInput = coverInputSpy;

    // Emit an initial null paramMap so the constructor subscription doesn't hang
    paramMapSubject.next(convertToParamMap({}));
    fixture.detectChanges();

    return comp;
  }

  /** Generator: produce diverse but valid patch IDs (alphanumeric, hyphens, length 1-36). */
  function generatePatchIds(count: number): string[] {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-';
    const ids: string[] = [];
    // Deterministic seed so tests are repeatable
    let seed = 0xdeadbeef;
    const rand = () => { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < count; i++) {
      const len = 4 + Math.floor(rand() * 33); // 4..36
      let id = '';
      for (let j = 0; j < len; j++) id += chars[Math.floor(rand() * chars.length)];
      // Ensure it does not start/end with a hyphen (realistic constraint)
      ids.push(id.replace(/^-+|-+$/g, 'x') || 'patch-id-' + i);
    }
    return ids;
  }

  // -------------------------------------------------------------------------
  // Requirement 2.3 + 3.1 — save() in ADD-NEW mode (editId = null)
  // -------------------------------------------------------------------------

  /**
   * Property 2a (Preservation 2.3): For all valid patch IDs used as form content,
   * save() in add-new mode (editId = null) NEVER calls router.navigate.
   *
   * Validates: Requirement 2.3
   */
  it('Property 2a: save() in add-new mode never calls router.navigate for any form input', async () => {
    // Property-based approach: run the assertion over many distinct form states.
    // The component is fresh each iteration via TestBed.resetTestingModule().
    const sampleGameTitles = [
      'Final Fantasy VI', 'Dragon Quest III', 'Chrono Trigger', 'Zelda', 'Metroid',
      'Super Mario RPG', 'Contra III', 'Mega Man X', 'Street Fighter II', 'Kirby',
    ];

    for (const gameTitle of sampleGameTitles) {
      TestBed.resetTestingModule();
      const comp = await buildComponent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = comp as any;

      // Add-new mode: editId is null (default)
      expect(c.editId).toBeNull();

      c.form.controls.updateDate.setValue('2024-01-15T10:00');
      c.form.controls.gameTitle.setValue(gameTitle);
      c.form.controls.system.setValue('SNES');
      c.form.controls.translatorId.setValue('translator-001');

      await c.save();

      expect(routerNavigateSpy).not.toHaveBeenCalled();
    }
  });

  /**
   * Property 2b (Preservation 3.1): save() in add-new mode resets the form,
   * clears cover, scrolls to top, and shows success toast.
   *
   * Validates: Requirement 3.1
   */
  it('Property 2b: save() in add-new mode resets form, clears cover, scrolls to top, shows success toast', async () => {
    const comp = await buildComponent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = comp as any;

    // Arrange
    c.form.controls.updateDate.setValue('2024-01-15T10:00');
    c.form.controls.gameTitle.setValue('Test Game');
    c.form.controls.system.setValue('SNES');
    c.form.controls.translatorId.setValue('translator-001');

    // Spy on window.scrollTo to verify scroll call
    let scrollCalled = false;
    let scrollOptions: ScrollToOptions | undefined;
    spyOn(window, 'scrollTo').and.callFake((optionsOrX?: ScrollToOptions | number) => {
      scrollCalled = true;
      if (typeof optionsOrX === 'object') scrollOptions = optionsOrX;
    });

    await c.save();

    // Form should be reset: gameTitle cleared
    expect(c.form.controls.gameTitle.value).toBe('');

    // Cover input should be cleared
    expect(coverInputSpy.clear).toHaveBeenCalled();

    // scroll to top called
    expect(scrollCalled).toBeTrue();
    expect(scrollOptions).toEqual({ top: 0, behavior: 'smooth' });

    // Success toast shown
    expect(statusMessageStub.show).toHaveBeenCalledWith('บันทึกแพตช์สำเร็จ', 'success');
  });

  // -------------------------------------------------------------------------
  // Requirement 3.2 — confirmDelete() navigates to '/'
  // -------------------------------------------------------------------------

  /**
   * Property 2c (Preservation 3.2): For all valid patch IDs,
   * confirmDelete() always navigates to '/' via router.navigateByUrl('/', { replaceUrl: true }).
   *
   * Validates: Requirement 3.2
   */
  it('Property 2c: confirmDelete() always navigates to "/" for any non-null editId', async () => {
    const patchIds = generatePatchIds(20);

    for (const patchId of patchIds) {
      TestBed.resetTestingModule();
      const comp = await buildComponent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = comp as any;

      // Arrange: edit mode with this patch ID
      c.editId = patchId;
      c.deleteConfirmOpen = true; // pre-open the confirm dialog

      await c.confirmDelete();

      expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
    }
  });

  // -------------------------------------------------------------------------
  // Requirement 3.3 — loadEditRecord populates form when preserveFormOnNextLoad is false
  // -------------------------------------------------------------------------

  /**
   * Property 2d (Preservation 3.3): loadEditRecord(id) with preserveFormOnNextLoad=false
   * and a valid ID fetches the patch from Firestore and populates the form correctly.
   *
   * Validates: Requirement 3.3
   */
  it('Property 2d: loadEditRecord with a valid ID and preserveFormOnNextLoad=false populates the form', async () => {
    const testPatchId = 'patch-edit-001';
    const mockPatch = {
      gameTitle: 'Chrono Trigger TH',
      system: 'SNES',
      translatorId: 'trans-001',
      patchTool: 'Lunar IPS',
      updateDate: '2023-06-15T00:00:00.000Z',
      haveUpdateFlag: false,
      patchVersion: 'v1.0',
      patchFileUrl: 'https://example.com/patch.ips',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: '',
      coverUrl: '',
      tags: [],
    };

    patchRepositoryStub.getById.and.returnValue(Promise.resolve(mockPatch));

    const comp = await buildComponent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = comp as any;

    // Confirm preserveFormOnNextLoad is false (either field exists and is false,
    // or field doesn't exist yet on unfixed code — both mean "don't skip load")
    expect(c.preserveFormOnNextLoad ?? false).toBeFalsy();

    // Trigger loadEditRecord via paramMap emission (simulating /add-patch/:id navigation)
    paramMapSubject.next(convertToParamMap({ id: testPatchId }));
    // Wait for the async loadEditRecord to complete
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Form should be populated with patch data
    expect(c.form.controls.gameTitle.value).toBe('Chrono Trigger TH');
    expect(c.form.controls.system.value).toBe('SNES');
    expect(c.form.controls.translatorId.value).toBe('trans-001');
    expect(c.editId).toBe(testPatchId);
  });
});

describe('AdminPatchPageComponent - Clipboard Paste', () => {
  let component: AdminPatchPageComponent;
  let fixture: ComponentFixture<AdminPatchPageComponent>;
  let paramMapSubject: Subject<ParamMap>;

  const patchRepositoryStub = {
    watchAll: () => of([]),
    getById: jasmine.createSpy('getById').and.returnValue(Promise.resolve(undefined)),
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve('new-id')),
    update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
  };

  const translatorRepositoryStub = { watchAll: () => of([]) };
  const tagRepositoryStub = { watchAll: () => of([]) };
  const systemRepositoryStub = { watchAll: () => of([]) };
  const coverStorageStub = { upload: jasmine.createSpy('upload'), remove: jasmine.createSpy('remove') };
  const statusMessageStub = {
    show: jasmine.createSpy('show'),
    clear: jasmine.createSpy('clear'),
    message: signal<{ text: string; tone: string } | null>(null),
  };

  beforeEach(async () => {
    statusMessageStub.show.calls.reset();
    statusMessageStub.clear.calls.reset();
    statusMessageStub.message.set(null);
    paramMapSubject = new Subject<ParamMap>();

    await TestBed.configureTestingModule({
      imports: [AdminPatchPageComponent, ReactiveFormsModule],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: paramMapSubject.asObservable() } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') } },
        { provide: TranslatorRepository, useValue: translatorRepositoryStub },
        { provide: TagRepository, useValue: tagRepositoryStub },
        { provide: SystemRepository, useValue: systemRepositoryStub },
        { provide: PatchRepository, useValue: patchRepositoryStub },
        { provide: CoverStorageService, useValue: coverStorageStub },
        { provide: StatusMessageService, useValue: statusMessageStub },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            waitForAdminCheck: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPatchPageComponent);
    component = fixture.componentInstance;
    paramMapSubject.next(convertToParamMap({}));
    fixture.detectChanges();
  });

  it('pastes text from clipboard into patchFileUrl, patchedRomUrl, referenceUrl, and walkthroughUrl', async () => {
    const c = component as any;
    spyOn(navigator.clipboard, 'readText').and.resolveTo('  https://example.com/file.zip  ');

    await c.pasteTo('patchFileUrl');
    expect(c.form.controls.patchFileUrl.value).toBe('https://example.com/file.zip');

    (navigator.clipboard.readText as jasmine.Spy).and.resolveTo('https://example.com/rom.bin');
    await c.pasteTo('patchedRomUrl');
    expect(c.form.controls.patchedRomUrl.value).toBe('https://example.com/rom.bin');

    (navigator.clipboard.readText as jasmine.Spy).and.resolveTo('https://example.com/ref');
    await c.pasteTo('referenceUrl');
    expect(c.form.controls.referenceUrl.value).toBe('https://example.com/ref');

    (navigator.clipboard.readText as jasmine.Spy).and.resolveTo('https://example.com/guide');
    await c.pasteTo('walkthroughUrl');
    expect(c.form.controls.walkthroughUrl.value).toBe('https://example.com/guide');
  });

  it('opens howlongtobeat with query when gameTitle is set', () => {
    const c = component as any;
    spyOn(window, 'open');
    c.form.controls.gameTitle.setValue('gta sa');
    c.openHowLongToBeat();
    expect(window.open).toHaveBeenCalledWith('https://howlongtobeat.com/?q=gta%2520sa', '_blank', 'noopener,noreferrer');
  });

  it('strips colons and hyphens and collapses spaces in howlongtobeat query without mutating form value', () => {
    const c = component as any;
    spyOn(window, 'open');
    c.form.controls.gameTitle.setValue('Final Fantasy VII: Crisis Core - Reunion');
    c.openHowLongToBeat();
    expect(window.open).toHaveBeenCalledWith('https://howlongtobeat.com/?q=Final%2520Fantasy%2520VII%2520Crisis%2520Core%2520Reunion', '_blank', 'noopener,noreferrer');
    expect(c.form.controls.gameTitle.value).toBe('Final Fantasy VII: Crisis Core - Reunion');
  });

  it('opens howlongtobeat home when gameTitle consists only of colons and hyphens', () => {
    const c = component as any;
    spyOn(window, 'open');
    c.form.controls.gameTitle.setValue(':-: - :');
    c.openHowLongToBeat();
    expect(window.open).toHaveBeenCalledWith('https://howlongtobeat.com', '_blank', 'noopener,noreferrer');
  });

  it('opens howlongtobeat home when gameTitle is empty', () => {
    const c = component as any;
    spyOn(window, 'open');
    c.form.controls.gameTitle.setValue('');
    c.openHowLongToBeat();
    expect(window.open).toHaveBeenCalledWith('https://howlongtobeat.com', '_blank', 'noopener,noreferrer');
  });

  it('rejects save when user is not admin', async () => {
    const authService = TestBed.inject(AuthService);
    spyOn(authService, 'isAdmin').and.returnValue(false);
    spyOn(authService, 'waitForAdminCheck').and.resolveTo(false);

    const c = component as any;
    c.form.patchValue({
      gameTitle: 'Test Game',
      system: 'SFC',
      translatorId: 'trans-1',
    });

    await c.save();

    expect(statusMessageStub.show).toHaveBeenCalledWith(
      'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถบันทึกแพตช์ได้',
      'error'
    );
    expect(patchRepositoryStub.create).not.toHaveBeenCalled();
    expect(patchRepositoryStub.update).not.toHaveBeenCalled();
    expect(coverStorageStub.upload).not.toHaveBeenCalled();
  });

  it('rejects delete when user is not admin', async () => {
    const authService = TestBed.inject(AuthService);
    spyOn(authService, 'isAdmin').and.returnValue(false);
    spyOn(authService, 'waitForAdminCheck').and.resolveTo(false);

    const c = component as any;
    c.editId = 'patch-123';
    await c.deletePatch();

    expect(statusMessageStub.show).toHaveBeenCalledWith(
      'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบแพตช์ได้',
      'error'
    );
    expect(c.deleteConfirmOpen).toBeFalse();
  });

  it('renders patchVersion as a textarea element', () => {
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('textarea[formControlName="patchVersion"]');
    expect(textarea).toBeTruthy();
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea.classList.contains('admin-input')).toBeTrue();
  });

  it('renders floating save button by default without scroll dependency', () => {
    fixture.detectChanges();
    const floatingBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.floating-action');
    expect(floatingBtn).toBeTruthy();
  });

  it('renders floating save button and calls save on click', () => {
    fixture.detectChanges();

    const floatingBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('.floating-action');
    expect(floatingBtn).toBeTruthy();
    expect(floatingBtn?.disabled).toBeTrue(); // initially invalid form

    (component as any).form.patchValue({
      gameTitle: 'Test Game',
      system: 'SFC',
      translatorId: 'trans-1',
    });
    fixture.detectChanges();
    expect(floatingBtn?.disabled).toBeFalse();

    spyOn(component as any, 'save');
    floatingBtn?.click();
    expect((component as any).save).toHaveBeenCalled();
  });

  it('scrolls to and focuses playTime when playTime is missing in edit mode', async () => {
    fixture.detectChanges();
    const c = component as any;
    spyOn(c, 'scrollToPlayTime');
    patchRepositoryStub.getById.and.returnValue(Promise.resolve({
      id: 'patch-1',
      gameTitle: 'Dragon Quest',
      system: 'SFC',
      translatorId: 'trans-1',
      updateDate: '2026-01-01T00:00:00.000Z',
      tags: [],
      playTime: null,
      coverUrl: '',
      patchTool: '',
      patchFileUrl: ''
    }));

    await c.loadEditRecord('patch-1');
    expect(c.scrollToPlayTime).toHaveBeenCalled();
  });

  it('does not scroll to playTime when playTime is present in edit mode', async () => {
    fixture.detectChanges();
    const c = component as any;
    spyOn(c, 'scrollToPlayTime');
    patchRepositoryStub.getById.and.returnValue(Promise.resolve({
      id: 'patch-1',
      gameTitle: 'Dragon Quest',
      system: 'SFC',
      translatorId: 'trans-1',
      updateDate: '2026-01-01T00:00:00.000Z',
      tags: [],
      playTime: 25,
      coverUrl: '',
      patchTool: '',
      patchFileUrl: ''
    }));

    await c.loadEditRecord('patch-1');
    expect(c.scrollToPlayTime).not.toHaveBeenCalled();
  });

  it('copies playTime value to playTimeFull when syncPlayTimeFullFromPlayTime is called', () => {
    fixture.detectChanges();
    const c = component as any;
    c.form.controls.playTime.setValue(35.5);
    c.syncPlayTimeFullFromPlayTime();
    expect(c.form.controls.playTimeFull.value).toBe(35.5);

    c.form.controls.playTime.setValue(null);
    c.syncPlayTimeFullFromPlayTime();
    expect(c.form.controls.playTimeFull.value).toBeNull();
  });

  it('loads playTimeFull when present in edit mode', async () => {
    fixture.detectChanges();
    const c = component as any;
    patchRepositoryStub.getById.and.returnValue(Promise.resolve({
      id: 'patch-2',
      gameTitle: 'Final Fantasy VI',
      system: 'SFC',
      translatorId: 'trans-1',
      updateDate: '2026-01-01T00:00:00.000Z',
      tags: [],
      playTime: 30,
      playTimeFull: 60,
      coverUrl: '',
      patchTool: '',
      patchFileUrl: ''
    }));

    await c.loadEditRecord('patch-2');
    expect(c.form.controls.playTimeFull.value).toBe(60);
  });

  it('selects all text when playTimeFull input is focused', () => {
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[formControlName="playTimeFull"]');
    spyOn(input, 'select');
    input.dispatchEvent(new Event('focus'));
    expect(input.select).toHaveBeenCalled();
  });

  it('cancelSave resets saving state and clears status toast', () => {
    fixture.detectChanges();
    const c = component as any;
    c.saving = true;
    c.cancelSave();
    expect(c.saving).toBeFalse();
    expect(statusMessageStub.clear).toHaveBeenCalled();
  });

  it('cancelSave ignores completion of in-flight save operation', async () => {
    fixture.detectChanges();
    const c = component as any;

    let resolveCreate!: (id: string) => void;
    patchRepositoryStub.create.and.returnValue(new Promise<string>((res) => {
      resolveCreate = res;
    }));

    c.form.controls.updateDate.setValue('2026-01-01T00:00');
    c.form.controls.gameTitle.setValue('Test Game');
    c.form.controls.system.setValue('SFC');
    c.form.controls.translatorId.setValue('trans-1');

    const savePromise = c.save();
    expect(c.saving).toBeTrue();

    c.cancelSave();
    expect(c.saving).toBeFalse();
    expect(statusMessageStub.clear).toHaveBeenCalled();

    // Now resolve late in background
    resolveCreate('new-id');
    await savePromise;

    // Must not show success message because save was cancelled
    expect(statusMessageStub.show).not.toHaveBeenCalledWith('บันทึกแพตช์สำเร็จ', 'success');
    expect(c.saving).toBeFalse();
  });

  it('applies floating-action--elevated when hasBottomBanner is true', () => {
    fixture.detectChanges();
    const floatingBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.floating-action');
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeFalse();

    statusMessageStub.message.set({ text: 'กำลังบันทึกแพตช์…', tone: 'info' });
    fixture.detectChanges();
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeTrue();

    statusMessageStub.message.set(null);
    fixture.detectChanges();
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeFalse();
  });

  it('applies floating-action--elevated when offline', () => {
    fixture.detectChanges();
    const floatingBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.floating-action');
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeFalse();

    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeTrue();

    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(floatingBtn.classList.contains('floating-action--elevated')).toBeFalse();
  });
});

