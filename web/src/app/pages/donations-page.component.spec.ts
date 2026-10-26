import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DonationsPageComponent } from './donations-page.component';
import { DonationRepository } from '../repositories/donation.repository';
import { RedeemRepository } from '../repositories/redeem.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { CertificateGeneratorService } from '../services/certificate-generator.service';
import { Donation } from '../models/donation.models';

describe('DonationsPageComponent', () => {
  let fixture: ComponentFixture<DonationsPageComponent>;
  let component: DonationsPageComponent;

  const mockDonations: Donation[] = [
    {
      id: 'don_1',
      amount: 2000,
      donatedAt: new Date().toISOString(),
      donorName: 'คุณชายโกโก้',
      imageUrl: 'https://example.com/coco.webp',
      isCustomized: true,
      redeemedBy: 'user_123'
    },
    {
      id: 'don_2',
      amount: 500,
      donatedAt: new Date().toISOString(),
      redeemedBy: 'user_123',
      isCustomized: false
    },
    {
      id: 'don_3',
      amount: 300,
      donatedAt: new Date().toISOString()
    }
  ];

  const mockDonationRepo = {
    getAllDonations: jasmine.createSpy('getAllDonations').and.returnValue(Promise.resolve(mockDonations)),
    updateDonorProfile: jasmine.createSpy('updateDonorProfile').and.returnValue(Promise.resolve())
  };

  const mockRedeemRepo = {
    getUserRedeemedCodes: jasmine.createSpy('getUserRedeemedCodes').and.returnValue(Promise.resolve([]))
  };

  const mockAuthService = {
    user: signal<{ uid: string; email: string } | null>({ uid: 'user_123', email: 'test@example.com' }),
    isAdmin: signal(false)
  };

  const mockStatusMessage = {
    show: jasmine.createSpy('show')
  };

  const mockCertGenerator = {
    generateCertificateBlob: jasmine.createSpy('generateCertificateBlob').and.returnValue(Promise.resolve(new Blob(['fake'], { type: 'image/png' }))),
    downloadBlob: jasmine.createSpy('downloadBlob')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonationsPageComponent],
      providers: [
        provideRouter([]),
        { provide: DonationRepository, useValue: mockDonationRepo },
        { provide: RedeemRepository, useValue: mockRedeemRepo },
        { provide: AuthService, useValue: mockAuthService },
        { provide: StatusMessageService, useValue: mockStatusMessage },
        { provide: CertificateGeneratorService, useValue: mockCertGenerator }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create donations page component', () => {
    expect(component).toBeTruthy();
  });

  it('should load donations and default to "mine" tab with owned cards', () => {
    expect(mockDonationRepo.getAllDonations).toHaveBeenCalled();
    expect((component as any).selectedTab()).toBe('mine');
    const tabs = fixture.nativeElement.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('ของฉัน');
    expect(tabs[0].textContent).toContain('2');
    expect(tabs[1].textContent).toContain('เดือนนี้');
    expect(tabs[1].textContent).toContain('3');

    const cards = fixture.nativeElement.querySelectorAll('.donor-certificate-card');
    expect(cards.length).toBe(2);
  });

  it('should switch to "current" tab and show all 3 donations when clicking month tab', () => {
    (component as any).selectTab('current');
    fixture.detectChanges();
    expect((component as any).selectedTab()).toBe('current');
    const cards = fixture.nativeElement.querySelectorAll('.donor-certificate-card');
    expect(cards.length).toBe(3);
  });

  it('should display customized donor name for don_1 and fallback for don_2', () => {
    const cards = fixture.nativeElement.querySelectorAll('.donor-certificate-card');
    const firstDonorName = cards[0].querySelector('.certificate-donor-name').textContent.trim();
    expect(firstDonorName).toBe('คุณชายโกโก้');

    const secondDonorName = cards[1].querySelector('.certificate-donor-name').textContent.trim();
    expect(secondDonorName).toBe('ผู้ไม่ประสงค์ออกนาม');
  });

  it('should format Thai date with Buddhist Era year', () => {
    const testDate = '2026-10-23T10:00:00Z';
    const formatted = (component as any).formatThaiDate(testDate);
    expect(formatted).toContain('ตุลาคม');
    expect(formatted).toContain('2569');
  });

  it('should render website logo in certificate emblem', () => {
    const emblemImg = fixture.nativeElement.querySelector('.certificate-emblem-img');
    expect(emblemImg).toBeTruthy();
    expect(emblemImg.getAttribute('src')).toBe('assets/images/logo.png');
  });

  it('should allow customize for owned donations repeatedly, but reject unowned even for admin', () => {
    expect((component as any).canCustomize(mockDonations[0])).toBeTrue(); // owned, can edit repeatedly
    expect((component as any).canCustomize(mockDonations[1])).toBeTrue(); // owned
    expect((component as any).canCustomize(mockDonations[2])).toBeFalse(); // not owned

    // Admin cannot edit someone else's donation
    mockAuthService.isAdmin.set(true);
    expect((component as any).canCustomize(mockDonations[2])).toBeFalse();
    mockAuthService.isAdmin.set(false);
  });

  it('should open modal when customize button is clicked', () => {
    (component as any).openCustomizeModal(mockDonations[1]);
    fixture.detectChanges();
    expect((component as any).editingDonation()).toEqual(mockDonations[1]);
  });

  it('should update donation list when modal emits saved', () => {
    const updated: Donation = {
      ...mockDonations[1],
      donorName: 'นายใจดี',
      isCustomized: true
    };
    (component as any).onDonationSaved(updated);
    fixture.detectChanges();

    const found = (component as any).donations().find((d: Donation) => d.id === 'don_2');
    expect(found.donorName).toBe('นายใจดี');
    expect(found.isCustomized).toBeTrue();
    expect((component as any).editingDonation()).toBeNull();
  });

  it('should call certificate generator and show feedback on download', async () => {
    await (component as any).downloadCertificate(mockDonations[0]);
    expect(mockStatusMessage.show).toHaveBeenCalledWith('กำลังสร้างรูปภาพใบประกาศเกียรติคุณ...', 'info');
    expect(mockCertGenerator.generateCertificateBlob).toHaveBeenCalledWith(mockDonations[0]);
    expect(mockCertGenerator.downloadBlob).toHaveBeenCalled();
    expect(mockStatusMessage.show).toHaveBeenCalledWith('ดาวน์โหลดรูปภาพใบประกาศเกียรติคุณสำเร็จ', 'success');
    expect((component as any).isDownloading()).toBeNull();
  });

  it('should handle error when certificate download fails', async () => {
    mockCertGenerator.generateCertificateBlob.and.returnValue(Promise.reject(new Error('Canvas error')));
    await (component as any).downloadCertificate(mockDonations[0]);
    expect(mockStatusMessage.show).toHaveBeenCalledWith('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ กรุณาลองใหม่อีกครั้ง', 'error');
    expect((component as any).isDownloading()).toBeNull();
  });
});
