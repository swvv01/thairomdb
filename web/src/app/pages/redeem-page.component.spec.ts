import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { RedeemPageComponent, REDEEM_COOLDOWN_TIERS_SECONDS, formatCooldownDuration } from './redeem-page.component';
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
    localStorage.clear();
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

  describe('Cooldown and Rate Limiting', () => {
    it('should correctly format cooldown duration strings', () => {
      expect(formatCooldownDuration(10)).toBe('10 วินาที');
      expect(formatCooldownDuration(60)).toBe('1 นาที');
      expect(formatCooldownDuration(90)).toBe('1 นาที 30 วินาที');
      expect(formatCooldownDuration(3600)).toBe('1 ชั่วโมง');
      expect(formatCooldownDuration(3665)).toBe('1 ชั่วโมง 1 นาที 5 วินาที');
    });

    it('should trigger cooldown on failed redeem attempt and increase exponentially according to ladder', async () => {
      mockRedeemRepo.redeemCode.and.returnValue(Promise.reject(new Error('ไม่พบโค้ดนี้ในระบบ')));
      (component as any).code.set('WRONG1');

      // Attempt 1: 10 seconds
      await (component as any).submit();
      expect((component as any).isCooldownActive()).toBeTrue();
      expect((component as any).cooldownRemainingSeconds()).toBe(10);
      expect(mockStatusMessage.show).toHaveBeenCalledWith(
        'ไม่พบโค้ดนี้ในระบบ (กรุณารออีก 10 วินาที)',
        'error'
      );

      // Attempt 2 (force clear ticker/cooldownRemainingSeconds to simulate elapsed cooldown without clearing fail count)
      (component as any).cooldownRemainingSeconds.set(0);
      (component as any).code.set('WRONG2');
      await (component as any).submit();
      expect((component as any).cooldownRemainingSeconds()).toBe(20);

      // Attempt 3: 30 seconds
      (component as any).cooldownRemainingSeconds.set(0);
      (component as any).code.set('WRONG3');
      await (component as any).submit();
      expect((component as any).cooldownRemainingSeconds()).toBe(30);

      // Attempt 4: 60 seconds (1 minute)
      (component as any).cooldownRemainingSeconds.set(0);
      (component as any).code.set('WRONG4');
      await (component as any).submit();
      expect((component as any).cooldownRemainingSeconds()).toBe(60);

      // Attempt 5: 300 seconds (5 minutes)
      (component as any).cooldownRemainingSeconds.set(0);
      (component as any).code.set('WRONG5');
      await (component as any).submit();
      expect((component as any).cooldownRemainingSeconds()).toBe(300);
    });

    it('should prevent submission and disable button but keep input enabled while cooldown is active', async () => {
      (component as any).cooldownRemainingSeconds.set(15);
      (component as any).code.set('SOMECODE');
      fixture.detectChanges();

      const inputElement = fixture.nativeElement.querySelector('input#code') as HTMLInputElement;
      const buttonElement = fixture.nativeElement.querySelector('button.submit-button') as HTMLButtonElement;

      expect(inputElement.disabled).toBeFalse();
      expect(buttonElement.disabled).toBeTrue();

      await (component as any).submit();

      expect(mockRedeemRepo.redeemCode).not.toHaveBeenCalled();
    });

    it('should reset cooldown and fail count on successful redeem', async () => {
      // Simulate existing failed state in localStorage
      localStorage.setItem('redeem_cooldown_user_1', JSON.stringify({ failCount: 3, cooldownUntil: Date.now() - 1000 }));

      mockRedeemRepo.redeemCode.and.returnValue(Promise.resolve({ donationId: 'don_success' }));
      mockDonationRepo.getDonation.and.returnValue(Promise.resolve(mockDonation));
      (component as any).code.set('CORRECTCODE');

      await (component as any).submit();

      expect(localStorage.getItem('redeem_cooldown_user_1')).toBeNull();
      expect((component as any).cooldownRemainingSeconds()).toBe(0);
      expect((component as any).isCooldownActive()).toBeFalse();
    });
  });
});
