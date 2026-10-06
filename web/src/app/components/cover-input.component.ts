import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { ImageProcessorService } from '../services/image-processor.service';
import { ImageCropperModalComponent } from './image-cropper-modal.component';

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
  @Output() selected = new EventEmitter<Blob>();
  private readonly processor = inject(ImageProcessorService);
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rawBlob = signal<Blob | null>(null);
  protected readonly isCropped = signal(false);
  protected readonly cropperOpen = signal(false);
  @ViewChild('coverFile') private coverFile?: ElementRef<HTMLInputElement>;

  clear(): void {
    const previewUrl = this.preview();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.preview.set(null);
    this.error.set(null);
    this.rawBlob.set(null);
    this.isCropped.set(false);
    this.cropperOpen.set(false);
    if (this.coverFile) this.coverFile.nativeElement.value = '';
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

  protected async onCropped(blob: Blob): Promise<void> {
    this.closeCropper();
    this.isCropped.set(true);
    await this.process(blob, false);
  }

  protected async resetToOriginal(): Promise<void> {
    const raw = this.rawBlob();
    if (raw) {
      await this.process(raw, true);
    }
  }

  protected async process(source: Blob, isNewRaw = true): Promise<void> {
    this.error.set(null);
    try {
      if (isNewRaw) {
        this.rawBlob.set(source);
        this.isCropped.set(false);
      }
      const result = await this.processor.process(source);
      const oldPreview = this.preview();
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      this.preview.set(URL.createObjectURL(result.blob));
      this.selected.emit(result.blob);
    } catch (error) {
      this.preview.set(null);
      this.error.set(error instanceof Error ? error.message : 'ไม่สามารถประมวลผลรูปภาพได้');
    }
  }
}
