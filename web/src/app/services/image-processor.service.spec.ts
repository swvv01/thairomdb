import { calculateCoverDimensions, calculateStepDownDimensions, ImageProcessorService } from './image-processor.service';

function createTestImageBlob(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

describe('calculateCoverDimensions', () => {
  it('resizes landscape images to the maximum width', () => {
    expect(calculateCoverDimensions(500, 1000)).toEqual({ width: 250, height: 500 });
  });

  it('resizes portrait images to the maximum width', () => {
    expect(calculateCoverDimensions(1000, 500)).toEqual({ width: 250, height: 125 });
  });

  it('resizes large square images to 250 wide', () => {
    expect(calculateCoverDimensions(800, 800)).toEqual({ width: 250, height: 250 });
  });

  it('does not upscale images narrower than 250', () => {
    expect(calculateCoverDimensions(100, 500)).toEqual({ width: 100, height: 500 });
  });

  it('leaves images at exactly 250 wide unchanged', () => {
    expect(calculateCoverDimensions(250, 600)).toEqual({ width: 250, height: 600 });
  });
});

describe('calculateStepDownDimensions', () => {
  it('returns no intermediate steps when source width is <= 2x target width', () => {
    expect(calculateStepDownDimensions(500, 375, 250, 188)).toEqual([]);
    expect(calculateStepDownDimensions(300, 225, 250, 188)).toEqual([]);
  });

  it('returns a single half-step when source is between 2x and 4x target width', () => {
    expect(calculateStepDownDimensions(800, 600, 250, 188)).toEqual([
      { width: 400, height: 300 }
    ]);
  });

  it('returns multiple half-steps for high resolution images until <= 2x target', () => {
    expect(calculateStepDownDimensions(1600, 1200, 250, 188)).toEqual([
      { width: 800, height: 600 },
      { width: 400, height: 300 }
    ]);
  });
});

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  it('rejects non-image blobs', async () => {
    const textBlob = new Blob(['hello world'], { type: 'text/plain' });
    await expectAsync(service.process(textBlob)).toBeRejectedWithError('ไฟล์ที่เลือกต้องเป็นรูปภาพ');
  });

  it('processes image and returns scaled dimensions', async () => {
    const blob = await createTestImageBlob(500, 300);
    const result = await service.process(blob);
    expect(result.width).toBe(250);
    expect(result.height).toBe(150);
    expect(result.blob).toBeDefined();
    expect(result.blob.type).toBe('image/png');
  });

  it('falls back to canvas processing when createImageBitmap fails', async () => {
    const originalCreateImageBitmap = window.createImageBitmap;
    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;

    try {
      const blob = await createTestImageBlob(600, 400);
      const result = await service.process(blob);
      expect(result.width).toBe(250);
      expect(result.height).toBe(167);
      expect(result.blob).toBeDefined();
    } finally {
      window.createImageBitmap = originalCreateImageBitmap;
    }
  });
});
