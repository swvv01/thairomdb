import { Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { RedeemRepository } from '../repositories/redeem.repository';
import { DonationRepository } from '../repositories/donation.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { VipPerksCardComponent } from '../components/vip-perks-card.component';
import { DonationCustomizeModalComponent } from '../components/donation-customize-modal.component';
import { Donation } from '../models/donation.models';

export const REDEEM_COOLDOWN_TIERS_SECONDS = [10, 20, 30, 60, 300, 600, 1800, 3600];

export function formatCooldownDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (mins === 0 && secs === 0) return `${hours} ชั่วโมง`;
    if (secs === 0) return `${hours} ชั่วโมง ${mins} นาที`;
    return `${hours} ชั่วโมง ${mins} นาที ${secs} วินาที`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins} นาที`;
    return `${mins} นาที ${secs} วินาที`;
  }
  return `${seconds} วินาที`;
}

@Component({
  selector: 'app-redeem-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VipPerksCardComponent, DonationCustomizeModalComponent],
  templateUrl: './redeem-page.component.html',
  styleUrl: './redeem-page.component.css'
})
export class RedeemPageComponent implements OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly redeemRepo = inject(RedeemRepository);
  private readonly donationRepo = inject(DonationRepository);
  private readonly statusMessage = inject(StatusMessageService);

  protected readonly code = signal('');
  protected readonly loading = signal(false);
  protected readonly redeemedDonationId = signal<string | null>(null);
  protected readonly currentDonation = signal<Donation | null>(null);
  protected readonly isCustomizeModalOpen = signal(false);

  protected readonly cooldownRemainingSeconds = signal(0);
  protected readonly isCooldownActive = computed(() => this.cooldownRemainingSeconds() > 0);
  protected readonly cooldownText = computed(() => formatCooldownDuration(this.cooldownRemainingSeconds()));

  private tickerInterval: any = null;

  constructor() {
    effect(() => {
      const user = this.authService.user();
      if (user) {
        this.loadCooldown(user.uid);
      } else {
        this.clearTicker();
        this.cooldownRemainingSeconds.set(0);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTicker();
  }

  private getStorageKey(uid: string): string {
    return `redeem_cooldown_${uid}`;
  }

  private loadCooldown(uid: string): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey(uid));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data.cooldownUntil === 'number') {
        const remaining = Math.ceil((data.cooldownUntil - Date.now()) / 1000);
        if (remaining > 0) {
          this.startTicker(remaining, data.cooldownUntil);
        } else {
          this.cooldownRemainingSeconds.set(0);
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }

  private startTicker(remainingSeconds: number, cooldownUntil: number): void {
    this.clearTicker();
    this.cooldownRemainingSeconds.set(remainingSeconds);
    this.tickerInterval = setInterval(() => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        this.cooldownRemainingSeconds.set(0);
        this.clearTicker();
      } else {
        this.cooldownRemainingSeconds.set(remaining);
      }
    }, 1000);
  }

  private clearTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  private recordFailedAttempt(uid: string): number {
    try {
      const key = this.getStorageKey(uid);
      const raw = localStorage.getItem(key);
      let failCount = 0;
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data.failCount === 'number') {
          failCount = data.failCount;
        }
      }
      failCount++;
      const tierIndex = Math.min(failCount - 1, REDEEM_COOLDOWN_TIERS_SECONDS.length - 1);
      const durationSeconds = REDEEM_COOLDOWN_TIERS_SECONDS[tierIndex];
      const cooldownUntil = Date.now() + durationSeconds * 1000;
      localStorage.setItem(key, JSON.stringify({ failCount, cooldownUntil }));
      this.startTicker(durationSeconds, cooldownUntil);
      return durationSeconds;
    } catch {
      const fallbackDuration = REDEEM_COOLDOWN_TIERS_SECONDS[0];
      const cooldownUntil = Date.now() + fallbackDuration * 1000;
      this.startTicker(fallbackDuration, cooldownUntil);
      return fallbackDuration;
    }
  }

  private resetCooldown(uid: string): void {
    this.clearTicker();
    this.cooldownRemainingSeconds.set(0);
    try {
      localStorage.removeItem(this.getStorageKey(uid));
    } catch {
      // Ignore
    }
  }

  protected async signIn(): Promise<void> {
    this.loading.set(true);
    this.statusMessage.show('กำลังเข้าสู่ระบบ...', 'info');
    try {
      await this.authService.signInWithGoogle();
      this.statusMessage.show('เข้าสู่ระบบสำเร็จ', 'success');
    } catch {
      this.statusMessage.show('ไม่สามารถเข้าสู่ระบบได้', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const user = this.authService.user();
    if (!user) return;
    if (this.isCooldownActive()) return;

    const codeVal = this.code().trim();
    if (!codeVal) return;

    this.loading.set(true);
    this.statusMessage.show('กำลังตรวจสอบโค้ด...', 'info');

    try {
      const res = await this.redeemRepo.redeemCode(codeVal, user.uid, user.email ?? '');

      this.resetCooldown(user.uid);
      this.statusMessage.show('Redeem สำเร็จ! ขอบคุณสำหรับการสนับสนุน THAI ROM DB', 'success');
      this.code.set('');
      this.authService.isVip.set(true);

      let donId = res?.donationId;
      if (donId) {
        this.redeemedDonationId.set(donId);
        try {
          const donation = await this.donationRepo.getDonation(donId);
          if (donation) {
            this.currentDonation.set(donation);
          } else {
            this.currentDonation.set({
              id: donId,
              amount: 0,
              donatedAt: new Date().toISOString(),
              redeemedBy: user.uid
            });
          }
          this.isCustomizeModalOpen.set(true);
        } catch (e) {
          console.warn('Failed to load donation for customization:', e);
        }
      } else {
        // Fallback: check if this user has any claimed donation
        try {
          const allDonations = await this.donationRepo.getAllDonations();
          const userDonation = allDonations.find(d => d.redeemedBy === user.uid);
          if (userDonation) {
            this.redeemedDonationId.set(userDonation.id);
            this.currentDonation.set(userDonation);
            this.isCustomizeModalOpen.set(true);
          }
        } catch (e) {
          console.warn('Failed to check user donations:', e);
        }
      }
    } catch (error: any) {
      const waitSeconds = this.recordFailedAttempt(user.uid);
      const timeText = formatCooldownDuration(waitSeconds);
      const baseMsg = error.message || 'เกิดข้อผิดพลาดในการตรวจสอบโค้ด';
      this.statusMessage.show(`${baseMsg} (กรุณารออีก ${timeText})`, 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async openCustomizeModal(): Promise<void> {
    if (!this.currentDonation()) {
      if (this.redeemedDonationId()) {
        try {
          const donation = await this.donationRepo.getDonation(this.redeemedDonationId()!);
          if (donation) {
            this.currentDonation.set(donation);
          }
        } catch (e) {
          console.warn('Failed to load donation for customization:', e);
        }
      }
      if (!this.currentDonation()) {
        const user = this.authService.user();
        if (user) {
          try {
            const allDonations = await this.donationRepo.getAllDonations();
            const userDonation = allDonations.find(d => d.redeemedBy === user.uid);
            if (userDonation) {
              this.currentDonation.set(userDonation);
              this.redeemedDonationId.set(userDonation.id);
            }
          } catch (e) {
            console.warn('Failed to query user donations:', e);
          }
        }
      }
    }
    if (this.currentDonation()) {
      this.isCustomizeModalOpen.set(true);
    }
  }

  protected closeCustomizeModal(): void {
    this.isCustomizeModalOpen.set(false);
  }

  protected onDonationSaved(updated: Donation): void {
    this.currentDonation.set(updated);
    this.isCustomizeModalOpen.set(false);
    this.statusMessage.show('บันทึกข้อมูลผู้สนับสนุนเรียบร้อยแล้ว', 'success');
    this.router.navigate(['/donations']);
  }
}
