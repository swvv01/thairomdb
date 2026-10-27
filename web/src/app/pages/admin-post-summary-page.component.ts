import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Patch, Translator } from '../models/patch.models';
import { PatchRepository } from '../repositories/patch.repository';
import { TranslatorRepository } from '../repositories/translator.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { AuthService } from '../services/auth.service';
import { CropRect, CropResult, ImageCropperModalComponent } from '../components/image-cropper-modal.component';

interface TranslatorGroup {
  translatorName: string;
  games: Patch[];
}

function pad(num: number): string {
  return String(num).padStart(2, '0');
}

export function toLocalInputString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Compares two patches prioritizing new games (!haveUpdateFlag) over updates (haveUpdateFlag),
 * then sorting by newest updateDate first, and finally by gameTitle alphabetically.
 */
export function comparePatchesByNewestAndPriority(a: Patch, b: Patch): number {
  const aIsUpdate = Boolean(a.haveUpdateFlag);
  const bIsUpdate = Boolean(b.haveUpdateFlag);

  // New games first (!haveUpdateFlag), update games last (haveUpdateFlag)
  if (!aIsUpdate && bIsUpdate) return -1;
  if (aIsUpdate && !bIsUpdate) return 1;

  // Within the same group, sort by newest updateDate first
  const timeA = Date.parse(a.updateDate) || 0;
  const timeB = Date.parse(b.updateDate) || 0;
  if (timeB !== timeA) {
    return timeB - timeA;
  }

  // Stable secondary fallback: title alphabetical
  return a.gameTitle.localeCompare(b.gameTitle, 'th', { sensitivity: 'base' });
}

export interface ColumnPackItem<T> {
  item: T;
  height: number;
}

/**
 * Calculates optimal grid columns and rows for N items plus 1 branding cell to approximate a 1:1 aspect ratio.
 */
export function calculateSquareGridDimensions(totalItems: number): { cols: number; rows: number } {
  const totalSlots = Math.max(1, totalItems + 1); // +1 slot for Logo & URL
  const cols = Math.ceil(Math.sqrt(totalSlots));
  const rows = Math.ceil(totalSlots / cols);
  return { cols, rows };
}

/**
 * Calculates optimal columns for Masonry grid layout based on total items.
 */
export function calculateMasonryColumnCount(totalItems: number): number {
  if (totalItems <= 1) return 1;
  if (totalItems <= 3) return 2;
  if (totalItems <= 7) return 3;
  if (totalItems <= 14) return 4;
  return 5;
}

/**
 * Cross-platform canvas rounded rect fallback.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, Math.max(0, r));
  } else {
    ctx.rect(x, y, w, h);
  }
}

/**
 * Draws the logo and thairomdb.pages.dev URL overlay at the bottom-right corner.
 */
export function drawBrandingOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  heightOrLogo: number | HTMLImageElement | null,
  logoImgMaybe?: HTMLImageElement | null
): void {
  const height = typeof heightOrLogo === 'number' ? heightOrLogo : width;
  const logoImg = typeof heightOrLogo === 'number' ? (logoImgMaybe ?? null) : heightOrLogo;

  const targetLogoW = 210;
  const targetLogoH = logoImg ? Math.round(targetLogoW * ((logoImg.naturalHeight || 114) / (logoImg.naturalWidth || 750))) : 32;

  const padRight = 8;
  const padBottom = 8;
  const padTop = padBottom;
  const textGap = 8;
  const textH = 18;
  const totalBlockH = targetLogoH + textGap + textH;

  const logoX = width - targetLogoW - padRight;
  const logoY = height - totalBlockH - padBottom;
  const centerX = logoX + (targetLogoW / 2);

  ctx.save();
  const fadeWidth = Math.min(width, 520);
  const fadeStartX = width - fadeWidth;
  const fadeTopY = logoY - padTop;
  const fadeHeight = height - fadeTopY;

  const hGrad = ctx.createLinearGradient(fadeStartX, 0, width, 0);
  hGrad.addColorStop(0, 'rgba(20, 0, 45, 0)');
  hGrad.addColorStop(0.25, 'rgba(20, 0, 45, 0.45)');
  hGrad.addColorStop(0.55, 'rgba(24, 0, 52, 0.78)');
  hGrad.addColorStop(1, 'rgba(26, 0, 56, 0.94)');

  ctx.fillStyle = hGrad;
  ctx.fillRect(fadeStartX, fadeTopY, fadeWidth, fadeHeight);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  if (logoImg) {
    ctx.drawImage(logoImg, logoX, logoY, targetLogoW, targetLogoH);
  } else {
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 22px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('THAI ROM DB', centerX, logoY + targetLogoH);
  }

  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 15px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('thairomdb.pages.dev', centerX, logoY + targetLogoH + textGap);
  ctx.restore();
}

export interface MasonryRenderStats {
  fullCount: number;
  partialGames: Patch[];
  omittedGames: Patch[];
}

/**
 * Renders cover collage using a vertical Masonry Pinterest-style layout in canvas.
 */
export function renderMasonryCollage(
  ctx: CanvasRenderingContext2D,
  width: number,
  heightOrImages: number | Array<{ patch: Patch; img: HTMLImageElement }>,
  imagesOrCols?: Array<{ patch: Patch; img: HTMLImageElement }> | number,
  explicitColsMaybe?: number
): MasonryRenderStats {
  const height = typeof heightOrImages === 'number' ? heightOrImages : width;
  const validImages: Array<{ patch: Patch; img: HTMLImageElement }> = Array.isArray(heightOrImages)
    ? heightOrImages
    : (Array.isArray(imagesOrCols) ? imagesOrCols : []);
  const explicitCols = typeof imagesOrCols === 'number' ? imagesOrCols : explicitColsMaybe;

  ctx.fillStyle = '#35006c';
  ctx.fillRect(0, 0, width, height);

  const total = validImages.length;
  if (total === 0) {
    return { fullCount: 0, partialGames: [], omittedGames: [] };
  }

  const cols = explicitCols && explicitCols >= 1 ? Math.min(10, Math.max(1, explicitCols)) : calculateMasonryColumnCount(total);
  const gap = 14;
  const margin = 16;
  const availableWidth = width - 2 * margin;
  const colWidth = (availableWidth - (cols - 1) * gap) / cols;
  const maxAllowedY = height - margin;

  const colHeights = new Array(cols).fill(0);
  let fullCount = 0;
  const partialGames: Patch[] = [];
  const omittedGames: Patch[] = [];

  for (const entry of validImages) {
    const nw = entry.img.naturalWidth || entry.img.width || 250;
    const nh = entry.img.naturalHeight || entry.img.height || 350;
    const itemH = Math.round(nh * (colWidth / nw));

    // Find column with minimal current height
    let minCol = 0;
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[minCol]) {
        minCol = c;
      }
    }

    const itemX = margin + minCol * (colWidth + gap);
    const itemY = margin + colHeights[minCol];

    // If item starts at or past maxAllowedY, skip completely
    if (itemY >= maxAllowedY) {
      omittedGames.push(entry.patch);
      continue;
    }

    if (itemY + itemH > maxAllowedY) {
      partialGames.push(entry.patch);
      const visibleH = maxAllowedY - itemY;
      const sourceCropH = Math.max(1, Math.round(nh * (visibleH / itemH)));

      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, itemX, itemY, colWidth, visibleH, 6);
      ctx.clip();
      ctx.drawImage(entry.img, 0, 0, nw, sourceCropH, itemX, itemY, colWidth, visibleH);
      ctx.restore();

      colHeights[minCol] += itemH + gap;
    } else {
      fullCount++;
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, itemX, itemY, colWidth, itemH, 6);
      ctx.clip();
      ctx.drawImage(entry.img, itemX, itemY, colWidth, itemH);
      ctx.restore();

      colHeights[minCol] += itemH + gap;
    }
  }

  return { fullCount, partialGames, omittedGames };
}

export function distributeIntoColumns<T>(items: Array<ColumnPackItem<T>>, cols = 4): T[][] {
  if (cols <= 1 || items.length <= 1) {
    return [items.map((x) => x.item)];
  }

  const numCols = Math.min(cols, items.length);
  // เรียงรูปภาพตามความสูงจากมากไปน้อย (ลำดับ 1, 2, 3...)
  const sorted = [...items].sort((a, b) => b.height - a.height);
  const pool = [...sorted];
  const columns: Array<Array<ColumnPackItem<T>>> = Array.from({ length: numCols }, () => []);

  // Row 0: ใส่รูปภาพเรียงตามความสูงจากซ้ายไปขวา (ลำดับ 1, 2, 3, 4)
  for (let c = 0; c < numCols && pool.length > 0; c++) {
    columns[c].push(pool.shift()!);
  }

  // Row ถัดๆ ไป:
  while (pool.length > 0) {
    // คอลัมน์ 0 (ซ้ายสุด) รับภาพถัดไปเป็นตัวตั้งความสูง reference
    columns[0].push(pool.shift()!);

    // คอลัมน์ 1 ถึง numCols - 1
    for (let c = 1; c < numCols; c++) {
      if (pool.length === 0) break;
      columns[c].push(pool.shift()!);

      // ถ้าคอลัมน์ c มีพื้นที่เหลือพอสำหรับใส่รูปที่สั้นที่สุดได้โดยไม่สูงกว่าคอลัมน์ด้านซ้าย (c - 1) ให้เอารูปที่สั้นที่สุดมาใส่เพิ่ม
      const leftH = columns[c - 1].reduce((sum, x) => sum + x.height, 0);
      while (pool.length > 0) {
        const curH = columns[c].reduce((sum, x) => sum + x.height, 0);
        const shortest = pool[pool.length - 1]; // รูปที่สั้นที่สุดอยู่ท้าย pool เสมอ
        if (curH + shortest.height <= leftH) {
          columns[c].push(pool.pop()!);
        } else {
          break;
        }
      }
    }
  }

  return columns.map((col) => col.map((x) => x.item));
}

export function drawSynthwaveBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // 1. Fill base background color #35006c
  ctx.fillStyle = '#35006c';
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle top-to-bottom dark gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, 'rgba(26, 0, 56, 0.45)');
  bgGrad.addColorStop(0.3, 'rgba(53, 0, 108, 0)');
  bgGrad.addColorStop(1, 'rgba(20, 0, 48, 0.35)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. 3D Perspective Synthwave Grid Floor
  const horizonY = Math.round(height * 0.22);
  const vanishX = width / 2;
  const floorHeight = height - horizonY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, width, floorHeight);
  ctx.clip();

  // Perspective Horizontal lines
  const numHorizLines = 20;
  for (let i = 1; i <= numHorizLines; i++) {
    const t = Math.pow(i / numHorizLines, 2.2);
    const lineY = horizonY + t * floorHeight;
    const alpha = 0.08 + t * 0.28;
    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1 + t * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(width, lineY);
    ctx.stroke();
  }

  // Perspective Vertical rays fanning out from vanishing point
  const raySpacing = 44;
  const numRays = Math.ceil(width / raySpacing) + 12;
  const startX = vanishX - (numRays / 2) * raySpacing;

  for (let i = 0; i <= numRays; i++) {
    const bottomX = startX + i * raySpacing;
    const rayGrad = ctx.createLinearGradient(vanishX, horizonY, bottomX, height);
    rayGrad.addColorStop(0, 'rgba(0, 255, 255, 0.04)');
    rayGrad.addColorStop(1, 'rgba(0, 255, 255, 0.32)');
    ctx.strokeStyle = rayGrad;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(vanishX, horizonY);
    ctx.lineTo(bottomX, height);
    ctx.stroke();
  }

  ctx.restore();

  // 4. Subtle horizon glow line
  const horizonGrad = ctx.createLinearGradient(0, 0, width, 0);
  horizonGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
  horizonGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.35)');
  horizonGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
  ctx.strokeStyle = horizonGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();
}

/**
 * Renders a clean 2D retro grid (25x25px) on a deep purple canvas.
 */
export function drawGridBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // 1. Solid deep purple background
  ctx.fillStyle = '#35006c';
  ctx.fillRect(0, 0, width, height);

  // 2. 2D 25x25px cyan grid lines with crisp pixel alignment
  const gridSize = 25;
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }

  for (let y = 0; y <= height; y += gridSize) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }

  ctx.stroke();
}

export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  // If it's a relative URL (like local assets), standard image loading without CORS is safe
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // For external URLs (such as Cloudflare R2), fetch as blob to completely bypass
  // browser image-cache CORS tainting and convert to a clean local blob object URL
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    // If fetch fails (e.g. network issue), attempt clean image loading with anonymous crossOrigin
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      // Append cache-busting timestamp parameter to avoid reading non-CORS cached response
      const sep = url.includes('?') ? '&' : '?';
      img.src = `${url}${sep}_c=1`;
    });
  }
}

@Component({
  selector: 'app-admin-post-summary-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageCropperModalComponent],
  templateUrl: './admin-post-summary-page.component.html',
  styleUrl: './admin-post-summary-page.component.css'
})
export class AdminPostSummaryPageComponent implements OnInit, OnDestroy {
  private readonly patchRepository = inject(PatchRepository);
  private readonly translatorRepository = inject(TranslatorRepository);
  private readonly statusMessageService = inject(StatusMessageService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  private readonly subscriptions = new Subscription();

  protected readonly patches = signal<Patch[]>([]);
  protected readonly translators = signal<Translator[]>([]);
  protected readonly loading = signal(true);
  protected readonly copied = signal(false);

  protected readonly commentLink = 'https://thairomdb.pages.dev';
  protected readonly copiedCommentLink = signal(false);

  protected readonly generatingImage = signal(false);
  protected readonly previewImageUrl = signal<string | null>(null);
  protected readonly rawBlob = signal<Blob | null>(null);
  protected readonly rawImageUrl = signal<string | null>(null);
  protected readonly isCropped = signal(false);
  protected readonly cropperOpen = signal(false);
  protected readonly lastCrop = signal<CropRect | null>(null);

  protected readonly customColumns = signal<number | null>(null);
  protected readonly masonryStats = signal<MasonryRenderStats | null>(null);
  protected readonly showAffectedGames = signal(false);

  protected toggleAffectedGames(): void {
    this.showAffectedGames.update((v) => !v);
  }

  protected openCropper(): void {
    if (this.rawBlob()) {
      this.cropperOpen.set(true);
    }
  }

  protected closeCropper(): void {
    this.cropperOpen.set(false);
  }

  protected onCropped(result: CropResult): void {
    this.lastCrop.set(result.cropRect);
    this.isCropped.set(true);
    this.revokePreviewUrl();
    this.previewImageUrl.set(URL.createObjectURL(result.blob));
    this.closeCropper();
  }

  protected resetToOriginal(): void {
    const raw = this.rawImageUrl();
    if (raw) {
      this.lastCrop.set(null);
      this.isCropped.set(false);
      this.revokePreviewUrl();
      this.previewImageUrl.set(raw);
    }
  }

  private revokePreviewUrl(): void {
    const current = this.previewImageUrl();
    if (current && current.startsWith('blob:') && current !== this.rawImageUrl()) {
      URL.revokeObjectURL(current);
    }
  }

  private revokeAllImageUrls(): void {
    this.revokePreviewUrl();
    const raw = this.rawImageUrl();
    if (raw && raw.startsWith('blob:')) {
      URL.revokeObjectURL(raw);
    }
    this.rawBlob.set(null);
    this.rawImageUrl.set(null);
    this.isCropped.set(false);
    this.lastCrop.set(null);
    this.cropperOpen.set(false);
  }

  private clearPreviewAndStats(): void {
    this.revokeAllImageUrls();
    this.previewImageUrl.set(null);
    this.masonryStats.set(null);
    this.showAffectedGames.set(false);
  }

  protected readonly effectiveMasonryColumns = computed(() => {
    const custom = this.customColumns();
    if (custom !== null) return custom;
    return calculateMasonryColumnCount(this.patchesWithCovers().length);
  });

  protected readonly columnLabel = computed(() => {
    const custom = this.customColumns();
    const autoCols = calculateMasonryColumnCount(this.patchesWithCovers().length);
    if (custom === null) {
      return `Auto (${autoCols})`;
    }
    return `${custom} คอลัมน์`;
  });

  // Default: today (00:00 to 23:59)
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');

  constructor() {
    this.resetToDefaultRange();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.patchRepository.watchAll().subscribe({
        next: (items) => {
          this.patches.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.statusMessageService.show('ไม่สามารถโหลดข้อมูลเกมได้', 'error');
          this.loading.set(false);
        }
      })
    );

    this.subscriptions.add(
      this.translatorRepository.watchAll().subscribe({
        next: (items) => {
          this.translators.set(items);
        },
        error: () => {
          this.statusMessageService.show('ไม่สามารถโหลดข้อมูลทีมแปลได้', 'error');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.clearPreviewAndStats();
    this.subscriptions.unsubscribe();
  }

  protected resetToDefaultRange(): void {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
    this.toDate.set(toLocalInputString(endOfToday));
    this.fromDate.set(toLocalInputString(startOfToday));
    this.clearPreviewAndStats();
  }

  protected setPreset(preset: '24h' | 'today' | '3d' | '7d'): void {
    const now = new Date();

    if (preset === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
      this.toDate.set(toLocalInputString(endOfToday));
      this.fromDate.set(toLocalInputString(startOfToday));
    } else {
      this.toDate.set(toLocalInputString(now));
      if (preset === '24h') {
        const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        this.fromDate.set(toLocalInputString(past));
      } else if (preset === '3d') {
        const past = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        this.fromDate.set(toLocalInputString(past));
      } else if (preset === '7d') {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        this.fromDate.set(toLocalInputString(past));
      }
    }

    this.clearPreviewAndStats();
  }

  protected onFromDateChange(value: string): void {
    this.fromDate.set(value);
    this.clearPreviewAndStats();
  }

  protected onToDateChange(value: string): void {
    this.toDate.set(value);
    this.clearPreviewAndStats();
  }

  protected readonly filteredPatches = computed(() => {
    const fromStr = this.fromDate();
    const toStr = this.toDate();
    const fromTime = fromStr ? new Date(fromStr).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = toStr ? new Date(toStr).getTime() + (toStr.length <= 16 ? 59999 : 0) : Number.POSITIVE_INFINITY;

    return this.patches().filter((patch) => {
      const timestamp = Date.parse(patch.updateDate);
      if (Number.isNaN(timestamp)) return false;
      return timestamp >= fromTime && timestamp <= toTime;
    });
  });

  protected readonly patchesWithCovers = computed(() => {
    return this.filteredPatches()
      .filter((p) => Boolean(p.coverUrl?.trim()))
      .sort(comparePatchesByNewestAndPriority);
  });

  protected readonly translatorGroups = computed<TranslatorGroup[]>(() => {
    const translatorsMap = new Map<string, Translator>();
    for (const t of this.translators()) {
      translatorsMap.set(t.id, t);
    }

    const groupsMap = new Map<string, Patch[]>();

    for (const patch of this.filteredPatches()) {
      const translator = translatorsMap.get(patch.translatorId);
      const name = (translator?.name || translator?.shortName || patch.translatedBy || 'ไม่ระบุทีมแปล').trim();
      const existing = groupsMap.get(name) ?? [];
      existing.push(patch);
      groupsMap.set(name, existing);
    }

    const result: TranslatorGroup[] = [];
    for (const [translatorName, games] of groupsMap.entries()) {
      games.sort(comparePatchesByNewestAndPriority);
      result.push({ translatorName, games });
    }

    result.sort((a, b) => b.games.length - a.games.length || a.translatorName.localeCompare(b.translatorName, 'th', { sensitivity: 'base' }));
    return result;
  });

  protected readonly stats = computed(() => {
    const gameCount = this.filteredPatches().length;
    const translatorCount = this.translatorGroups().length;
    return { gameCount, translatorCount };
  });

  protected readonly postSummaryText = computed(() => {
    const patches = this.filteredPatches();
    const allGamesCount = this.patches().length;
    const groups = this.translatorGroups();

    if (patches.length === 0 || groups.length === 0) {
      return '(ไม่พบเกมที่อัปเดตในช่วงเวลาดังกล่าว)';
    }

    const updateCount = patches.filter((p) => Boolean(p.haveUpdateFlag)).length;
    const newCount = patches.length - updateCount;

    const headerLines = ['📢 อัปเดตเกมแปลไทยวันนี้'];
    if (newCount > 0) {
      headerLines.push(`✨ เกมใหม่ ${newCount} เกม`);
    }
    if (updateCount > 0) {
      headerLines.push(`🔄 เกมอัปเดต ${updateCount} เกม`);
    }
    headerLines.push(`🌐 รวมเกมแปลไทยทั้งหมดในระบบ ${allGamesCount} เกม`);
    const header = headerLines.join('\n');

    const body = groups.map((g) => {
      const games = g.games.map((game) => {
        const statusEmoji = game.haveUpdateFlag ? '🔄' : '✨';
        return `- ${game.gameTitle} [${game.system}] ${statusEmoji}`;
      }).join('\n');
      return `${g.translatorName} (${g.games.length} เกม)\n${games}`;
    }).join('\n\n');

    return `${header}\n\n${body}\n\n#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming`;
  });

  protected async copyText(): Promise<void> {
    const text = this.postSummaryText();
    if (!text) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers or environments without clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      this.copied.set(true);
      this.statusMessageService.show('คัดลอกข้อความสำเร็จ', 'success');
      setTimeout(() => {
        this.copied.set(false);
      }, 2500);
    } catch {
      this.statusMessageService.show('ไม่สามารถคัดลอกข้อความได้ กรุณากดเลือกข้อความและคัดลอกด้วยตนเอง', 'error');
    }
  }

  protected async copyCommentLink(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(this.commentLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = this.commentLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      this.copiedCommentLink.set(true);
      this.statusMessageService.show('คัดลอกลิงก์สำหรับคอมเมนต์เรียบร้อยแล้ว', 'success');
      setTimeout(() => {
        this.copiedCommentLink.set(false);
      }, 2500);
    } catch {
      this.statusMessageService.show('ไม่สามารถคัดลอกลิงก์ได้', 'error');
    }
  }

  protected incrementColumns(): void {
    const cur = this.customColumns();
    const autoCols = calculateMasonryColumnCount(this.patchesWithCovers().length);
    if (cur === null) {
      const next = Math.min(10, autoCols + 1);
      this.customColumns.set(next);
    } else {
      this.customColumns.set(Math.min(10, cur + 1));
    }
    this.clearPreviewAndStats();
  }

  protected decrementColumns(): void {
    const cur = this.customColumns();
    const autoCols = calculateMasonryColumnCount(this.patchesWithCovers().length);
    if (cur === null) {
      if (autoCols <= 1) {
        this.customColumns.set(null);
      } else {
        this.customColumns.set(autoCols - 1);
      }
    } else if (cur <= 1) {
      this.customColumns.set(null);
    } else {
      this.customColumns.set(cur - 1);
    }
    this.clearPreviewAndStats();
  }

  protected async generateImage(): Promise<void> {
    const patches = this.patchesWithCovers();
    if (patches.length === 0) {
      this.statusMessageService.show('ไม่พบเกมที่มีรูปปกในช่วงเวลาที่เลือก', 'info');
      return;
    }

    if (this.generatingImage()) return;
    this.generatingImage.set(true);
    this.statusMessageService.show('กำลังสร้างรูปภาพตัวอย่าง...');

    try {
      const loadedImages = await Promise.all(
        patches.map(async (patch) => ({
          patch,
          img: await loadImage(patch.coverUrl)
        }))
      );

      const validImages = loadedImages.filter((item): item is { patch: Patch; img: HTMLImageElement } => item.img !== null);

      if (validImages.length === 0) {
        throw new Error('ไม่สามารถโหลดรูปปกเกมได้ กรุณาลองใหม่อีกครั้ง');
      }

      const canvasW = 1024;
      const canvasH = 1200;
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');

      const stats = renderMasonryCollage(ctx, canvasW, canvasH, validImages, this.effectiveMasonryColumns());
      this.masonryStats.set(stats);
      this.showAffectedGames.set(false);

      // Convert canvas to blob without baking logo, allowing crop before download
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      });

      if (!blob) throw new Error('ไม่สามารถสร้างไฟล์รูปภาพได้');

      this.revokeAllImageUrls();
      this.rawBlob.set(blob);
      const objUrl = URL.createObjectURL(blob);
      this.rawImageUrl.set(objUrl);
      this.previewImageUrl.set(objUrl);
      this.isCropped.set(false);
      this.lastCrop.set(null);

      if (stats) {
        if (stats.partialGames.length === 0 && stats.omittedGames.length === 0) {
          this.statusMessageService.show(`สร้างรูปภาพตัวอย่างสำเร็จ (แสดงรูปครบทั้ง ${stats.fullCount} รูป)`, 'success');
        } else {
          this.statusMessageService.show(
            `สร้างรูปภาพตัวอย่างสำเร็จ (แสดงเต็ม ${stats.fullCount} รูป, ตัดบางส่วน ${stats.partialGames.length} รูป, ไม่ได้แสดง ${stats.omittedGames.length} รูป)`,
            'success'
          );
        }
      } else {
        this.statusMessageService.show('สร้างรูปภาพตัวอย่างสำเร็จ', 'success');
      }
    } catch (error) {
      this.statusMessageService.show(error instanceof Error ? error.message : 'ไม่สามารถสร้างรูปภาพได้', 'error');
    } finally {
      this.generatingImage.set(false);
    }
  }

  protected async downloadImage(): Promise<void> {
    const url = this.previewImageUrl();
    if (!url) return;

    this.statusMessageService.show('กำลังเตรียมดาวน์โหลดรูปภาพ...');

    try {
      const previewImg = await loadImage(url);
      if (!previewImg) throw new Error('ไม่สามารถโหลดรูปภาพสำหรับดาวน์โหลดได้');

      const outCanvas = document.createElement('canvas');
      const w = previewImg.naturalWidth || previewImg.width;
      const h = previewImg.naturalHeight || previewImg.height;
      outCanvas.width = w;
      outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d');

      if (!outCtx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');

      outCtx.drawImage(previewImg, 0, 0, w, h);

      // Bake branding overlay with logo onto the final image before downloading
      const logoImg = await loadImage('assets/images/logo.png');
      drawBrandingOverlay(outCtx, w, h, logoImg);

      const finalDataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
      const link = document.createElement('a');
      link.href = finalDataUrl;
      link.download = `thairomdb-covers-${toLocalInputString(new Date()).replace(/[:T]/g, '-')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.statusMessageService.show('ดาวน์โหลดรูปภาพสำเร็จ', 'success');
    } catch (error) {
      this.statusMessageService.show(error instanceof Error ? error.message : 'ไม่สามารถดาวน์โหลดรูปภาพได้', 'error');
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
