import { Injectable } from '@angular/core';
import { Donation } from '../models/donation.models';

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Add cache buster for external URLs to ensure fresh CORS handshake
    const url = src.startsWith('http')
      ? (src.includes('?') ? `${src}&t=${Date.now()}` : `${src}?t=${Date.now()}`)
      : src;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If direct Image loading fails (e.g. CORS cache collision), try fetch blob
      if (src.startsWith('http')) {
        fetch(url, { mode: 'cors' })
          .then((res) => {
            if (!res.ok) throw new Error('Fetch status ' + res.status);
            return res.blob();
          })
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const blobImg = new Image();
            blobImg.onload = () => {
              URL.revokeObjectURL(blobUrl);
              resolve(blobImg);
            };
            blobImg.onerror = () => {
              URL.revokeObjectURL(blobUrl);
              reject(new Error(`Failed to load image via blob: ${src}`));
            };
            blobImg.src = blobUrl;
          })
          .catch(() => reject(new Error(`Failed to load image: ${src}`)));
      } else {
        reject(new Error(`Failed to load image: ${src}`));
      }
    };
    img.src = url;
  });
}

@Injectable({
  providedIn: 'root'
})
export class CertificateGeneratorService {
  private static readonly THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  formatThaiDate(isoString: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const day = d.getDate();
    const month = CertificateGeneratorService.THAI_MONTHS[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `วันที่ ${day} ${month} ${year}`;
  }

  async generateCertificateBlob(donation: Donation): Promise<Blob> {
    const computed = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const colorSurface = computed?.getPropertyValue('--color-surface-light')?.trim() || '#371a7e';
    const colorAccent = computed?.getPropertyValue('--color-accent')?.trim() || '#8eb629';
    const colorHighlight = computed?.getPropertyValue('--color-highlight')?.trim() || '#ffd92b';
    const colorText = computed?.getPropertyValue('--color-text')?.trim() || '#ffffff';
    const colorTextMuted = computed?.getPropertyValue('--color-text-muted')?.trim() || '#a8abd9';
    const colorShadow = computed?.getPropertyValue('--color-shadow')?.trim() || '#080808';

    // 1. Ensure project font 'RD Chulajaruek' is loaded and ready
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await Promise.all([
          document.fonts.load('bold 44px "RD Chulajaruek"'),
          document.fonts.load('bold 48px "RD Chulajaruek"'),
          document.fonts.load('900 84px "RD Chulajaruek"'),
          document.fonts.load('bold 32px "RD Chulajaruek"'),
          document.fonts.load('normal 28px "RD Chulajaruek"'),
          document.fonts.load('bold 28px "RD Chulajaruek"')
        ]);
        await document.fonts.ready;
      } catch (fontErr) {
        console.warn('Font preload failed:', fontErr);
      }
    }

    // 2. Load Images
    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = await loadImage('assets/images/logo.png');
    } catch {
      logoImg = null;
    }

    let donorImg: HTMLImageElement | null = null;
    if (donation.imageUrl) {
      try {
        donorImg = await loadImage(donation.imageUrl);
      } catch {
        // Fallback to placeholder if R2 or network fails
        try {
          donorImg = await loadImage('assets/images/donator.webp');
        } catch {
          donorImg = null;
        }
      }
    } else {
      try {
        donorImg = await loadImage('assets/images/donator.webp');
      } catch {
        donorImg = null;
      }
    }

    // 2. Compute Canvas Dimensions
    const canvasWidth = 1080;
    const cardPaddingTop = 60;
    const cardPaddingBottom = 60;

    // Photo dimensions (width 560px, height proportional)
    const photoWidth = 560;
    let photoHeight = 360;
    if (donorImg && donorImg.naturalWidth > 0 && donorImg.naturalHeight > 0) {
      photoHeight = Math.round(photoWidth * (donorImg.naturalHeight / donorImg.naturalWidth));
    }

    // Calculate dynamic canvas height
    let yCursor = cardPaddingTop;

    // Logo height
    const logoHeight = 65;
    yCursor += logoHeight + 24;

    // Title: ขอขอบพระคุณผู้สนับสนุน
    yCursor += 44 + 32;

    // Photo section
    yCursor += photoHeight + 36;

    // Donor Name
    yCursor += 48 + 24;

    // Amount lines:
    // "บริจาคเงิน" (32) + Gap (12) + "Amount" (84) + Gap (12) + "บาท" (32)
    yCursor += 32 + 12 + 84 + 12 + 32 + 28;

    // "ให้แก่ THAI ROM DB"
    yCursor += 32 + 16;

    // Date
    yCursor += 28 + 16;

    // "ขอขอบคุณมา ณ โอกาสนี้"
    yCursor += 28 + cardPaddingBottom;

    const canvasHeight = yCursor;

    // 3. Create Canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ไม่สามารถสร้าง 2D Canvas context ได้');

    // Smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 100% Solid Opaque Background (NO transparent margins)
    ctx.fillStyle = colorSurface;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Decorative Accent Border (Inset 16px from edges, NO outer shadow)
    const borderInset = 16;
    ctx.strokeStyle = colorAccent;
    ctx.lineWidth = 6;
    drawRoundRect(
      ctx,
      borderInset,
      borderInset,
      canvasWidth - borderInset * 2,
      canvasHeight - borderInset * 2,
      20
    );
    ctx.stroke();

    // Draw Content Centered
    const centerX = canvasWidth / 2;
    let currentY = cardPaddingTop;

    // 4. Logo
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoTargetWidth = Math.round(logoHeight * logoAspect);
      ctx.drawImage(logoImg, centerX - logoTargetWidth / 2, currentY, logoTargetWidth, logoHeight);
    }
    currentY += logoHeight + 24;

    // 5. Headline "ขอขอบพระคุณผู้สนับสนุน"
    ctx.fillStyle = colorText;
    ctx.font = 'bold 44px "RD Chulajaruek", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ขอขอบพระคุณผู้สนับสนุน', centerX, currentY);
    currentY += 44 + 32;

    // 6. Photo
    const photoX = centerX - photoWidth / 2;
    const photoY = currentY;

    if (donorImg) {
      ctx.save();
      drawRoundRect(ctx, photoX, photoY, photoWidth, photoHeight, 18);
      ctx.clip();
      ctx.drawImage(donorImg, photoX, photoY, photoWidth, photoHeight);
      ctx.restore();

      // Subtle photo border
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 3;
      drawRoundRect(ctx, photoX, photoY, photoWidth, photoHeight, 18);
      ctx.stroke();
    }
    currentY += photoHeight + 36;

    // 7. Donor Name
    const donorName = donation.donorName || 'ผู้ไม่ประสงค์ออกนาม';
    ctx.fillStyle = colorHighlight;
    ctx.font = 'bold 44px "RD Chulajaruek", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(donorName, centerX, currentY);
    currentY += 48 + 24;

    // 8. Amount Section
    // "บริจาคเงิน"
    ctx.fillStyle = colorTextMuted;
    ctx.font = 'bold 32px "RD Chulajaruek", serif';
    ctx.fillText('บริจาคเงิน', centerX, currentY);
    currentY += 32 + 12;

    // Amount Number (Large & Bold with shadow)
    const formattedAmount = Number(donation.amount).toLocaleString('th-TH');
    ctx.fillStyle = colorHighlight;
    ctx.font = '900 84px "RD Chulajaruek", serif';
    // Text shadow
    ctx.save();
    ctx.fillStyle = colorShadow;
    ctx.fillText(formattedAmount, centerX + 3, currentY + 3);
    ctx.fillStyle = colorHighlight;
    ctx.fillText(formattedAmount, centerX, currentY);
    ctx.restore();
    currentY += 84 + 12;

    // "บาท"
    ctx.fillStyle = colorTextMuted;
    ctx.font = 'bold 32px "RD Chulajaruek", serif';
    ctx.fillText('บาท', centerX, currentY);
    currentY += 32 + 28;

    // 9. "ให้แก่ THAI ROM DB"
    ctx.fillStyle = colorText;
    ctx.font = 'bold 32px "RD Chulajaruek", serif';
    ctx.fillText('ให้แก่ THAI ROM DB', centerX, currentY);
    currentY += 32 + 16;

    // 10. Date
    ctx.fillStyle = colorTextMuted;
    ctx.font = 'normal 28px "RD Chulajaruek", serif';
    ctx.fillText(this.formatThaiDate(donation.donatedAt), centerX, currentY);
    currentY += 28 + 16;

    // 11. "ขอขอบคุณมา ณ โอกาสนี้"
    ctx.fillStyle = colorTextMuted;
    ctx.font = 'bold 28px "RD Chulajaruek", serif';
    ctx.fillText('ขอขอบคุณมา ณ โอกาสนี้', centerX, currentY);

    // 12. Export to PNG Blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('ไม่สามารถแปลงรูปภาพ Canvas เป็น Blob ได้'));
        }
      }, 'image/png');
    });
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
