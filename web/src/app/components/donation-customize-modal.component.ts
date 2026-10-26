import { Component, Input, Output, EventEmitter, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Donation } from '../models/donation.models';
import { DonationRepository } from '../repositories/donation.repository';
import { CoverStorageService } from '../services/cover-storage.service';
import { ImageProcessorService } from '../services/image-processor.service';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { ProcessedCover } from '../models/patch.models';

@Component({
  selector: 'app-donation-customize-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './donation-customize-modal.component.html',
  styleUrl: './donation-customize-modal.component.css'
})
export class DonationCustomizeModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) donation!: Donation;
  @Output() readonly saved = new EventEmitter<Donation>();
  @Output() readonly closed = new EventEmitter<void>();

  private readonly donationRepo = inject(DonationRepository);
  private readonly coverStorage = inject(CoverStorageService);
  private readonly imageProcessor = inject(ImageProcessorService);
  private readonly authService = inject(AuthService);
  private readonly statusMessage = inject(StatusMessageService);

  protected readonly donorName = signal('');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly isProcessing = signal(false);
  protected readonly processingText = signal('');
  protected readonly errorMessage = signal<string | null>(null);

  private static readonly THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  private processedCover: ProcessedCover | null = null;
  private objectUrlToRevoke: string | null = null;

  protected formatThaiDate(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const day = d.getDate();
    const month = DonationCustomizeModalComponent.THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  }

  ngOnInit(): void {
    if (this.donation.donorName) {
      this.donorName.set(this.donation.donorName);
    }
    if (this.donation.imageUrl) {
      this.previewUrl.set(this.donation.imageUrl);
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.processingText.set('กำลังปรับแต่งขนาดภาพ...');

    try {
      const processed = await this.imageProcessor.process(file, 0.9, 600);
      this.processedCover = processed;

      if (this.objectUrlToRevoke) {
        URL.revokeObjectURL(this.objectUrlToRevoke);
      }
      this.objectUrlToRevoke = URL.createObjectURL(processed.blob);
      this.previewUrl.set(this.objectUrlToRevoke);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'ไม่สามารถประมวลผลรูปภาพได้');
      input.value = '';
    } finally {
      this.isProcessing.set(false);
      this.processingText.set('');
    }
  }

  protected async submit(): Promise<void> {
    const name = this.donorName().trim();
    if (!name) {
      this.errorMessage.set('กรุณาระบุชื่อผู้บริจาค (หรือนามแฝง)');
      return;
    }
    if (name.length > 400) {
      this.errorMessage.set('ชื่อผู้บริจาคต้องมีความยาวไม่เกิน 400 ตัวอักษร');
      return;
    }

    const user = this.authService.user();
    if (!user) {
      this.errorMessage.set('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
      return;
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.statusMessage.show('กำลังบันทึกข้อมูลผู้สนับสนุน...', 'info');

    try {
      let finalImageUrl = this.donation.imageUrl || '';

      if (this.processedCover) {
        this.processingText.set('กำลังอัปโหลดรูปภาพ...');
        finalImageUrl = await this.coverStorage.upload(
          this.donation.id,
          this.processedCover.blob,
          this.processedCover.filename
        );
      }

      this.processingText.set('กำลังบันทึกข้อมูล...');
      await this.donationRepo.updateDonorProfile(
        this.donation.id,
        name,
        finalImageUrl,
        user.uid,
        this.authService.isAdmin()
      );

      const updated: Donation = {
        ...this.donation,
        donorName: name,
        imageUrl: finalImageUrl,
        isCustomized: true,
        customizedAt: new Date().toISOString(),
        redeemedBy: user.uid
      };

      this.statusMessage.show('บันทึกข้อมูลผู้สนับสนุนสำเร็จ ขอบคุณที่ร่วมสนับสนุนครับ', 'success');
      this.saved.emit(updated);
    } catch (err: any) {
      const msg = err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      this.errorMessage.set(msg);
      this.statusMessage.show(msg, 'error');
    } finally {
      this.isProcessing.set(false);
      this.processingText.set('');
    }
  }

  protected close(): void {
    if (this.isProcessing()) return;
    this.closed.emit();
  }
}
