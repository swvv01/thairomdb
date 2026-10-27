import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { RedeemPageComponent } from './redeem-page.component';
import { RedeemRepository } from '../repositories/redeem.repository';
import { DonationRepository } from '../repositories/donation.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { Donation } from '../models/donation.models';

describe('RedeemPageComponent', () => {
  let fixture: ComponentFixture<RedeemPageComponent>;
  let component: RedeemPageComponent;
  let router: Router;

  const mockDonation: Donation = {
    id: 'don_123',
    amount: 1000,
    donatedAt: '2026-10-27T10:00:00Z',
    donorName: 'ผู้สนับสนุนใจดี',
    imageUrl: 'https://example.com/donor.webp',
    redeemedBy: 'user_1'
  };

  const mockRedeemRepo = {
    redeemCode: jasmine.createSpy('redeemCode')
  };

  const mockDonationRepo = {
    getDonation: jasmine.createSpy('getDonation'),
    getAllDonations: jasmine.createSpy('getAllDonations').and.returnValue(Promise.resolve([]))
  };

  const mockAuthService = {
    user: signal<{ uid: string; email: string } | null>({ uid: 'user_1', email: 'user@example.com' }),
    isVip: signal(false),
    signInWithGoogle: jasmine.createSpy('signInWithGoogle')
  };

  const mockStatusMessage = {
    show: jasmine.createSpy('show')
  };

  beforeEach(async () => {
    mockRedeemRepo.redeemCode.calls.reset();
    mockDonationRepo.getDonation.calls.reset();
    mockDonationRepo.getAllDonations.calls.reset();
    mockDonationRepo.getAllDonations.and.returnValue(Promise.resolve([]));
    mockStatusMessage.show.calls.reset();
    mockAuthService.isVip.set(false);

    await TestBed.configureTestingModule({
      imports: [RedeemPageComponent],
      providers: [
        provideRouter([]),
        { provide: RedeemRepository, useValue: mockRedeemRepo },
        { provide: DonationRepository, useValue: mockDonationRepo },
        { provide: AuthService, useValue: mockAuthService },
        { provide: StatusMessageService, useValue: mockStatusMessage }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture = TestBed.createComponent(RedeemPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should redeem code without donationId without opening customize modal', async () => {
    mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({}));
    (component as any).code.set('TESTCODE');

    await (component as any).submit();

    expect(mockRedeemRepo.redeemCode).toHaveBeenCalledWith('TESTCODE', 'user_1', 'user@example.com');
    expect(mockAuthService.isVip()).toBeTrue();
    expect(mockDonationRepo.getDonation).not.toHaveBeenCalled();
    expect((component as any).isCustomizeModalOpen()).toBeFalse();
  });

  it('should fallback to user claimed donation if redeemCode does not return donationId', async () => {
    mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({}));
    mockDonationRepo.getAllDonations.and.returnValue(Promise.resolve([mockDonation]));
    (component as any).code.set('TESTCODE');

    await (component as any).submit();

    expect((component as any).redeemedDonationId()).toBe('don_123');
    expect((component as any).currentDonation()).toEqual(mockDonation);
    expect((component as any).isCustomizeModalOpen()).toBeTrue();
  });

  it('should redeem code with donationId and automatically open customize modal', async () => {
    mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({ donationId: 'don_123' }));
    mockDonationRepo.getDonation.and.returnValue(Promise.resolve(mockDonation));
    (component as any).code.set('TESTCODE');

    await (component as any).submit();

    expect(mockRedeemRepo.redeemCode).toHaveBeenCalledWith('TESTCODE', 'user_1', 'user@example.com');
    expect(mockDonationRepo.getDonation).toHaveBeenCalledWith('don_123');
    expect((component as any).currentDonation()).toEqual(mockDonation);
    expect((component as any).isCustomizeModalOpen()).toBeTrue();
  });

  it('should close customize modal on closeCustomizeModal()', async () => {
    mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({ donationId: 'don_123' }));
    mockDonationRepo.getDonation.and.returnValue(Promise.resolve(mockDonation));
    (component as any).code.set('TESTCODE');
    await (component as any).submit();

    expect((component as any).isCustomizeModalOpen()).toBeTrue();

    (component as any).closeCustomizeModal();
    expect((component as any).isCustomizeModalOpen()).toBeFalse();
  });

  it('should re-open customize modal when calling openCustomizeModal()', async () => {
    (component as any).redeemedDonationId.set('don_123');
    mockDonationRepo.getDonation.and.returnValue(Promise.resolve(mockDonation));

    await (component as any).openCustomizeModal();

    expect((component as any).isCustomizeModalOpen()).toBeTrue();
    expect((component as any).currentDonation()).toEqual(mockDonation);
  });

  it('should navigate to /donations and show success toast on onDonationSaved()', () => {
    const updatedDonation: Donation = { ...mockDonation, donorName: 'ชื่อใหม่' };
    (component as any).isCustomizeModalOpen.set(true);

    (component as any).onDonationSaved(updatedDonation);

    expect((component as any).currentDonation()).toEqual(updatedDonation);
    expect((component as any).isCustomizeModalOpen()).toBeFalse();
    expect(mockStatusMessage.show).toHaveBeenCalledWith('บันทึกข้อมูลผู้สนับสนุนเรียบร้อยแล้ว', 'success');
    expect(router.navigate).toHaveBeenCalledWith(['/donations']);
  });

  it('should allow user who is already VIP to redeem another code', async () => {
    mockAuthService.isVip.set(true);
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form');
    expect(form).toBeTruthy();

    mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({ donationId: 'don_456' }));
    mockDonationRepo.getDonation.and.returnValue(Promise.resolve({ ...mockDonation, id: 'don_456' }));
    (component as any).code.set('ANOTHERCODE');

    await (component as any).submit();

    expect(mockRedeemRepo.redeemCode).toHaveBeenCalledWith('ANOTHERCODE', 'user_1', 'user@example.com');
    expect(mockStatusMessage.show).toHaveBeenCalledWith('Redeem สำเร็จ! ขอบคุณสำหรับการสนับสนุน THAI ROM DB', 'success');
    expect((component as any).redeemedDonationId()).toBe('don_456');
    expect((component as any).isCustomizeModalOpen()).toBeTrue();
  });
});
