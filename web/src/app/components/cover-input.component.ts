import { Component, DestroyRef, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { ImageProcessorService } from '../services/image-processor.service';
import { CropRect, CropResult, ImageCropperModalComponent } from './image-cropper-modal.component';

@Component({
  selector: 'app-cover-input',
  standalone: true,
  imports: [ImageCropperModalComponent],
  templateUrl: './cover-input.component.html',
  styleUrl: './cover-input.component.css'
})
export class CoverInputComponent {
  @Input() gameTitle = '';
  @Input() system = '';
  @Input() set existingCoverUrl(value: string | null | undefined) {
    const url = value?.trim() || null;
    this._existingCoverUrl.set(url);
    if (!this.rawBlob()) {
      this.revokePreviewBlob();
      this.preview.set(url);
    }
  }
  get existingCoverUrl(): string | null {
    return this._existingCoverUrl();
  }
  @Output() selected = new EventEmitter<Blob | undefined>();
  private readonly processor = inject(ImageProcessorService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rawBlob = signal<Blob | null>(null);
  protected readonly isCropped = signal(false);
  protected readonly cropperOpen = signal(false);
  protected readonly lastCrop = signal<CropRect | null>(null);
  protected readonly _existingCoverUrl = signal<string | null>(null);
  @ViewChild('coverFile') private coverFile?: ElementRef<HTMLInputElement>;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreviewBlob());
  }

  private revokePreviewBlob(): void {
    const previewUrl = this.preview();
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }

  clear(): void {
    this.revokePreviewBlob();
    this.preview.set(null);
    this.error.set(null);
    this.rawBlob.set(null);
    this.isCropped.set(false);
    this.cropperOpen.set(false);
    this.lastCrop.set(null);
    this._existingCoverUrl.set(null);
    if (this.coverFile) this.coverFile.nativeElement.value = '';
    this.selected.emit(undefined);
  }

  protected revertToExisting(): void {
    this.revokePreviewBlob();
    this.error.set(null);
    this.rawBlob.set(null);
    this.isCropped.set(false);
    this.cropperOpen.set(false);
    this.lastCrop.set(null);
    if (this.coverFile) this.coverFile.nativeElement.value = '';
    this.preview.set(this._existingCoverUrl());
    this.selected.emit(undefined);
  }

  protected async select(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await this.process(file);
  }

  protected async readFromClipboard(): Promise<void> {
    this.error.set(null);

    try {
      if (!navigator.clipboard?.read) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการดึงรูปจาก Clipboard');
      }

      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          await this.process(await item.getType(imageType));
          return;
        }
      }

      throw new Error('ไม่พบรูปภาพใน Clipboard');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'ไม่สามารถอ่านรูปจาก Clipboard ได้');
    }
  }

  protected searchCoverImage(): void {
    const title = this.gameTitle.trim();
    if (!title) {
      this.error.set('กรุณาระบุชื่อเกมก่อนค้นหารูปภาพ');
      return;
    }
    const system = this.system.trim();
    const query = encodeURIComponent(`${title}${system ? ` ${system}` : ''} box art launchbox`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank', 'noopener,noreferrer');
  }

  @HostListener('document:paste', ['$event'])
  protected async paste(event: ClipboardEvent): Promise<void> {
    const image = Array.from(event.clipboardData?.items ?? [])
      .find((item) => item.type.startsWith('image/'))?.getAsFile();
    if (image) {
      event.preventDefault();
      await this.process(image);
    }
  }

  protected openCropper(): void {
    if (this.rawBlob()) {
      this.cropperOpen.set(true);
    }
  }

  protected closeCropper(): void {
    this.cropperOpen.set(false);
  }

  protected async onCropped(result: CropResult): Promise<void> {
    this.closeCropper();
    this.lastCrop.set(result.cropRect);
    this.isCropped.set(true);
    await this.process(result.blob, false);
  }

  protected async resetToOriginal(): Promise<void> {
    const raw = this.rawBlob();
    if (raw) {
      this.lastCrop.set(null);
      await this.process(raw, true);
    }
  }

  protected async process(source: Blob, isNewRaw = true): Promise<void> {
    this.error.set(null);
    try {
      if (isNewRaw) {
        this.rawBlob.set(source);
        this.isCropped.set(false);
        this.lastCrop.set(null);
      }
      const result = await this.processor.process(source);
      this.revokePreviewBlob();
      this.preview.set(URL.createObjectURL(result.blob));
      this.selected.emit(result.blob);
    } catch (error) {
      this.preview.set(null);
      this.error.set(error instanceof Error ? error.message : 'ไม่สามารถประมวลผลรูปภาพได้');
    }
  }
}
