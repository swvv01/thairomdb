import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild, signal } from '@angular/core';

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
  @Input({ required: true }) imageBlob!: Blob;
  @Output() readonly cropped = new EventEmitter<Blob>();
  @Output() readonly cancelled = new EventEmitter<void>();

  @ViewChild('stageRef') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('stageImg') private stageImgRef?: ElementRef<HTMLImageElement>;

  protected readonly imageUrl = signal<string>('');
  protected readonly box = signal<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  protected readonly cropWidthPx = signal<number>(0);
  protected readonly cropHeightPx = signal<number>(0);

  private dragMode: string | null = null;
  private startPointer = { x: 0, y: 0 };
  private startStagePos = { x: 0, y: 0 };
  private startBox: CropBox = { x: 0, y: 0, w: 0, h: 0 };
  private hasDrawn = false;

  ngOnInit(): void {
    this.imageUrl.set(URL.createObjectURL(this.imageBlob));
  }

  ngOnDestroy(): void {
    const url = this.imageUrl();
    if (url) URL.revokeObjectURL(url);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cancelled.emit();
  }

  protected onImageLoaded(): void {
    requestAnimationFrame(() => this.resetSelection());
  }

  protected resetSelection(): void {
    const img = this.stageImgRef?.nativeElement;
    if (!img || img.clientWidth <= 0 || img.clientHeight <= 0) return;

    const w = img.clientWidth;
    const h = img.clientHeight;
    this.updateBox({ x: 0, y: 0, w, h });
  }

  protected onStagePointerDown(event: PointerEvent): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const stageX = event.clientX - rect.left;
    const stageY = event.clientY - rect.top;

    this.dragMode = 'draw';
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startStagePos = { x: stageX, y: stageY };
    this.startBox = { ...this.box() };
    this.hasDrawn = false;
  }

  protected onPointerDown(event: PointerEvent, mode: string): void {
    event.stopPropagation();
    event.preventDefault();

    const img = this.stageImgRef?.nativeElement;
    const currentBox = this.box();
    const isFullSize = img && currentBox.w >= img.clientWidth - 4 && currentBox.h >= img.clientHeight - 4;

    if (mode === 'move' && isFullSize) {
      this.onStagePointerDown(event);
      return;
    }

    this.dragMode = mode;
    this.startPointer = { x: event.clientX, y: event.clientY };
    this.startBox = { ...currentBox };
  }

  @HostListener('window:pointermove', ['$event'])
  protected onWindowPointerMove(event: PointerEvent): void {
    if (!this.dragMode) return;
    const img = this.stageImgRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    if (!img || !stage) return;

    const maxW = img.clientWidth;
    const maxH = img.clientHeight;
    if (maxW <= 0 || maxH <= 0) return;

    if (this.dragMode === 'draw') {
      const rect = stage.getBoundingClientRect();
      const curX = Math.max(0, Math.min(event.clientX - rect.left, maxW));
      const curY = Math.max(0, Math.min(event.clientY - rect.top, maxH));
      const dist = Math.hypot(event.clientX - this.startPointer.x, event.clientY - this.startPointer.y);

      if (dist > 5 || this.hasDrawn) {
        this.hasDrawn = true;
        const x = Math.min(this.startStagePos.x, curX);
        const y = Math.min(this.startStagePos.y, curY);
        const w = Math.max(20, Math.abs(curX - this.startStagePos.x));
        const h = Math.max(20, Math.abs(curY - this.startStagePos.y));
        this.updateBox({ x, y, w, h });
      }
      return;
    }

    const dx = event.clientX - this.startPointer.x;
    const dy = event.clientY - this.startPointer.y;
    let { x, y, w, h } = this.startBox;

    if (this.dragMode === 'move') {
      const maxX = Math.max(0, maxW - w);
      const maxY = Math.max(0, maxH - h);
      x = Math.max(0, Math.min(x + dx, maxX));
      y = Math.max(0, Math.min(y + dy, maxY));
    } else {
      if (this.dragMode.includes('e')) {
        w = Math.max(20, Math.min(this.startBox.w + dx, maxW - this.startBox.x));
      }
      if (this.dragMode.includes('s')) {
        h = Math.max(20, Math.min(this.startBox.h + dy, maxH - this.startBox.y));
      }
      if (this.dragMode.includes('w')) {
        const nextW = Math.max(20, Math.min(this.startBox.w - dx, this.startBox.x + this.startBox.w));
        const nextX = this.startBox.x + (this.startBox.w - nextW);
        w = nextW;
        x = nextX;
      }
      if (this.dragMode.includes('n')) {
        const nextH = Math.max(20, Math.min(this.startBox.h - dy, this.startBox.y + this.startBox.h));
        const nextY = this.startBox.y + (this.startBox.h - nextH);
        h = nextH;
        y = nextY;
      }
    }

    this.updateBox({ x, y, w, h });
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  protected onWindowPointerUp(): void {
    this.dragMode = null;
    this.hasDrawn = false;
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

    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    this.cropWidthPx.set(Math.round(clampedW * scaleX));
    this.cropHeightPx.set(Math.round(clampedH * scaleY));
  }

  protected confirmCrop(): void {
    const img = this.stageImgRef?.nativeElement;
    if (!img || img.clientWidth <= 0 || img.clientHeight <= 0) return;

    const currentBox = this.box();
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const sx = Math.max(0, Math.round(currentBox.x * scaleX));
    const sy = Math.max(0, Math.round(currentBox.y * scaleY));
    const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(currentBox.w * scaleX)));
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(currentBox.h * scaleY)));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    canvas.toBlob((blob) => {
      if (blob) {
        this.cropped.emit(blob);
      }
    }, 'image/png');
  }
}
