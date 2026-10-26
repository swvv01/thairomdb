import { calculateCoverDimensions, calculateStepDownDimensions, detectImageType, ImageProcessorService } from './image-processor.service';

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

describe('detectImageType', () => {
  it('detects JPEG magic bytes', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageType(bytes)).toEqual({ mimeType: 'image/jpeg', isHeic: false });
  });

  it('detects PNG magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageType(bytes)).toEqual({ mimeType: 'image/png', isHeic: false });
  });

  it('detects WebP magic bytes', () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38
    ]);
    expect(detectImageType(bytes)).toEqual({ mimeType: 'image/webp', isHeic: false });
  });

  it('detects HEIC magic bytes and marks isHeic true', () => {
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, // ...ftyp
      0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00  // heic....
    ]);
    expect(detectImageType(bytes)).toEqual({ mimeType: 'image/heic', isHeic: true });
  });

  it('returns null mimeType for unknown bytes', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    expect(detectImageType(bytes)).toEqual({ mimeType: null, isHeic: false });
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

  it('rejects HEIC blobs with helpful Thai message', async () => {
    const heicBytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70,
      0x6d, 0x69, 0x66, 0x31, 0x00, 0x00, 0x00, 0x00
    ]);
    const heicBlob = new Blob([heicBytes], { type: 'image/heic' });
    await expectAsync(service.process(heicBlob)).toBeRejectedWithError('ไฟล์ภาพ .HEIC จาก iPhone ยังไม่รองรับ กรุณาเลือกไฟล์ .JPG, .PNG หรือแคปภาพหน้าจอแทน');
  });

  it('processes image and returns scaled dimensions and cleanRawBlob', async () => {
    const blob = await createTestImageBlob(500, 300);
    const result = await service.process(blob);
    expect(result.width).toBe(250);
    expect(result.height).toBe(150);
    expect(result.blob).toBeDefined();
    expect(result.blob.type).toBe('image/webp');
    expect(result.filename.endsWith('.webp')).toBeTrue();
    expect(result.cleanRawBlob).toBeDefined();
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
      expect(result.blob.type).toBe('image/webp');
    } finally {
      window.createImageBitmap = originalCreateImageBitmap;
    }
  });

  it('convertToPng returns the same blob if already image/png', async () => {
    const pngBlob = new Blob(['png'], { type: 'image/png' });
    const result = await service.convertToPng(pngBlob);
    expect(result).toBe(pngBlob);
  });

  it('convertToPng converts non-png blob to image/png', async () => {
    const testBlob = await createTestImageBlob(100, 100);
    // testBlob is an image, let's process it to webp first
    const processed = await service.process(testBlob);
    expect(processed.blob.type).toBe('image/webp');

    const pngConverted = await service.convertToPng(processed.blob);
    expect(pngConverted.type).toBe('image/png');
  });
});
