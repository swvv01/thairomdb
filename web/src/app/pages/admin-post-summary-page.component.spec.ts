import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AdminPostSummaryPageComponent, distributeIntoColumns, drawSynthwaveBackground } from './admin-post-summary-page.component';
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
      haveUpdateFlag: false,
      patchVersion: '1.0',
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

  it('should filter patches to default 24 hour range', () => {
    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('📢 อัปเดตเกมแปลไทยวันนี้ 🎮✨');
    expect(text).toContain('(รวมทั้งหมด 2 เกม)');
    expect(text).toContain('Final Fantasy VII [PS1]');
    expect(text).toContain('Chrono Trigger [SNES]');
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
    expect(text).toContain('🕹️ ทีมแปลที่หนึ่ง (1 เกม)');
    expect(text).toContain('🕹️ ทีมแปลที่สอง (1 เกม)');
    expect(text).toContain('#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming');
  });

  it('should include older games when preset 3d or 7d is selected', () => {
    (component as unknown as { setPreset: (p: '3d') => void }).setPreset('3d');
    fixture.detectChanges();

    const text = (component as unknown as { postSummaryText: () => string }).postSummaryText();
    expect(text).toContain('(รวมทั้งหมด 3 เกม)');
    expect(text).toContain('🕹️ ทีมแปลที่หนึ่ง (2 เกม)');
    expect(text).toContain('🕹️ ทีมแปลที่สอง (1 เกม)');
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
    expect(text).toContain('(รวมทั้งหมด 0 เกม)');
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

  it('should handle repository load errors gracefully', () => {
    spyOn(statusMessageService, 'show');
    mockPatchRepo.watchAll.and.returnValue(throwError(() => new Error('Load failed')));

    const newFixture = TestBed.createComponent(AdminPostSummaryPageComponent);
    newFixture.detectChanges();

    expect(statusMessageService.show).toHaveBeenCalledWith('ไม่สามารถโหลดข้อมูลเกมได้', 'error');
  });
});
