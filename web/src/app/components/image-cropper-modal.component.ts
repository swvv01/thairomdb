import { Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, ViewChild, inject, signal } from '@angular/core';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropResult {
  blob: Blob;
  cropRect: CropRect;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

@Component({
  selector: 'app-image-cropper-modal',
  standalone: true,
  templateUrl: './image-cropper-modal.component.html',
  styleUrl: './image-cropper-modal.component.css'
})
export class ImageCropperModalComponent implements OnInit, OnDestroy {
  @Input() imageSource?: Blob | string | null;
  @Input() set imageBlob(blob: Blob | undefined | null) {
    if (blob) {
      this.imageSource = blob;
    }
  }
  @Input() initialCrop?: CropRect | null;
  @Output() readonly cropped = new EventEmitter<CropResult>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly loadFailed = new EventEmitter<void>();

  private readonly ngZone = inject(NgZone);

  @ViewChild('stageRef') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('stageImg') private stageImgRef?: ElementRef<HTMLImageElement>;

  protected readonly imageUrl = signal<string>('');
  protected readonly box = signal<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  protected readonly confirming = signal(false);
  protected readonly loadError = signal(false);

  private dragMode: string | null = null;
  private startPointer = { x: 0, y: 0 };
  private startStagePos = { x: 0, y: 0 };
  private startBox: CropBox = { x: 0, y: 0, w: 0, h: 0 };
  private hasDrawn = false;
  private createdObjectUrl: string | null = null;

  ngOnInit(): void {
    if (typeof this.imageSource === 'string') {
      const url = this.imageSource;
      const isRemote = url.startsWith('http://') || url.startsWith('https://');
      const cleanUrl = isRemote ? (url.includes('?') ? `${url}&cors=1` : `${url}?cors=1`) : url;
      this.imageUrl.set(cleanUrl);
    } else if (this.imageSource instanceof Blob) {
      this.createdObjectUrl = URL.createObjectURL(this.imageSource);
      this.imageUrl.set(this.createdObjectUrl);
    }
  }

  ngOnDestroy(): void {
    if (this.createdObjectUrl) {
      URL.revokeObjectURL(this.createdObjectUrl);
      this.createdObjectUrl = null;
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cancelled.emit();
  }

  protected onImageLoaded(): void {
    this.loadError.set(false);
    requestAnimationFrame(() => {
      if (this.initialCrop) {
        this.restoreSelection(this.initialCrop);
      } else {
        this.resetSelection();
      }
    });
  }

  protected onImageError(): void {
    this.loadError.set(true);
    this.loadFailed.emit();
  }

  protected resetSelection(): void {
    const img = this.stageImgRef?.nativeElement;
    if (!img || img.clientWidth <= 0 || img.clientHeight <= 0) return;

    const w = img.clientWidth;
    const h = img.clientHeight;
    this.updateBox({ x: 0, y: 0, w, h });
  }

  protected restoreSelection(rect: CropRect): void {
    const img = this.stageImgRef?.nativeElement;
    if (!img || img.clientWidth <= 0 || img.clientHeight <= 0) return;

    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const x = Math.round(rect.x / scaleX);
    const y = Math.round(rect.y / scaleY);
    const w = Math.round(rect.w / scaleX);
    const h = Math.round(rect.h / scaleY);

    this.updateBox({ x, y, w, h });
  }

  protected onStagePointerDown(event: PointerEvent): void {
    const stage = this.stageRef?.nativeElement;
    const img = this.stageImgRef?.nativeElement;
    if (!stage || !img) return;

    const rect = img.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > img.clientWidth || y > img.clientHeight) return;

    event.preventDefault();
    this.hasDrawn = false;
    this.dragMode = 'draw';
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startStagePos = { x, y };

    const onMove = (e: PointerEvent): void => this.onGlobalPointerMove(e);
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      this.dragMode = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  protected onPointerDown(event: PointerEvent, mode: string): void {
    event.stopPropagation();
    event.preventDefault();

    this.dragMode = mode;
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startBox = { ...this.box() };

    const onMove = (e: PointerEvent): void => this.onGlobalPointerMove(e);
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      this.dragMode = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  private onGlobalPointerMove(event: PointerEvent): void {
    if (!this.dragMode) return;
    const img = this.stageImgRef?.nativeElement;
    if (!img) return;

    const dx = event.clientX - this.startPointer.x;
    const dy = event.clientY - this.startPointer.y;

    if (this.dragMode === 'draw') {
      const currentX = Math.max(0, Math.min(this.startStagePos.x + dx, img.clientWidth));
      const currentY = Math.max(0, Math.min(this.startStagePos.y + dy, img.clientHeight));

      const x = Math.min(this.startStagePos.x, currentX);
      const y = Math.min(this.startStagePos.y, currentY);
      const w = Math.abs(currentX - this.startStagePos.x);
      const h = Math.abs(currentY - this.startStagePos.y);

      if (w > 5 || h > 5) {
        this.hasDrawn = true;
      }
      this.updateBox({ x, y, w: Math.max(w, 20), h: Math.max(h, 20) });
      return;
    }

    const b = this.startBox;
    let nextBox: CropBox = { ...b };

    if (this.dragMode === 'move') {
      nextBox.x = b.x + dx;
      nextBox.y = b.y + dy;
    } else {
      if (this.dragMode.includes('w')) {
        const newW = b.w - dx;
        if (newW >= 20) {
          nextBox.x = b.x + dx;
          nextBox.w = newW;
        }
      }
      if (this.dragMode.includes('e')) {
        nextBox.w = Math.max(20, b.w + dx);
      }
      if (this.dragMode.includes('n')) {
        const newH = b.h - dy;
        if (newH >= 20) {
          nextBox.y = b.y + dy;
          nextBox.h = newH;
        }
      }
      if (this.dragMode.includes('s')) {
        nextBox.h = Math.max(20, b.h + dy);
      }
    }

    this.updateBox(nextBox);
  }

  private updateBox(nextBox: CropBox): void {
    const img = this.stageImgRef?.nativeElement;
    if (!img) return;

    const maxW = img.clientWidth;
    const maxH = img.clientHeight;
    if (maxW <= 0 || maxH <= 0) return;

    const clampedX = Math.max(0, Math.min(nextBox.x, maxW - 20));
    const clampedY = Math.max(0, Math.min(nextBox.y, maxH - 20));
    const clampedW = Math.max(20, Math.min(nextBox.w, maxW - clampedX));
    const clampedH = Math.max(20, Math.min(nextBox.h, maxH - clampedY));

    this.box.set({ x: clampedX, y: clampedY, w: clampedW, h: clampedH });
  }

  protected confirmCrop(): void {
    if (this.confirming()) return;
    const img = this.stageImgRef?.nativeElement;
    if (!img || img.clientWidth <= 0 || img.clientHeight <= 0) return;

    const currentBox = this.box();
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const sx = Math.max(0, Math.round(currentBox.x * scaleX));
    const sy = Math.max(0, Math.round(currentBox.y * scaleY));
    const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(currentBox.w * scaleX)));
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(currentBox.h * scaleY)));

    const cropRect: CropRect = { x: sx, y: sy, w: sw, h: sh };

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      this.confirming.set(true);
      canvas.toBlob((blob) => {
        if (blob) {
          this.ngZone.run(() => {
            this.cropped.emit({ blob, cropRect });
          });
        } else {
          this.ngZone.run(() => {
            this.confirming.set(false);
          });
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to crop canvas image:', err);
      this.confirming.set(false);
    }
  }
}
