import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import {
  AdminPostSummaryPageComponent,
  calculateSquareGridDimensions,
  calculateDiagonalGridCols,
  calculateMasonryColumnCount,
  comparePatchesByNewestAndPriority,
  drawRoundedRect,
  drawBrandingOverlay,
  renderMasonryCollage,
  renderDiagonalCollage,
  drawTiltedTile,
  distributeIntoColumns,
  drawGridBackground,
  drawSynthwaveBackground
} from './admin-post-summary-page.component';
import { PatchRepository } from '../repositories/patch.repository';
import { TranslatorRepository } from '../repositories/translator.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { AuthService } from '../services/auth.service';
import { Patch, Translator } from '../models/patch.models';

describe('AdminPostSummaryPageComponent', () => {
  let component: AdminPostSummaryPageComponent;
  let fixture: ComponentFixture<AdminPostSummaryPageComponent>;
  let statusMessageService: StatusMessageService;

  const mockTranslators: Translator[] = [
    { id: 't1', shortName: 'TN1', name: 'ทีมแปลที่หนึ่ง' },
    { id: 't2', shortName: 'TN2', name: 'ทีมแปลที่สอง' }
  ];

  const now = new Date();
  const mockPatches: Patch[] = [
    {
      id: 'p1',
      updateDate: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      haveUpdateFlag: false,
      patchVersion: '1.0',
      gameTitle: 'Final Fantasy VII',
      system: 'PS1',
      translatorId: 't1',
      translatedBy: 'TN1',
      patchTool: '',
      tags: [],
      coverUrl: 'https://example.com/ff7.png',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    },
    {
      id: 'p2',
      updateDate: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      haveUpdateFlag: true,
      patchVersion: '1.1',
      gameTitle: 'Chrono Trigger',
      system: 'SNES',
      translatorId: 't2',
      translatedBy: 'TN2',
      patchTool: '',
      tags: [],
      coverUrl: '', // No cover
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    },
    {
      id: 'p3',
      updateDate: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
      haveUpdateFlag: false,
      patchVersion: '1.0',
      gameTitle: 'Dragon Quest',
      system: 'NES',
      translatorId: 't1',
      translatedBy: 'TN1',
      patchTool: '',
      tags: [],
      coverUrl: 'https://example.com/dq.png',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    }
  ];

  const mockPatchRepo = {
    watchAll: jasmine.createSpy('watchAll').and.returnValue(of(mockPatches))
  };

  const mockTranslatorRepo = {
    watchAll: jasmine.createSpy('watchAll').and.returnValue(of(mockTranslators))
  };

  const mockAuthService = {
    isAdmin: jasmine.createSpy('isAdmin').and.returnValue(true),
    signOut: jasmine.createSpy('signOut').and.resolveTo()
  };

  const mockRouter = {
    navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true)
  };

  beforeEach(async () => {
    mockPatchRepo.watchAll.and.returnValue(of(mockPatches));
    mockTranslatorRepo.watchAll.and.returnValue(of(mockTranslators));

    await TestBed.configureTestingModule({
      imports: [AdminPostSummaryPageComponent],
      providers: [
        StatusMessageService,
        { provide: PatchRepository, useValue: mockPatchRepo },
        { provide: TranslatorRepository, useValue: mockTranslatorRepo },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPostSummaryPageComponent);
    component = fixture.componentInstance;
    statusMessageService = TestBed.inject(StatusMessageService);
    fixture.detectChanges();
  });

  it('should create component and load initial patches and translators', () => {
    expect(component).toBeTruthy();
    expect(mockPatchRepo.watchAll).toHaveBeenCalled();
    expect(mockTranslatorRepo.watchAll).toHaveBeenCalled();
  });

  it('should distribute items into columns ensuring no column exceeds its left neighbor', () => {
    const items7 = [
      { item: 'Yu-Gi-Oh', height: 438 },
      { item: 'Treasure Hunter', height: 355 },
      { item: 'Getsu Fuma', height: 350 },
      { item: 'Mother 3', height: 250 },
      { item: 'Resident Evil', height: 220 },
      { item: 'Twilight', height: 220 },
      { item: 'Devilman', height: 175 }
    ];
    const cols7 = distributeIntoColumns(items7, 4);
    // Row 0: Yu-Gi-Oh (col 0), Treasure Hunter (col 1), Getsu Fuma (col 2), Mother 3 (col 3)
    // Row 1: Resident Evil (col 0), Twilight (col 1), Devilman (col 2)
    expect(cols7[0]).toEqual(['Yu-Gi-Oh', 'Resident Evil']);
    expect(cols7[1]).toEqual(['Treasure Hunter', 'Twilight']);
    expect(cols7[2]).toEqual(['Getsu Fuma', 'Devilman']);
    expect(cols7[3]).toEqual(['Mother 3']);

    // Check height monotonic decrease from left to right
    const h0 = 438 + 220; // 658
    const h1 = 355 + 220; // 575
    const h2 = 350 + 175; // 525
    const h3 = 250;       // 250
    expect(h0).toBeGreaterThanOrEqual(h1);
    expect(h1).toBeGreaterThanOrEqual(h2);
    expect(h2).toBeGreaterThanOrEqual(h3);

    const items13 = Array.from({ length: 13 }, (_, i) => ({ item: i, height: 200 + i * 20 }));
    const cols13 = distributeIntoColumns(items13, 4);
    // Total items across all 4 columns is 13
    const totalCount = cols13.reduce((sum, col) => sum + col.length, 0);
    expect(totalCount).toBe(13);
  });

  it('should filter patches to default 24 hour range and format summary with emojis and total count', () => {
    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('📢 อัปเดตเกมแปลไทยวันนี้ 2 เกม');
    expect(text).toContain('🌐 รวมเกมแปลไทยทั้งหมดในระบบ 3 เกม');
    expect(text).toContain('- Final Fantasy VII [PS1] ✨');
    expect(text).toContain('- Chrono Trigger [SNES] 🔄');
    expect(text).not.toContain('Dragon Quest [NES]');
    expect(text).not.toContain('เข้าชมและดาวน์โหลด');
  });

  it('should correctly identify patches with covers', () => {
    // Only p1 is in 24h range and has cover
    const withCovers = (component as unknown as { patchesWithCovers: () => Patch[] }).patchesWithCovers();
    expect(withCovers.length).toBe(1);
    expect(withCovers[0].id).toBe('p1');
  });

  it('should group games under the translator full name with game count', () => {
    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('ทีมแปลที่หนึ่ง (1 เกม)');
    expect(text).toContain('ทีมแปลที่สอง (1 เกม)');
    expect(text).not.toContain('🕹️ ทีมแปลที่หนึ่ง');
    expect(text).toContain('#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming');
  });

  it('should include older games when preset 3d or 7d is selected', () => {
    (component as unknown as { setPreset: (p: '3d') => void }).setPreset('3d');
    fixture.detectChanges();

    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('📢 อัปเดตเกมแปลไทยวันนี้ 3 เกม');
    expect(text).toContain('ทีมแปลที่หนึ่ง (2 เกม)');
    expect(text).toContain('ทีมแปลที่สอง (1 เกม)');
    expect(text).toContain('Final Fantasy VII [PS1]');
    expect(text).toContain('Chrono Trigger [SNES]');
    expect(text).toContain('Dragon Quest [NES]');
  });

  it('should reset preview image when filter changes', () => {
    (component as unknown as { previewImageUrl: { set: (v: string | null) => void } }).previewImageUrl.set('data:image/png;base64,mock');
    (component as unknown as { onFromDateChange: (d: string) => void }).onFromDateChange('2026-01-01T00:00');
    expect((component as unknown as { previewImageUrl: () => string | null }).previewImageUrl()).toBeNull();
  });

  it('should show empty message when no games fall in date range', () => {
    (component as unknown as { onFromDateChange: (d: string) => void }).onFromDateChange('2000-01-01T00:00');
    (component as unknown as { onToDateChange: (d: string) => void }).onToDateChange('2000-01-02T00:00');
    fixture.detectChanges();

    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('📢 อัปเดตเกมแปลไทยวันนี้ 0 เกม');
    expect(text).toContain('🌐 รวมเกมแปลไทยทั้งหมดในระบบ 3 เกม');
    expect(text).toContain('(ไม่พบเกมที่อัปเดตในช่วงเวลาดังกล่าว)');
  });

  it('should render synthwave background onto canvas context without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();
    if (ctx) {
      expect(() => drawSynthwaveBackground(ctx, 1024, 700)).not.toThrow();
    }
  });

  it('should render 2D grid background onto canvas context without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();
    if (ctx) {
      expect(() => drawGridBackground(ctx, 1024, 700)).not.toThrow();
    }
  });

  it('should copy text to clipboard and show success toast', async () => {
    spyOn(statusMessageService, 'show');
    if (!navigator.clipboard) {
      (navigator as unknown as { clipboard: { writeText: (text: string) => Promise<void> } }).clipboard = {
        writeText: jasmine.createSpy('writeText').and.resolveTo()
      };
    } else {
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    }

    await (component as unknown as { copyText: () => Promise<void> }).copyText();
    expect(statusMessageService.show).toHaveBeenCalledWith('คัดลอกข้อความสำเร็จ', 'success');
  });

  it('should copy comment link to clipboard and show success toast', async () => {
    spyOn(statusMessageService, 'show');
    if (!navigator.clipboard) {
      (navigator as unknown as { clipboard: { writeText: (text: string) => Promise<void> } }).clipboard = {
        writeText: jasmine.createSpy('writeText').and.resolveTo()
      };
    } else {
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    }

    await (component as unknown as { copyCommentLink: () => Promise<void> }).copyCommentLink();
    expect(statusMessageService.show).toHaveBeenCalledWith('คัดลอกลิงก์สำหรับคอมเมนต์เรียบร้อยแล้ว', 'success');
  });

  it('should calculate square grid dimensions correctly for items plus branding slot', () => {
    // 0 items + 1 branding = 1 slot -> 1x1
    expect(calculateSquareGridDimensions(0)).toEqual({ cols: 1, rows: 1 });
    // 2 items + 1 branding = 3 slots -> 2x2
    expect(calculateSquareGridDimensions(2)).toEqual({ cols: 2, rows: 2 });
    // 8 items + 1 branding = 9 slots -> 3x3
    expect(calculateSquareGridDimensions(8)).toEqual({ cols: 3, rows: 3 });
    // 15 items + 1 branding = 16 slots -> 4x4
    expect(calculateSquareGridDimensions(15)).toEqual({ cols: 4, rows: 4 });
    // 40 items + 1 branding = 41 slots -> 7 cols, 6 rows (almost 1:1)
    expect(calculateSquareGridDimensions(40)).toEqual({ cols: 7, rows: 6 });
  });

  it('should calculate diagonal grid columns correctly', () => {
    // 2 items + 1 branding = 3 -> cols >= 3
    expect(calculateDiagonalGridCols(2)).toBeGreaterThanOrEqual(3);
    // 15 items + 1 branding = 16 -> cols >= 5
    expect(calculateDiagonalGridCols(15)).toBe(5);
  });

  it('should draw tilted tile onto canvas context without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();

    if (ctx) {
      expect(() => {
        drawTiltedTile(ctx, 10, 10, 100, 100, () => {
          ctx.fillRect(10, 10, 100, 100);
        });
      }).not.toThrow();
    }
  });

  it('should calculate masonry grid column count based on items', () => {
    expect(calculateMasonryColumnCount(1)).toBe(1);
    expect(calculateMasonryColumnCount(2)).toBe(2);
    expect(calculateMasonryColumnCount(3)).toBe(2);
    expect(calculateMasonryColumnCount(4)).toBe(3);
    expect(calculateMasonryColumnCount(7)).toBe(3);
    expect(calculateMasonryColumnCount(8)).toBe(4);
    expect(calculateMasonryColumnCount(14)).toBe(4);
    expect(calculateMasonryColumnCount(15)).toBe(5);
    expect(calculateMasonryColumnCount(30)).toBe(5);
  });

  it('should draw rounded rect fallback correctly', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      drawRoundedRect(ctx, 0, 0, 100, 100, 6);
    }).not.toThrow();
  });

  it('should draw branding overlay onto canvas without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      drawBrandingOverlay(ctx, 1024, null);
    }).not.toThrow();
  });

  it('should render masonry collage without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const dummyImg = document.createElement('img');
    const validImages = [
      { patch: mockPatches[0], img: dummyImg },
      { patch: mockPatches[2], img: dummyImg }
    ];
    expect(() => {
      renderMasonryCollage(ctx, 1024, validImages);
    }).not.toThrow();
  });

  it('should render diagonal collage without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const dummyImg = document.createElement('img');
    const validImages = [
      { patch: mockPatches[0], img: dummyImg },
      { patch: mockPatches[2], img: dummyImg }
    ];
    expect(() => {
      renderDiagonalCollage(ctx, 1024, validImages);
    }).not.toThrow();
  });

  it('should default collageMode to masonry and allow switching', () => {
    expect((component as any).collageMode()).toBe('masonry');
    (component as any).setCollageMode('diagonal');
    expect((component as any).collageMode()).toBe('diagonal');
    expect((component as any).previewImageUrl()).toBeNull();

    // Clicking the same mode should be a no-op
    (component as any).setCollageMode('diagonal');
    expect((component as any).collageMode()).toBe('diagonal');
  });

  it('should render collage mode toggle buttons in template', () => {
    const modeButtons = fixture.nativeElement.querySelectorAll('.mode-toggle-btn');
    expect(modeButtons.length).toBe(2);
    expect(modeButtons[0].textContent).toContain('กริด Masonry');
    expect(modeButtons[1].textContent).toContain('ลายเอียง 45°');

    // Default active button should be masonry
    expect(modeButtons[0].classList.contains('mode-toggle-btn--active')).toBeTrue();
    expect(modeButtons[1].classList.contains('mode-toggle-btn--active')).toBeFalse();

    // Click diagonal button
    modeButtons[1].click();
    fixture.detectChanges();

    expect((component as any).collageMode()).toBe('diagonal');
    expect(modeButtons[0].classList.contains('mode-toggle-btn--active')).toBeFalse();
    expect(modeButtons[1].classList.contains('mode-toggle-btn--active')).toBeTrue();
  });

  it('should render masonry collage with explicit columns and handle overflow clipping', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const dummyImg = document.createElement('img');
    dummyImg.width = 200;
    dummyImg.height = 800; // very tall to trigger overflow beyond 1024

    const validImages = [
      { patch: mockPatches[0], img: dummyImg },
      { patch: mockPatches[2], img: dummyImg },
      { patch: mockPatches[0], img: dummyImg },
      { patch: mockPatches[2], img: dummyImg }
    ];

    const stats = renderMasonryCollage(ctx, 1024, validImages, 2);
    expect(stats.fullCount + stats.partialGames.length + stats.omittedGames.length).toBe(4);
    expect(stats.partialGames.length + stats.omittedGames.length).toBeGreaterThan(0);
  });

  it('should display masonry stats and allow toggling affected games', () => {
    (component as any).masonryStats.set({
      fullCount: 2,
      partialGames: [mockPatches[0]],
      omittedGames: [mockPatches[2]]
    });
    (component as any).previewImageUrl.set('data:image/jpeg;base64,mock');
    fixture.detectChanges();

    const statsBox = fixture.nativeElement.querySelector('.masonry-stats-box');
    expect(statsBox).toBeTruthy();

    const pills = fixture.nativeElement.querySelectorAll('.stats-pill');
    expect(pills.length).toBe(3);
    expect(pills[0].textContent).toContain('แสดงเต็ม: 2');
    expect(pills[1].textContent).toContain('ตัดบางส่วน: 1');
    expect(pills[2].textContent).toContain('ไม่ได้แสดงเลย: 1');

    const toggleBtn = fixture.nativeElement.querySelector('.affected-toggle-btn');
    expect(toggleBtn).toBeTruthy();

    // Toggle affected games list
    toggleBtn.click();
    fixture.detectChanges();

    expect((component as any).showAffectedGames()).toBeTrue();
    const affectedGroups = fixture.nativeElement.querySelectorAll('.affected-group');
    expect(affectedGroups.length).toBe(2);

    const affectedItems = fixture.nativeElement.querySelectorAll('.affected-item');
    expect(affectedItems.length).toBe(2);
    expect(affectedItems[0].textContent).toContain('✨');
  });

  it('should manage column adjustments and auto mode correctly', () => {
    // Initially customColumns is null (Auto mode)
    expect((component as any).customColumns()).toBeNull();
    expect((component as any).columnLabel()).toContain('Auto');

    // Incrementing from Auto sets to auto + 1 (or 10 max)
    (component as any).incrementColumns();
    expect((component as any).customColumns()).toBeGreaterThanOrEqual(1);
    expect((component as any).columnLabel()).toContain('คอลัมน์');

    // Increment up to 10
    for (let i = 0; i < 15; i++) {
      (component as any).incrementColumns();
    }
    expect((component as any).customColumns()).toBe(10);

    // Decrement down to 1
    for (let i = 0; i < 9; i++) {
      (component as any).decrementColumns();
    }
    expect((component as any).customColumns()).toBe(1);

    // Decrementing below 1 returns to Auto (null)
    (component as any).decrementColumns();
    expect((component as any).customColumns()).toBeNull();
    expect((component as any).columnLabel()).toContain('Auto');
  });

  it('should show column stepper in masonry mode and hide in diagonal mode', () => {
    // In masonry mode (default), stepper should be rendered
    let stepper = fixture.nativeElement.querySelector('.column-stepper-group');
    expect(stepper).toBeTruthy();

    const stepperBtns = fixture.nativeElement.querySelectorAll('.stepper-btn');
    expect(stepperBtns.length).toBe(2);

    // Click increment
    stepperBtns[1].click();
    fixture.detectChanges();
    expect((component as any).customColumns()).not.toBeNull();

    // Switch to diagonal mode -> stepper should disappear
    (component as any).setCollageMode('diagonal');
    fixture.detectChanges();

    stepper = fixture.nativeElement.querySelector('.column-stepper-group');
    expect(stepper).toBeNull();
  });

  it('should compare patches by new game priority, newest date, and title', () => {
    const newOldDate: Patch = {
      id: 'p-new-old',
      updateDate: '2026-10-01T10:00:00.000Z',
      haveUpdateFlag: false,
      gameTitle: 'Alpha',
      system: 'SNES',
      translatorId: 't1',
      translatedBy: 'T1',
      patchVersion: '1.0',
      patchTool: '',
      tags: [],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    };

    const newRecentDate: Patch = {
      id: 'p-new-recent',
      updateDate: '2026-10-20T10:00:00.000Z',
      haveUpdateFlag: false,
      gameTitle: 'Beta',
      system: 'SNES',
      translatorId: 't1',
      translatedBy: 'T1',
      patchVersion: '1.0',
      patchTool: '',
      tags: [],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    };

    const updateGame: Patch = {
      id: 'p-update',
      updateDate: '2026-10-22T10:00:00.000Z',
      haveUpdateFlag: true,
      gameTitle: 'Zeta',
      system: 'SNES',
      translatorId: 't1',
      translatedBy: 'T1',
      patchVersion: '1.2',
      patchTool: '',
      tags: [],
      coverUrl: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    };

    // New game must come before update game regardless of date
    expect(comparePatchesByNewestAndPriority(newOldDate, updateGame)).toBeLessThan(0);
    expect(comparePatchesByNewestAndPriority(updateGame, newOldDate)).toBeGreaterThan(0);

    // Among new games, newest updateDate must come first
    expect(comparePatchesByNewestAndPriority(newRecentDate, newOldDate)).toBeLessThan(0);
    expect(comparePatchesByNewestAndPriority(newOldDate, newRecentDate)).toBeGreaterThan(0);
  });

  it('should handle repository load errors gracefully', () => {
    spyOn(statusMessageService, 'show');
    mockPatchRepo.watchAll.and.returnValue(throwError(() => new Error('Load failed')));

    const newFixture = TestBed.createComponent(AdminPostSummaryPageComponent);
    newFixture.detectChanges();

    expect(statusMessageService.show).toHaveBeenCalledWith('ไม่สามารถโหลดข้อมูลเกมได้', 'error');
  });

  describe('Cropper & Branding Overlay Workflow', () => {
    it('should open and close cropper modal based on rawBlob state', () => {
      // With no rawBlob, openCropper should do nothing
      (component as any).openCropper();
      expect((component as any).cropperOpen()).toBeFalse();

      // With rawBlob present
      const blob = new Blob(['mock-img'], { type: 'image/jpeg' });
      (component as any).rawBlob.set(blob);
      (component as any).openCropper();
      expect((component as any).cropperOpen()).toBeTrue();

      (component as any).closeCropper();
      expect((component as any).cropperOpen()).toBeFalse();
    });

    it('should update preview image, mark as cropped, and close cropper onCropped', () => {
      const mockResult = {
        blob: new Blob(['cropped-img'], { type: 'image/jpeg' }),
        cropRect: { x: 10, y: 10, width: 100, height: 100 }
      };

      (component as any).cropperOpen.set(true);
      (component as any).onCropped(mockResult);

      expect((component as any).isCropped()).toBeTrue();
      expect((component as any).lastCrop()).toEqual(mockResult.cropRect);
      expect((component as any).cropperOpen()).toBeFalse();
      expect((component as any).previewImageUrl()).toBeTruthy();
    });

    it('should reset to raw image and clear cropped state on resetToOriginal', () => {
      const originalUrl = 'blob:http://localhost/original-image';
      (component as any).rawImageUrl.set(originalUrl);
      (component as any).previewImageUrl.set('blob:http://localhost/cropped-image');
      (component as any).isCropped.set(true);
      (component as any).lastCrop.set({ x: 5, y: 5, width: 50, height: 50 });

      (component as any).resetToOriginal();

      expect((component as any).isCropped()).toBeFalse();
      expect((component as any).lastCrop()).toBeNull();
      expect((component as any).previewImageUrl()).toBe(originalUrl);
    });

    it('should render preview frame with branding overlay when previewImageUrl is present', () => {
      (component as any).previewImageUrl.set('data:image/png;base64,mock');
      fixture.detectChanges();

      const previewFrame = fixture.nativeElement.querySelector('.preview-frame');
      expect(previewFrame).toBeTruthy();

      const overlay = fixture.nativeElement.querySelector('.preview-branding-overlay');
      expect(overlay).toBeTruthy();

      const brandUrl = fixture.nativeElement.querySelector('.overlay-brand-url');
      expect(brandUrl?.textContent).toContain('thairomdb.pages.dev');

      const cropBtns = fixture.nativeElement.querySelectorAll('.crop-btn');
      expect(cropBtns.length).toBeGreaterThan(0);
    });

    it('should show reset crop button when isCropped is true', () => {
      (component as any).previewImageUrl.set('data:image/png;base64,mock');
      (component as any).isCropped.set(false);
      fixture.detectChanges();

      let resetBtn = fixture.nativeElement.querySelector('.reset-crop-btn');
      expect(resetBtn).toBeNull();

      (component as any).isCropped.set(true);
      fixture.detectChanges();

      resetBtn = fixture.nativeElement.querySelector('.reset-crop-btn');
      expect(resetBtn).toBeTruthy();
    });

    it('should render cropper modal when cropperOpen and rawBlob are true', () => {
      (component as any).rawBlob.set(new Blob(['test'], { type: 'image/jpeg' }));
      (component as any).cropperOpen.set(true);
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('app-image-cropper-modal');
      expect(modal).toBeTruthy();
    });

    it('should support drawBrandingOverlay with 1024x1200 dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d')!;

      expect(() => {
        drawBrandingOverlay(ctx, 1024, 1200, null);
      }).not.toThrow();
    });
  });
});
