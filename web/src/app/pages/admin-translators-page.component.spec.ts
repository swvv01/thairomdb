import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminTranslatorsPageComponent } from './admin-translators-page.component';
import { TranslatorRepository } from '../repositories/translator.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { ActivatedRoute, Router } from '@angular/router';

describe('AdminTranslatorsPageComponent', () => {
  let fixture: ComponentFixture<AdminTranslatorsPageComponent>;
  let component: AdminTranslatorsPageComponent;
  let mockRepo: jasmine.SpyObj<TranslatorRepository>;
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

    mockStatus = jasmine.createSpyObj<StatusMessageService>('StatusMessageService', ['show', 'clear']);
    mockAuth = jasmine.createSpyObj<AuthService>('AuthService', ['signOut']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [AdminTranslatorsPageComponent],
      providers: [
        { provide: TranslatorRepository, useValue: mockRepo },
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

    expect(mockRepo.create).toHaveBeenCalledWith('New', 'New Team', '', '');
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

    expect(mockRepo.create).toHaveBeenCalledWith('New', 'New Team', '', '');
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

    expect(mockRepo.update).toHaveBeenCalledWith('t1', 'G-Trans', 'G-Translators Updated', '', '');
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
});
