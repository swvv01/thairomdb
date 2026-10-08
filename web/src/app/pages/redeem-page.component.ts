import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { RedeemRepository } from '../repositories/redeem.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { VipPerksCardComponent } from '../components/vip-perks-card.component';

@Component({
  selector: 'app-redeem-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VipPerksCardComponent],
  templateUrl: './redeem-page.component.html',
  styleUrl: './redeem-page.component.css'
})
export class RedeemPageComponent {
  protected readonly authService = inject(AuthService);
  private readonly redeemRepo = inject(RedeemRepository);
  private readonly statusMessage = inject(StatusMessageService);

  protected readonly code = signal('');
  protected readonly loading = signal(false);

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
      await this.redeemRepo.redeemCode(codeVal, user.uid, user.email ?? '');

      this.statusMessage.show('Redeem สำเร็จ! คุณได้รับสถานะ VIP แล้ว', 'success');
      this.code.set('');
      this.authService.isVip.set(true);
    } catch (error: any) {
      this.statusMessage.show(error.message || 'เกิดข้อผิดพลาดในการตรวจสอบโค้ด', 'error');
    } finally {
      this.loading.set(false);
    }
  }
}
