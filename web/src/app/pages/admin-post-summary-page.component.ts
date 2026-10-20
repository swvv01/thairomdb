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

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossOrigin attribute in case of origin mismatch
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = url;
    };
    img.src = url;
  });
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
    const groups = this.translatorGroups();

    if (groups.length === 0) {
      return `📢 อัปเดตเกมแปลไทยวันนี้ 🎮✨\n(รวมทั้งหมด 0 เกม)\n\n(ไม่พบเกมที่อัปเดตในช่วงเวลาดังกล่าว)`;
    }

    const body = groups.map((g) => {
      const games = g.games.map((game) => `- ${game.gameTitle} [${game.system}]`).join('\n');
      return `🕹️ ${g.translatorName} (${g.games.length} เกม)\n${games}`;
    }).join('\n\n');

    return `📢 อัปเดตเกมแปลไทยวันนี้ 🎮✨\n(รวมทั้งหมด ${totalGames} เกม)\n\n${body}\n\n#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming`;
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

      // Max 4 columns, each column fixed to 256px -> total width <= 1024px
      const cols = Math.min(4, Math.max(1, validImages.length));
      const colWidth = 256;
      const canvasWidth = cols * colWidth;

      const packItems: ColumnPackItem<{ patch: Patch; img: HTMLImageElement }>[] = validImages.map((entry) => {
        const naturalW = entry.img.naturalWidth || entry.img.width || 250;
        const naturalH = entry.img.naturalHeight || entry.img.height || 350;
        const scaledH = Math.round(naturalH * (colWidth / naturalW));
        return { item: entry, height: scaledH };
      });

      const columns = distributeIntoColumns(packItems, cols);

      // Calculate heights of each column
      const columnHeights = columns.map((colImgs) => {
        return colImgs.reduce((sum, item) => {
          const naturalW = item.img.naturalWidth || item.img.width || 250;
          const naturalH = item.img.naturalHeight || item.img.height || 350;
          const scaledH = Math.round(naturalH * (colWidth / naturalW));
          return sum + scaledH;
        }, 0);
      });

      const maxCoverHeight = Math.max(...columnHeights, 200);
      const lastColHeight = columnHeights[cols - 1] || 0;

      // Ensure at least 95px at bottom of the last column for logo and URL
      const canvasHeight = Math.max(maxCoverHeight, lastColHeight + 95);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');

      // Theme background color with 3D Perspective Synthwave Grid Floor
      drawSynthwaveBackground(ctx, canvasWidth, canvasHeight);

      // Draw covers vertically in each column
      for (let c = 0; c < cols; c++) {
        const x = c * colWidth;
        let y = 0;
        for (const item of columns[c]) {
          const naturalW = item.img.naturalWidth || item.img.width || 250;
          const naturalH = item.img.naturalHeight || item.img.height || 350;
          const scaledH = Math.round(naturalH * (colWidth / naturalW));
          ctx.drawImage(item.img, x, y, colWidth, scaledH);
          y += scaledH;
        }
      }

      // Draw Logo & Website URL at bottom right
      const logoImg = await loadImage('assets/images/logo.png');
      const targetLogoW = Math.min(220, colWidth - 24);
      const targetLogoH = logoImg ? Math.round(targetLogoW * ((logoImg.naturalHeight || 114) / (logoImg.naturalWidth || 750))) : 34;

      const padRight = 18;
      const padBottom = 16;
      const urlText = 'thairomdb.pages.dev';

      const logoX = canvasWidth - targetLogoW - padRight;
      const logoY = canvasHeight - targetLogoH - 26 - padBottom;
      const logoCenterX = logoX + (targetLogoW / 2);

      if (logoImg) {
        ctx.drawImage(logoImg, logoX, logoY, targetLogoW, targetLogoH);
      } else {
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 22px "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('THAI ROM DB', logoCenterX, logoY + targetLogoH);
      }

      // URL text centered horizontally relative to the logo width with color #00ffff
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 15px "Segoe UI", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(urlText, logoCenterX, logoY + targetLogoH + 8);

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
