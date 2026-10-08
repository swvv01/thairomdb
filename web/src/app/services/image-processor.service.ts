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

@Injectable({ providedIn: 'root' })
export class ImageProcessorService {
  async process(source: Blob): Promise<ProcessedCover> {
    if (!source.type.startsWith('image/')) throw new Error('ไฟล์ที่เลือกต้องเป็นรูปภาพ');
    const image = await this.decode(source);
    const { width, height } = calculateCoverDimensions(image.width, image.height);
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
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('ไม่สามารถแปลงรูปภาพได้'))), 'image/png')
    );
    return { blob, width, height, filename: `cover_max250px_${Date.now()}.png` };
  }

  private decode(source: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image(); const url = URL.createObjectURL(source);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถอ่านรูปภาพได้')); };
      image.src = url;
    });
  }
}
