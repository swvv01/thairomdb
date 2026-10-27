import { Component, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-redeem-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VipPerksCardComponent, DonationCustomizeModalComponent],
  templateUrl: './redeem-page.component.html',
  styleUrl: './redeem-page.component.css'
})
export class RedeemPageComponent {
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

    const codeVal = this.code().trim();
    if (!codeVal) return;

    this.loading.set(true);
    this.statusMessage.show('กำลังตรวจสอบโค้ด...', 'info');

    try {
      const res = await this.redeemRepo.redeemCode(codeVal, user.uid, user.email ?? '');

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
      this.statusMessage.show(error.message || 'เกิดข้อผิดพลาดในการตรวจสอบโค้ด', 'error');
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
