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
 * Draws a rectangular/square tile at (x, y, w, h) with clipping and image center-crop.
 */
export function drawTiltedTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  drawContent: () => void
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  drawContent();
  ctx.restore();
}

/**
 * Calculates optimal rotated grid dimensions (cols and rows) based on total items.
 */
export function calculateDiagonalGridCols(totalItems: number): number {
  const needed = totalItems + 1;
  // A tilted grid covers roughly cols * cols tiles
  return Math.max(3, Math.ceil(Math.sqrt(needed * 1.25)));
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
  imports: [CommonModule, FormsModule, RouterLink],
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

  // Default: current time - 24 hours to current time
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
    this.subscriptions.unsubscribe();
  }

  protected resetToDefaultRange(): void {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.toDate.set(toLocalInputString(now));
    this.fromDate.set(toLocalInputString(past24h));
    this.previewImageUrl.set(null);
  }

  protected setPreset(preset: '24h' | 'today' | '3d' | '7d'): void {
    const now = new Date();
    this.toDate.set(toLocalInputString(now));

    if (preset === '24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    } else if (preset === 'today') {
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      this.fromDate.set(toLocalInputString(midnight));
    } else if (preset === '3d') {
      const past = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    } else if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    }

    this.previewImageUrl.set(null);
  }

  protected onFromDateChange(value: string): void {
    this.fromDate.set(value);
    this.previewImageUrl.set(null);
  }

  protected onToDateChange(value: string): void {
    this.toDate.set(value);
    this.previewImageUrl.set(null);
  }

  protected readonly filteredPatches = computed(() => {
    const fromStr = this.fromDate();
    const toStr = this.toDate();
    const fromTime = fromStr ? new Date(fromStr).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = toStr ? new Date(toStr).getTime() : Number.POSITIVE_INFINITY;

    return this.patches().filter((patch) => {
      const timestamp = Date.parse(patch.updateDate);
      if (Number.isNaN(timestamp)) return false;
      return timestamp >= fromTime && timestamp <= toTime;
    });
  });

  protected readonly patchesWithCovers = computed(() => {
    return this.filteredPatches().filter((p) => Boolean(p.coverUrl?.trim()));
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
      games.sort((a, b) => a.gameTitle.localeCompare(b.gameTitle, 'th', { sensitivity: 'base' }));
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
    const totalGames = this.filteredPatches().length;
    const allGamesCount = this.patches().length;
    const groups = this.translatorGroups();

    if (groups.length === 0) {
      return `📢 อัปเดตเกมแปลไทยวันนี้ 🎮✨\n(รวมทั้งหมด 0 เกม)\n\n(ไม่พบเกมที่อัปเดตในช่วงเวลาดังกล่าว)`;
    }

    const body = groups.map((g) => {
      const games = g.games.map((game) => {
        const statusEmoji = game.haveUpdateFlag ? '🔄' : '✨';
        return `- ${game.gameTitle} [${game.system}] ${statusEmoji}`;
      }).join('\n');
      return `${g.translatorName} (${g.games.length} เกม)\n${games}`;
    }).join('\n\n');

    return `📢 อัปเดตเกมแปลไทยวันนี้ 🎮✨\n(รวมทั้งหมด ${totalGames} เกม)\n\n${body}\n\n🌐 รวมเกมแปลไทยทั้งหมดในระบบ ${allGamesCount} เกม\n\n#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming`;
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

      // Diagonal Rotated Grid Layout (เอียงระนาบทั้งผืน 45 องศา ชิดติดกัน 100% เหมือนรูปต้นแบบ)
      const canvasSize = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');

      // 1. Fill base background color #35006c
      ctx.fillStyle = '#35006c';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // 2. Setup rotated grid parameters
      const N = calculateDiagonalGridCols(validImages.length);
      const halfSize = canvasSize / 2;
      const diagonalBound = canvasSize * Math.SQRT2; // ~1448px
      const borderGap = 16; // 16px wide border gap as requested
      const step = diagonalBound / N;
      const tileSize = step - borderGap;

      // Identify slots on the rotated grid
      interface RotatedSlot {
        col: number;
        row: number;
        centerX: number;
        centerY: number;
      }

      const allSlots: RotatedSlot[] = [];
      const angle = Math.PI / 4; // 45 degrees
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Enumerate slots covering the full canvas
      const startIdx = -Math.floor(N / 2) - 1;
      const endIdx = Math.ceil(N / 2) + 1;

      for (let r = startIdx; r <= endIdx; r++) {
        for (let c = startIdx; c <= endIdx; c++) {
          const localX = (c + 0.5) * step;
          const localY = (r + 0.5) * step;
          // Rotate around center (halfSize, halfSize)
          const rotX = halfSize + (localX * cosA - localY * sinA);
          const rotY = halfSize + (localX * sinA + localY * cosA);

          // Check if slot falls within or intersects the canvas
          const margin = step * 0.8;
          if (rotX >= -margin && rotX <= canvasSize + margin && rotY >= -margin && rotY <= canvasSize + margin) {
            allSlots.push({ col: c, row: r, centerX: rotX, centerY: rotY });
          }
        }
      }

      // Sort slots so central ones get populated first
      allSlots.sort((a, b) => {
        const distA = Math.hypot(a.centerX - halfSize, a.centerY - halfSize);
        const distB = Math.hypot(b.centerX - halfSize, b.centerY - halfSize);
        return distA - distB;
      });

      // Prepare image list: Put all validImages first, then fill remaining slots by randomly picking from validImages
      const assignedImages: HTMLImageElement[] = [];
      for (let i = 0; i < allSlots.length; i++) {
        if (i < validImages.length) {
          assignedImages.push(validImages[i].img);
        } else {
          // Randomly pick from existing validImages to fill extra slots
          const randIdx = Math.floor(Math.random() * validImages.length);
          assignedImages.push(validImages[randIdx].img);
        }
      }

      // 3. Render rotated grid onto canvas
      ctx.save();
      // Translate to center and rotate 45 degrees
      ctx.translate(halfSize, halfSize);
      ctx.rotate(angle);

      // Draw each tile in the rotated coordinate space
      for (let i = 0; i < allSlots.length; i++) {
        const slot = allSlots[i];
        const localX = (slot.col + 0.5) * step - (tileSize / 2);
        const localY = (slot.row + 0.5) * step - (tileSize / 2);
        const img = assignedImages[i];

        drawTiltedTile(ctx, localX, localY, tileSize, tileSize, () => {
          const naturalW = img.naturalWidth || img.width || 250;
          const naturalH = img.naturalHeight || img.height || 250;
          const cropSize = Math.min(naturalW, naturalH);
          const sx = Math.max(0, Math.floor((naturalW - cropSize) / 2));
          const sy = Math.max(0, Math.floor((naturalH - cropSize) / 2));

          // Rotate image opposite (-45 deg) inside tile to keep covers upright
          ctx.save();
          ctx.translate(localX + tileSize / 2, localY + tileSize / 2);
          ctx.rotate(-angle);
          const uprightDim = tileSize * Math.SQRT2;
          ctx.drawImage(
            img,
            sx,
            sy,
            cropSize,
            cropSize,
            -uprightDim / 2,
            -uprightDim / 2,
            uprightDim,
            uprightDim
          );
          ctx.restore();
        });
      }

      ctx.restore();

      // 4. Draw Logo and URL Overlay at bottom-right corner with drop shadow
      const logoImg = await loadImage('assets/images/logo.png');
      const targetLogoW = 210;
      const targetLogoH = logoImg ? Math.round(targetLogoW * ((logoImg.naturalHeight || 114) / (logoImg.naturalWidth || 750))) : 32;

      // Balanced padding top & bottom
      const padRight = 8;
      const padBottom = 8;
      const padTop = padBottom;
      const textGap = 8;
      const textH = 18; // approx line height for 15px font
      const totalBlockH = targetLogoH + textGap + textH; // total content height ~58px

      const logoX = canvasSize - targetLogoW - padRight;
      const logoY = canvasSize - totalBlockH - padBottom;
      const centerX = logoX + (targetLogoW / 2);

      // Long horizontal fade background with balanced top/bottom coverage
      ctx.save();
      const fadeWidth = 520; // extended horizontal fade length
      const fadeStartX = canvasSize - fadeWidth;
      const fadeTopY = logoY - padTop; // balanced top padding equals padBottom
      const fadeHeight = canvasSize - fadeTopY; // extends seamlessly to bottom

      const hGrad = ctx.createLinearGradient(fadeStartX, 0, canvasSize, 0);
      hGrad.addColorStop(0, 'rgba(20, 0, 45, 0)');
      hGrad.addColorStop(0.25, 'rgba(20, 0, 45, 0.45)');
      hGrad.addColorStop(0.55, 'rgba(24, 0, 52, 0.78)');
      hGrad.addColorStop(1, 'rgba(26, 0, 56, 0.94)');

      ctx.fillStyle = hGrad;
      ctx.fillRect(fadeStartX, fadeTopY, fadeWidth, fadeHeight);
      ctx.restore();

      // Drop shadow for logo and text
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

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      this.previewImageUrl.set(dataUrl);
      this.statusMessageService.show('สร้างรูปภาพตัวอย่างสำเร็จ', 'success');
    } catch (error) {
      this.statusMessageService.show(error instanceof Error ? error.message : 'ไม่สามารถสร้างรูปภาพได้', 'error');
    } finally {
      this.generatingImage.set(false);
    }
  }

  protected downloadImage(): void {
    const url = this.previewImageUrl();
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `thairomdb-covers-${toLocalInputString(new Date()).replace(/[:T]/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.statusMessageService.show('ดาวน์โหลดรูปภาพสำเร็จ', 'success');
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
