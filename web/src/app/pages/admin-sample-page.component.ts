import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatusMessageService } from '../shared/status-message.service';

type SampleTab = 'overview' | 'controls' | 'states';

@Component({
  selector: 'app-admin-sample-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-sample-page.component.html',
  styleUrl: './admin-sample-page.component.css'
})
export class AdminSamplePageComponent {
  private readonly status = inject(StatusMessageService);

  protected readonly activeTab = signal<SampleTab>('overview');
  protected readonly modalOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly enabled = signal(true);
  protected readonly selectedOption = signal('retro');
  protected readonly colorTokens = [
    ['surface', '--color-surface'], ['surface-light', '--color-surface-light'],
    ['border', '--color-border'], ['text', '--color-text'], ['text-muted', '--color-text-muted'],
    ['accent', '--color-accent'], ['link', '--color-link'], ['highlight', '--color-highlight'],
    ['brand', '--color-brand'], ['success', '--color-status-success'],
    ['danger', '--color-status-error'], ['disabled', '--color-disabled']
  ];

  protected selectTab(tab: SampleTab): void { this.activeTab.set(tab); }

  protected showToast(tone: 'success' | 'info' | 'error'): void {
    const text = tone === 'success' ? 'ตัวอย่าง success message' : tone === 'error' ? 'ตัวอย่าง error message' : 'ตัวอย่าง info message';
    this.status.show(text, tone, false);
  }

  protected showUpdateToast(): void {
    this.status.show('มีเวอร์ชันใหม่พร้อมใช้งาน กรุณากดอัปเดตเพื่อรีเฟรชหน้าเว็บ', 'info', {
      autoDismiss: false,
      action: {
        label: 'อัปเดต',
        busyLabel: 'กำลังอัปเดต...',
        onClick: () => {
          this.status.show('กำลังจำลองการอัปเดต...', 'info', { autoDismiss: true });
          window.setTimeout(() => {
            this.status.show('อัปเดตเวอร์ชันใหม่เสร็จแล้ว', 'success', { autoDismiss: true });
          }, 1200);
        }
      }
    });
  }

  protected async simulateLoading(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    this.loading.set(false);
    this.status.show('การทำงานตัวอย่างเสร็จแล้ว', 'success', false);
  }
}
