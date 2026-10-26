import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DonationRepository } from '../repositories/donation.repository';
import { RedeemRepository } from '../repositories/redeem.repository';
import { Donation } from '../models/donation.models';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { DonationCustomizeModalComponent } from '../components/donation-customize-modal.component';
import { CertificateGeneratorService } from '../services/certificate-generator.service';

interface MonthGroup {
  key: string;   // "current" | "previous"
  label: string; // "เดือนนี้" | "เดือนที่แล้ว"
  donations: Donation[];
}

@Component({
  selector: 'app-donations-page',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink, DonationCustomizeModalComponent],
  templateUrl: './donations-page.component.html',
  styleUrl: './donations-page.component.css'
})
export class DonationsPageComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly donationRepo = inject(DonationRepository);
  private readonly redeemRepo = inject(RedeemRepository);
  private readonly statusMessage = inject(StatusMessageService);
  private readonly titleService = inject(Title);
  private readonly route = inject(ActivatedRoute);
  private readonly certGenerator = inject(CertificateGeneratorService);

  protected readonly loading = signal(true);
  protected readonly donations = signal<Donation[]>([]);
  protected readonly selectedTab = signal<string>('current');
  protected readonly userRedeemedDonationIds = signal<Set<string>>(new Set());
  protected readonly editingDonation = signal<Donation | null>(null);
  protected readonly isDownloading = signal<string | null>(null);

  private hasUserManuallySwitchedTab = false;

  private static readonly NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
  private static readonly THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  constructor() {
    effect(() => {
      const user = this.authService.user();
      if (user) {
        void this.loadUserRedeemedDonations(user.uid);
      } else {
        this.userRedeemedDonationIds.set(new Set());
        this.updateDefaultTab();
      }
    });
  }

  protected isNewDonation(donatedAt: string): boolean {
    const timestamp = Date.parse(donatedAt);
    if (Number.isNaN(timestamp)) return false;
    const diff = Date.now() - timestamp;
    return diff >= 0 && diff <= DonationsPageComponent.NEW_WINDOW_MS;
  }

  protected formatThaiDate(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const day = d.getDate();
    const month = DonationsPageComponent.THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  }

  protected isUserDonation(donation: Donation): boolean {
    const user = this.authService.user();
    if (!user) return false;
    if (donation.redeemedBy && donation.redeemedBy === user.uid) return true;
    return this.userRedeemedDonationIds().has(donation.id);
  }

  protected canCustomize(donation: Donation): boolean {
    return this.isUserDonation(donation);
  }

  protected openCustomizeModal(donation: Donation): void {
    this.editingDonation.set(donation);
  }

  protected onDonationSaved(updated: Donation): void {
    this.donations.update(items => items.map(d => (d.id === updated.id ? updated : d)));
    this.editingDonation.set(null);
  }

  protected async downloadCertificate(donation: Donation): Promise<void> {
    if (this.isDownloading()) return;

    this.isDownloading.set(donation.id);
    this.statusMessage.show('กำลังสร้างรูปภาพใบประกาศเกียรติคุณ...', 'info');

    try {
      const blob = await this.certGenerator.generateCertificateBlob(donation);
      const safeDonorName = (donation.donorName || donation.id).replace(/[\s/\\?%*:|"<>]/g, '_');
      const filename = `thairomdb-certificate-${safeDonorName}.png`;
      this.certGenerator.downloadBlob(blob, filename);
      this.statusMessage.show('ดาวน์โหลดรูปภาพใบประกาศเกียรติคุณสำเร็จ', 'success');
    } catch (err: any) {
      console.error('Failed to generate certificate image:', err);
      this.statusMessage.show('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      this.isDownloading.set(null);
    }
  }

  protected selectTab(key: string): void {
    this.hasUserManuallySwitchedTab = true;
    this.selectedTab.set(key);
  }

  protected readonly groupedDonations = computed(() => {
    const list = this.donations().filter(d => d.amount > 0);
    if (list.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth();

    const userCards = list.filter(d => this.isUserDonation(d));
    const userGroup: MonthGroup = {
      key: 'mine',
      label: 'ของฉัน',
      donations: userCards
    };

    const currentGroup: MonthGroup = {
      key: 'current',
      label: 'เดือนนี้',
      donations: []
    };

    const previousGroup: MonthGroup = {
      key: 'previous',
      label: 'เดือนที่แล้ว',
      donations: []
    };

    for (const d of list) {
      const date = new Date(d.donatedAt);
      const isCurrentMonth = date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      const isPreviousMonth = date.getFullYear() === previousYear && date.getMonth() === previousMonth;
      if (isCurrentMonth) {
        currentGroup.donations.push(d);
      } else if (isPreviousMonth) {
        previousGroup.donations.push(d);
      }
    }

    const result: MonthGroup[] = [];
    if (userCards.length > 0) {
      result.push(userGroup);
    }
    result.push(currentGroup);
    if (previousGroup.donations.length > 0) {
      result.push(previousGroup);
    }
    return result;
  });

  protected readonly currentGroup = computed(() => {
    const groups = this.groupedDonations();
    if (groups.length === 0) return null;
    return groups.find(g => g.key === this.selectedTab()) ?? groups[0];
  });

  ngOnInit(): void {
    this.titleService.setTitle('รายการสนับสนุน - ROM Collector');
    void this.loadDonations();
  }

  private updateDefaultTab(): void {
    if (this.hasUserManuallySwitchedTab) {
      const groups = this.groupedDonations();
      if (groups.length > 0 && !groups.some(g => g.key === this.selectedTab())) {
        this.selectedTab.set(groups[0].key);
      }
      return;
    }

    const groups = this.groupedDonations();
    if (groups.length === 0) return;

    const hasMine = groups.some(g => g.key === 'mine');
    if (hasMine) {
      this.selectedTab.set('mine');
    } else {
      const hasCurrent = groups.some(g => g.key === 'current');
      this.selectedTab.set(hasCurrent ? 'current' : groups[0].key);
    }
  }

  private async loadUserRedeemedDonations(uid: string): Promise<void> {
    try {
      const codes = await this.redeemRepo.getUserRedeemedCodes(uid);
      const donationIds = new Set<string>();
      for (const code of codes) {
        if (code.donationId) {
          donationIds.add(code.donationId);
        }
      }
      this.userRedeemedDonationIds.set(donationIds);
      this.updateDefaultTab();
      this.checkEditParam();
    } catch (e) {
      console.warn('loadUserRedeemedDonations failed:', e);
    }
  }

  private async loadDonations(): Promise<void> {
    try {
      this.loading.set(true);
      const items = await this.donationRepo.getAllDonations();
      this.donations.set(items);
      this.updateDefaultTab();
      this.checkEditParam();
    } catch (error: any) {
      this.statusMessage.show(error.message || 'ไม่สามารถโหลดข้อมูลการสนับสนุนได้', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  private checkEditParam(): void {
    const editId = this.route.snapshot.queryParamMap.get('edit');
    if (!editId) return;

    const target = this.donations().find(d => d.id === editId);
    if (target && this.canCustomize(target)) {
      this.editingDonation.set(target);
    }
  }
}
