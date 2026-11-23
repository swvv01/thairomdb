import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminTranslatorsPageComponent } from './admin-translators-page.component';
import { TranslatorRepository } from '../repositories/translator.repository';
import { PatchRepository } from '../repositories/patch.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Patch } from '../models/patch.models';

describe('AdminTranslatorsPageComponent', () => {
  let fixture: ComponentFixture<AdminTranslatorsPageComponent>;
  let component: AdminTranslatorsPageComponent;
  let mockRepo: jasmine.SpyObj<TranslatorRepository>;
  let mockPatchRepo: jasmine.SpyObj<PatchRepository>;
  let mockStatus: jasmine.SpyObj<StatusMessageService>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockRepo = jasmine.createSpyObj<TranslatorRepository>('TranslatorRepository', [
      'watchDirectAll',
      'create',
      'update',
      'delete'
    ]);
    mockRepo.watchDirectAll.and.returnValue(
      of([
        { id: 't1', shortName: 'G-Trans', name: 'G-Translators' },
        { id: 't2', shortName: 'Solo', name: 'Solo Translators' }
      ])
    );

    mockPatchRepo = jasmine.createSpyObj<PatchRepository>('PatchRepository', [
      'watchAll',
      'batchUpdatePatchToolByTranslator'
    ]);
    mockPatchRepo.watchAll.and.returnValue(of([]));

    mockStatus = jasmine.createSpyObj<StatusMessageService>('StatusMessageService', ['show', 'clear']);
    mockAuth = jasmine.createSpyObj<AuthService>('AuthService', ['signOut']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [AdminTranslatorsPageComponent],
      providers: [
        { provide: TranslatorRepository, useValue: mockRepo },
        { provide: PatchRepository, useValue: mockPatchRepo },
        { provide: StatusMessageService, useValue: mockStatus },
        { provide: AuthService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { has: () => false, get: () => null } },
            queryParamMap: of({ get: () => null })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTranslatorsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders translator items correctly', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('G-Trans - G-Translators');
    expect(text).toContain('Solo - Solo Translators');
  });

  it('shows error if saving with empty names', async () => {
    (component as any).shortName = '';
    (component as any).name = '';
    await (component as any).save();

    expect(mockStatus.show).toHaveBeenCalledWith('กรุณาระบุชื่อย่อและชื่อเต็มของทีมแปล', 'error');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('creates new translator with edge sync success', async () => {
    mockRepo.create.and.resolveTo({
      data: { id: 't3', shortName: 'New', name: 'New Team' },
      edgeSynced: true
    });
    (component as any).id = null;
    (component as any).shortName = 'New';
    (component as any).name = 'New Team';

    await (component as any).save();

    expect(mockRepo.create).toHaveBeenCalledWith('New', 'New Team', '', '', true);
    expect(mockStatus.show).toHaveBeenCalledWith('เพิ่มทีมแปลสำเร็จ', 'success');
  });

  it('shows info warning if creating translator succeeds but edge sync fails', async () => {
    mockRepo.create.and.resolveTo({
      data: { id: 't3', shortName: 'New', name: 'New Team' },
      edgeSynced: false
    });
    (component as any).id = null;
    (component as any).shortName = 'New';
    (component as any).name = 'New Team';

    await (component as any).save();

    expect(mockRepo.create).toHaveBeenCalledWith('New', 'New Team', '', '', true);
    expect(mockStatus.show).toHaveBeenCalledWith(
      'เพิ่มทีมแปลสำเร็จ แต่ซิงค์ Edge ไม่สำเร็จ กรุณากดปุ่ม \'ซิงค์ข้อมูล Edge\' ที่แถบเมนูด้านข้าง',
      'info'
    );
  });

  it('updates existing translator with edge sync feedback', async () => {
    mockRepo.update.and.resolveTo({
      data: { id: 't1', shortName: 'G-Trans', name: 'G-Translators Updated' },
      edgeSynced: true
    });
    (component as any).id = 't1';
    (component as any).shortName = 'G-Trans';
    (component as any).name = 'G-Translators Updated';

    await (component as any).save();

    expect(mockRepo.update).toHaveBeenCalledWith('t1', 'G-Trans', 'G-Translators Updated', '', '', true);
    expect(mockStatus.show).toHaveBeenCalledWith('แก้ไขทีมแปลสำเร็จ', 'success');
  });

  it('deletes translator with edge sync feedback when confirmed', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockRepo.delete.and.resolveTo({ edgeSynced: true });

    const item = { id: 't1', shortName: 'G-Trans', name: 'G-Translators' };
    await (component as any).remove(item);

    expect(mockRepo.delete).toHaveBeenCalledWith('t1');
    expect(mockStatus.show).toHaveBeenCalledWith('ลบทีมแปลสำเร็จ', 'success');
  });

  describe('syncPatchToolToAllGames', () => {
    it('does nothing if modTool is empty or only whitespace', async () => {
      (component as any).id = 't1';
      (component as any).modTool = '   ';

      await (component as any).syncPatchToolToAllGames();

      expect(mockStatus.show).toHaveBeenCalledWith('กรุณาระบุ Mod tool ก่อนซิงค์', 'error');
      expect(mockPatchRepo.batchUpdatePatchToolByTranslator).not.toHaveBeenCalled();
    });

    it('shows info message when no matching games are found', async () => {
      mockPatchRepo.watchAll.and.returnValue(of([]));
      (component as any).id = 't1';
      (component as any).modTool = 'https://new-patcher.example.com';

      await (component as any).syncPatchToolToAllGames();

      expect(mockStatus.show).toHaveBeenCalledWith('กำลังตรวจสอบข้อมูลเกม…');
      expect(mockStatus.show).toHaveBeenCalledWith('ไม่พบเกมของทีมแปลนี้ในระบบ', 'info');
      expect(mockPatchRepo.batchUpdatePatchToolByTranslator).not.toHaveBeenCalled();
    });

    it('cancels sync if window.confirm is rejected by user', async () => {
      const mockPatches = [
        { id: 'p1', translatorId: 't1', gameTitle: 'Game 1' } as Patch
      ];
      mockPatchRepo.watchAll.and.returnValue(of(mockPatches));
      spyOn(window, 'confirm').and.returnValue(false);

      (component as any).id = 't1';
      (component as any).shortName = 'G-Trans';
      (component as any).name = 'G-Translators';
      (component as any).modTool = 'https://new-patcher.example.com';

      await (component as any).syncPatchToolToAllGames();

      expect(window.confirm).toHaveBeenCalledWith(
        'ยืนยันอัปเดต Patch Tool เป็น "https://new-patcher.example.com" สำหรับทุกเกมของ G-Trans - G-Translators (พบ 1 เกม) หรือไม่?'
      );
      expect(mockStatus.clear).toHaveBeenCalled();
      expect(mockPatchRepo.batchUpdatePatchToolByTranslator).not.toHaveBeenCalled();
    });

    it('updates translator and batch updates patches when confirmed', async () => {
      const mockPatches = [
        { id: 'p1', translatorId: 't1', gameTitle: 'Game 1' } as Patch,
        { id: 'p2', translatorId: 't1', gameTitle: 'Game 2' } as Patch
      ];
      mockPatchRepo.watchAll.and.returnValue(of(mockPatches));
      spyOn(window, 'confirm').and.returnValue(true);
      mockRepo.update.and.resolveTo({
        data: { id: 't1', shortName: 'G-Trans', name: 'G-Translators', modTool: 'https://new-patcher.example.com' },
        edgeSynced: true
      });
      mockPatchRepo.batchUpdatePatchToolByTranslator.and.resolveTo({
        count: 2,
        edgeSynced: true
      });

      (component as any).id = 't1';
      (component as any).shortName = 'G-Trans';
      (component as any).name = 'G-Translators';
      (component as any).modTool = 'https://new-patcher.example.com';

      await (component as any).syncPatchToolToAllGames();

      expect(mockRepo.update).toHaveBeenCalledWith('t1', 'G-Trans', 'G-Translators', '', 'https://new-patcher.example.com', true);
      expect(mockPatchRepo.batchUpdatePatchToolByTranslator).toHaveBeenCalledWith('t1', 'https://new-patcher.example.com');
      expect(mockStatus.show).toHaveBeenCalledWith('อัปเดต Patch Tool ทั้งหมด 2 เกมสำเร็จ', 'success');
    });

    it('shows info warning if edge sync fails during batch update', async () => {
      const mockPatches = [
        { id: 'p1', translatorId: 't1', gameTitle: 'Game 1' } as Patch
      ];
      mockPatchRepo.watchAll.and.returnValue(of(mockPatches));
      spyOn(window, 'confirm').and.returnValue(true);
      mockRepo.update.and.resolveTo({
        data: { id: 't1', shortName: 'G-Trans', name: 'G-Translators' },
        edgeSynced: true
      });
      mockPatchRepo.batchUpdatePatchToolByTranslator.and.resolveTo({
        count: 1,
        edgeSynced: false
      });

      (component as any).id = 't1';
      (component as any).shortName = 'G-Trans';
      (component as any).name = 'G-Translators';
      (component as any).modTool = 'https://new-patcher.example.com';

      await (component as any).syncPatchToolToAllGames();

      expect(mockStatus.show).toHaveBeenCalledWith(
        'อัปเดต Patch Tool ทั้งหมด 1 เกมสำเร็จ แต่ซิงค์ Edge ไม่สำเร็จ กรุณากดปุ่ม \'ซิงค์ข้อมูล Edge\' ที่แถบเมนูด้านข้าง',
        'info'
      );
    });

    it('shows error if batch update throws an exception', async () => {
      const mockPatches = [
        { id: 'p1', translatorId: 't1', gameTitle: 'Game 1' } as Patch
      ];
      mockPatchRepo.watchAll.and.returnValue(of(mockPatches));
      spyOn(window, 'confirm').and.returnValue(true);
      mockRepo.update.and.resolveTo({ data: {} as any, edgeSynced: true });
      mockPatchRepo.batchUpdatePatchToolByTranslator.and.rejectWith(new Error('Update failed'));

      (component as any).id = 't1';
      (component as any).shortName = 'G-Trans';
      (component as any).name = 'G-Translators';
      (component as any).modTool = 'https://new-patcher.example.com';

      await (component as any).syncPatchToolToAllGames();

      expect(mockStatus.show).toHaveBeenCalledWith('Update failed', 'error');
      expect((component as any).syncingPatchTool).toBeFalse();
    });

    it('renders sync button in edit mode and disables it when modTool is empty', () => {
      (component as any).id = 't1';
      (component as any).open = true;
      (component as any).modTool = '   ';
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
      const syncBtn = buttons.find((b) => b.textContent?.includes('ซิงค์ Patch Tool ไปยังทุกเกม'));
      expect(syncBtn).toBeTruthy();
      expect(syncBtn?.disabled).toBeTrue();

      (component as any).modTool = 'https://new-tool.com';
      fixture.detectChanges();
      expect(syncBtn?.disabled).toBeFalse();
    });
  });

  it('defaults autoPatchTool to true on add and preserves false on edit/save', async () => {
    (component as any).add();
    expect((component as any).autoPatchTool).toBeTrue();

    (component as any).edit({
      id: 't1',
      shortName: 'G-Trans',
      name: 'G-Translators',
      modTool: 'Lunar IPS',
      autoPatchTool: false
    });
    expect((component as any).autoPatchTool).toBeFalse();

    mockRepo.update.and.resolveTo({
      data: { id: 't1', shortName: 'G-Trans', name: 'G-Translators', modTool: 'Lunar IPS', autoPatchTool: false },
      edgeSynced: true
    });
    await (component as any).save();
    expect(mockRepo.update).toHaveBeenCalledWith('t1', 'G-Trans', 'G-Translators', '', 'Lunar IPS', false);
  });
});
