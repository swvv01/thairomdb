import { Injectable } from '@angular/core';
import { ProcessedCover } from '../models/patch.models';

export function calculateCoverDimensions(width: number, height: number, maxWidth = 250): { width: number; height: number } {
  const scale = width > maxWidth ? maxWidth / width : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export function calculateStepDownDimensions(
  currentWidth: number,
  currentHeight: number,
  targetWidth: number,
  targetHeight: number
): Array<{ width: number; height: number }> {
  const steps: Array<{ width: number; height: number }> = [];
  let w = currentWidth;
  let h = currentHeight;
  while (w > targetWidth * 2) {
    w = Math.max(targetWidth, Math.round(w * 0.5));
    h = Math.max(targetHeight, Math.round(h * 0.5));
    steps.push({ width: w, height: h });
  }
  return steps;
}

export function detectImageType(bytes: Uint8Array): { mimeType: string | null; isHeic: boolean } {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', isHeic: false };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: 'image/png', isHeic: false };
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mimeType: 'image/gif', isHeic: false };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', isHeic: false };
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    let ftypText = '';
    const maxIdx = Math.min(bytes.length, 32);
    for (let i = 8; i < maxIdx; i++) {
      ftypText += String.fromCharCode(bytes[i]);
    }
    if (ftypText.includes('avif') || ftypText.includes('avis')) {
      return { mimeType: 'image/avif', isHeic: false };
    }
    if (
      ftypText.includes('heic') ||
      ftypText.includes('heix') ||
      ftypText.includes('mif1') ||
      ftypText.includes('msf1') ||
      ftypText.includes('hevc') ||
      ftypText.includes('hevx')
    ) {
      return { mimeType: 'image/heic', isHeic: true };
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { mimeType: 'image/bmp', isHeic: false };
  }
  return { mimeType: null, isHeic: false };
}

@Injectable({ providedIn: 'root' })
export class ImageProcessorService {
  async process(source: Blob, quality?: number, maxWidth = 250): Promise<ProcessedCover> {
    const buffer = await source.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const detected = detectImageType(bytes);

    if (detected.isHeic || source.type === 'image/heic' || source.type === 'image/heif') {
      throw new Error('ไฟล์ภาพ .HEIC จาก iPhone ยังไม่รองรับ กรุณาเลือกไฟล์ .JPG, .PNG หรือแคปภาพหน้าจอแทน');
    }

    const effectiveMime = detected.mimeType || (source.type?.startsWith('image/') ? source.type : null);
    if (!effectiveMime) {
      throw new Error('ไฟล์ที่เลือกต้องเป็นรูปภาพ');
    }

    const cleanBlob = new Blob([buffer], { type: effectiveMime });
    const targetQuality = quality ?? (effectiveMime === 'image/webp' ? 0.95 : 0.85);

    let processed: ProcessedCover;
    try {
      processed = await this.processWithBitmap(cleanBlob, targetQuality, maxWidth);
    } catch {
      processed = await this.processWithCanvasFallback(cleanBlob, targetQuality, maxWidth);
    }

    return {
      ...processed,
      cleanRawBlob: cleanBlob
    };
  }

  private async processWithBitmap(source: Blob, quality: number, maxWidth = 250): Promise<ProcessedCover> {
    if (typeof createImageBitmap !== 'function') {
      throw new Error('createImageBitmap is not supported');
    }

    const bitmap = await createImageBitmap(source);
    try {
      const { width, height } = calculateCoverDimensions(bitmap.width, bitmap.height, maxWidth);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('ไม่สามารถเข้าถึง 2D Canvas ได้');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('ไม่สามารถแปลงรูปภาพได้'))), 'image/webp', quality)
      );
      return { blob, width, height, filename: `cover_max${maxWidth}px_${Date.now()}.webp` };
    } finally {
      bitmap.close();
    }
  }

  private async processWithCanvasFallback(source: Blob, quality: number, maxWidth = 250): Promise<ProcessedCover> {
    const image = await this.decode(source);
    const { width, height } = calculateCoverDimensions(image.width, image.height, maxWidth);
    const steps = calculateStepDownDimensions(image.width, image.height, width, height);

    let currentSource: CanvasImageSource = image;

    for (const step of steps) {
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = step.width;
      stepCanvas.height = step.height;
      const stepCtx = stepCanvas.getContext('2d');
      if (stepCtx) {
        stepCtx.imageSmoothingEnabled = true;
        stepCtx.imageSmoothingQuality = 'high';
        stepCtx.drawImage(currentSource, 0, 0, step.width, step.height);
      }
      currentSource = stepCanvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(currentSource, 0, 0, width, height);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('ไม่สามารถแปลงรูปภาพได้'))), 'image/webp', quality)
    );
    return { blob, width, height, filename: `cover_max${maxWidth}px_${Date.now()}.webp` };
  }

  async convertToPng(source: Blob): Promise<Blob> {
    if (source.type === 'image/png') {
      return source;
    }

    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(source);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Cannot get 2d context');
          ctx.drawImage(bitmap, 0, 0);
          return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Failed to convert to PNG'))), 'image/png')
          );
        } finally {
          bitmap.close();
        }
      } catch {
        // Fall back to decode
      }
    }

    const image = await this.decode(source);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Failed to convert to PNG'))), 'image/png')
    );
  }

  private decode(source: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = async () => {
          try {
            if (typeof image.decode === 'function') {
              await image.decode();
            }
            resolve(image);
          } catch {
            resolve(image);
          }
        };
        image.onerror = () => {
          reject(new Error('ไม่สามารถอ่านรูปภาพได้ กรุณาลองใช้รูปอื่นหรือแคปภาพหน้าจอ'));
        };
        image.src = reader.result as string;
      };
      reader.onerror = () => {
        reject(new Error('ไม่สามารถอ่านรูปภาพได้ กรุณาลองใช้รูปอื่นหรือแคปภาพหน้าจอ'));
      };
      reader.readAsDataURL(source);
    });
  }
}
