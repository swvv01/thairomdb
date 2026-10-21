import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminMarqueesPageComponent } from './admin-marquees-page.component';
import { MarqueeRepository } from '../repositories/marquee.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { Router } from '@angular/router';

describe('AdminMarqueesPageComponent', () => {
  let fixture: ComponentFixture<AdminMarqueesPageComponent>;
  let component: AdminMarqueesPageComponent;
  let mockRepo: jasmine.SpyObj<MarqueeRepository>;
  let mockStatus: jasmine.SpyObj<StatusMessageService>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockRepo = jasmine.createSpyObj<MarqueeRepository>('MarqueeRepository', [
      'watchAll',
      'watchDirectAll',
      'create',
      'update',
      'delete'
    ]);
    mockRepo.watchDirectAll.and.returnValue(
      of([
        { id: 'm1', text: 'ยินดีต้อนรับสู่ THAI ROM DB', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'm2', text: 'ประกาศปิดปรับปรุงชั่วคราว', isActive: false, createdAt: '2026-01-02T00:00:00.000Z' }
      ])
    );

    mockStatus = jasmine.createSpyObj<StatusMessageService>('StatusMessageService', ['show', 'clear']);
    mockAuth = jasmine.createSpyObj<AuthService>('AuthService', ['signOut']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [AdminMarqueesPageComponent],
      providers: [
        { provide: MarqueeRepository, useValue: mockRepo },
        { provide: StatusMessageService, useValue: mockStatus },
        { provide: AuthService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMarqueesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders marquee items correctly', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('ยินดีต้อนรับสู่ THAI ROM DB');
    expect(text).toContain('เปิดใช้งาน');
    expect(text).toContain('ประกาศปิดปรับปรุงชั่วคราว');
    expect(text).toContain('ปิดการแสดงผล');
  });

  it('opens add dialog on add()', () => {
    (component as any).add();
    expect((component as any).open).toBeTrue();
    expect((component as any).id).toBeNull();
    expect((component as any).text).toBe('');
    expect((component as any).isActive).toBeTrue();
  });

  it('opens edit dialog with item details on edit()', () => {
    const item = { id: 'm1', text: 'ยินดีต้อนรับสู่ THAI ROM DB', isActive: true, createdAt: '2026-01-01' };
    (component as any).edit(item);
    expect((component as any).open).toBeTrue();
    expect((component as any).id).toBe('m1');
    expect((component as any).text).toBe('ยินดีต้อนรับสู่ THAI ROM DB');
    expect((component as any).isActive).toBeTrue();
  });

  it('shows error if saving with empty text', async () => {
    (component as any).id = null;
    (component as any).text = '   ';
    await (component as any).save();

    expect(mockStatus.show).toHaveBeenCalledWith('กรุณากรอกข้อความ Marquee', 'error');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('creates new marquee item successfully', async () => {
    mockRepo.create.and.resolveTo({ id: 'm3', text: 'ข้อความใหม่', isActive: true, createdAt: '2026-01-03' });
    (component as any).id = null;
    (component as any).text = 'ข้อความใหม่';
    (component as any).isActive = true;

    await (component as any).save();

    expect(mockRepo.create).toHaveBeenCalledWith('ข้อความใหม่', true);
    expect((component as any).open).toBeFalse();
    expect(mockStatus.show).toHaveBeenCalledWith('เพิ่มข้อความ Marquee สำเร็จ', 'success');
  });

  it('updates existing marquee item successfully', async () => {
    mockRepo.update.and.resolveTo({ id: 'm1', text: 'แก้ไขข้อความ', isActive: false, createdAt: '2026-01-01' });
    (component as any).id = 'm1';
    (component as any).text = 'แก้ไขข้อความ';
    (component as any).isActive = false;

    await (component as any).save();

    expect(mockRepo.update).toHaveBeenCalledWith('m1', 'แก้ไขข้อความ', false);
    expect((component as any).open).toBeFalse();
    expect(mockStatus.show).toHaveBeenCalledWith('แก้ไขข้อความ Marquee สำเร็จ', 'success');
  });

  it('deletes marquee item when confirmed', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockRepo.delete.and.resolveTo();

    const item = { id: 'm1', text: 'ลบฉัน', isActive: true, createdAt: '2026-01-01' };
    await (component as any).remove(item);

    expect(mockRepo.delete).toHaveBeenCalledWith('m1');
    expect(mockStatus.show).toHaveBeenCalledWith('ลบข้อความ Marquee สำเร็จ', 'success');
  });
});
