# Diagonal (Diamond 45°) Collage Archive

เอกสารนี้จัดทำขึ้นเพื่อเก็บรักษาโค้ด อัลกอริทึมคณิตศาสตร์ และ Unit tests ของการจัดวางภาพรวมปกเกมแบบ **ลายเอียง 45 องศา (Diamond / Diagonal Tilted Tiles)** จากหน้า `/admin/post-summary` ไว้เป็นคลังความรู้ สำหรับนำกลับมาใช้งานใหม่หรือนำไปประยุกต์ใช้ในโมดูลอื่นในอนาคต

---

## 1. แนวคิดและอัลกอริทึม (Mathematical Concept)

การสร้างภาพคอลลาจแบบ Diamond Collage (สี่เหลี่ยมขนมเปียกปูนเอียง 45 องศา) บน HTML5 Canvas มีหลักการทำงานดังนี้:

1. **การคำนวณขนาดเส้นทแยงมุมครอบคลุม (Hypotenuse Bounding)**:
   - เนื่องจาก Canvas มีขนาด กว้าง ($W$) $\times$ สูง ($H$) เมื่อหมุนกริด 45 องศา จะต้องสร้างกริดให้กว้างเท่ากับเส้นทแยงมุม เพื่อให้ครอบคลุมพื้นที่ทั้งหมดโดยไม่เกิดช่องว่างที่ขอบ:
     $$\text{diagonalBound} = \sqrt{W^2 + H^2}$$
2. **การคำนวณจำนวนคอลัมน์ที่เหมาะสมตามจำนวนรูป ($N$)**:
   - เพื่อให้พื้นที่กริดเพียงพอต่อจำนวนรูป $totalItems$ รวมกับช่อง branding overlay ($+1$):
     $$N = \max\left(3, \left\lceil \sqrt{(totalItems + 1) \times 1.25} \right\rceil\right)$$
3. **ระยะก้าวและขนาดไทล์ (Step & Tile Size)**:
   - $\text{step} = \frac{\text{diagonalBound}}{N}$
   - $\text{tileSize} = \text{step} - \text{borderGap}$ (โดยกำหนด border gap เช่น 16px)
4. **การคำนวณพิกัดช่องกริดหมุน 45° และคัดเฉพาะช่องที่อยู่ในจอ**:
   - คำนวณตำแหน่งจริงบน Canvas:
     $$rotX = halfW + (localX \cdot \cos 45^\circ - localY \cdot \sin 45^\circ)$$
     $$rotY = halfH + (localX \cdot \sin 45^\circ + localY \cdot \cos 45^\circ)$$
   - คัดเลือกเฉพาะช่องที่อยู่ในจอหรือเกือบตกขอบ Canvas (margin $0.8 \times step$)
5. **การเรียงลำดับความสำคัญจากกึ่งกลางจอ (Center-Out Priority)**:
   - คำนวณระยะห่าง Euclidean จากกึ่งกลางจอ ($halfW, halfH$)
   - จัดเรียงให้รูปที่มีอยู่จริงถูกวางในช่องใกล้กึ่งกลางที่สุดก่อน ช่องที่เหลือรอบนอกจะสุ่มรูปมาเติมเต็ม (seamless backdrop)
6. **การตัดกรอบรูปเพชรและการหมุนรูปกลับให้อยู่ในแนวตั้ง (Upright Counter-Rotation)**:
   - หมุน Canvas ทั้งหมด 45 องศา
   - ใช้ `clip()` ตัดรูปทรงสี่เหลี่ยมของไทล์ (ซึ่งจะกลายเป็นเพชรบน Canvas)
   - ภายในฟังก์ชันการวาด ทำการ `rotate(-45°)` ย้อนกลับ เพื่อให้ภาพปกเกมยังคงอยู่ในแนวตั้งตรง ไม่เอียงตามกรอบ โดยขยายขนาดภาพขึ้นเป็น $\text{tileSize} \times \sqrt{2}$ เพื่อเติมเต็มพื้นที่สี่เหลี่ยมขนมเปียกปูนพอดี

---

## 2. โค้ดฟังก์ชันหลัก (TypeScript Implementation)

```typescript
import { Patch } from '../models/patch.models';

/**
 * วาดกรอบสี่เหลี่ยมตัดขอบ (Clip) สำหรับไทล์
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
 * คำนวณจำนวนคอลัมน์ของกริดเอียง 45 องศา ให้เหมาะสมกับจำนวนรูป
 */
export function calculateDiagonalGridCols(totalItems: number): number {
  const needed = totalItems + 1;
  // กริดเอียงครอบคลุมพื้นที่ประมาณ cols * cols ไทล์
  return Math.max(3, Math.ceil(Math.sqrt(needed * 1.25)));
}

/**
 * วาดภาพรวมปกเกมแบบโมเสกเอียง 45 องศา (Diamond Collage) ลงบน Canvas
 */
export function renderDiagonalCollage(
  ctx: CanvasRenderingContext2D,
  width: number,
  heightOrImages: number | Array<{ patch: Patch; img: HTMLImageElement }>,
  imagesMaybe?: Array<{ patch: Patch; img: HTMLImageElement }>
): void {
  const height = typeof heightOrImages === 'number' ? heightOrImages : width;
  const validImages = Array.isArray(heightOrImages) ? heightOrImages : (imagesMaybe ?? []);

  // พื้นหลังสีม่วง Retro Synthwave
  ctx.fillStyle = '#35006c';
  ctx.fillRect(0, 0, width, height);

  const N = calculateDiagonalGridCols(validImages.length);
  const halfW = width / 2;
  const halfH = height / 2;
  const diagonalBound = Math.hypot(width, height);
  const borderGap = 16;
  const step = diagonalBound / N;
  const tileSize = step - borderGap;

  interface RotatedSlot {
    col: number;
    row: number;
    centerX: number;
    centerY: number;
  }

  const allSlots: RotatedSlot[] = [];
  const angle = Math.PI / 4;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const maxDimension = Math.max(width, height);
  const startIdx = -Math.floor(maxDimension / step) - 1;
  const endIdx = Math.ceil(maxDimension / step) + 1;

  for (let r = startIdx; r <= endIdx; r++) {
    for (let c = startIdx; c <= endIdx; c++) {
      const localX = (c + 0.5) * step;
      const localY = (r + 0.5) * step;
      const rotX = halfW + (localX * cosA - localY * sinA);
      const rotY = halfH + (localX * sinA + localY * cosA);

      const margin = step * 0.8;
      if (rotX >= -margin && rotX <= width + margin && rotY >= -margin && rotY <= height + margin) {
        allSlots.push({ col: c, row: r, centerX: rotX, centerY: rotY });
      }
    }
  }

  // เรียงลำดับจากจุดศูนย์กลางจอออกสู่ภายนอก
  allSlots.sort((a, b) => {
    const distA = Math.hypot(a.centerX - halfW, a.centerY - halfH);
    const distB = Math.hypot(b.centerX - halfW, b.centerY - halfH);
    return distA - distB;
  });

  const assignedImages: HTMLImageElement[] = [];
  for (let i = 0; i < allSlots.length; i++) {
    if (i < validImages.length) {
      assignedImages.push(validImages[i].img);
    } else {
      const randIdx = Math.floor(Math.random() * validImages.length);
      assignedImages.push(validImages[randIdx].img);
    }
  }

  ctx.save();
  ctx.translate(halfW, halfH);
  ctx.rotate(angle);

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
}
```

---

## 3. Unit Tests (Jasmine / Karma)

```typescript
describe('Diagonal Collage Tests', () => {
  it('should calculate diagonal grid columns correctly', () => {
    expect(calculateDiagonalGridCols(0)).toBe(3);
    expect(calculateDiagonalGridCols(2)).toBeGreaterThanOrEqual(3);
    expect(calculateDiagonalGridCols(6)).toBeGreaterThanOrEqual(3);
    expect(calculateDiagonalGridCols(15)).toBe(5);
  });

  it('should render diagonal collage without error', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeTruthy();

    if (ctx) {
      const dummyImg = new Image();
      dummyImg.width = 100;
      dummyImg.height = 100;
      const validImages = [
        { patch: { id: 'p1' } as any, img: dummyImg },
        { patch: { id: 'p2' } as any, img: dummyImg }
      ];

      expect(() => renderDiagonalCollage(ctx, 1024, 1200, validImages)).not.toThrow();
    }
  });

  it('should execute drawTiltedTile with clip and restore', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    let drew = false;
    drawTiltedTile(ctx, 10, 10, 50, 50, () => {
      drew = true;
    });
    expect(drew).toBeTrue();
  });
});
```

---

## 4. วิธีนำกลับมาเปิดใช้งาน (How to Restore)

หากต้องการนำ Diamond Collage กลับมาใช้งานในหน้าจอ:

1. **นำฟังก์ชันกลับเข้าสู่ Component หรือแยกเป็น Utility**:
   - คัดลอก `drawTiltedTile`, `calculateDiagonalGridCols`, และ `renderDiagonalCollage` กลับไปไว้ใน [`admin-post-summary-page.component.ts`](file:///d:/me/rom_collector/web/src/app/pages/admin-post-summary-page.component.ts) หรือสร้างเป็น `web/src/app/shared/diagonal-collage.util.ts`
2. **เพิ่ม State สำหรับสลับโหมด**:
   - เพิ่ม `protected readonly collageMode = signal<'masonry' | 'diagonal'>('masonry');`
   - เพิ่ม `protected setCollageMode(mode: 'masonry' | 'diagonal')` เพื่ออัปเดต signal
3. **เพิ่มปุ่มสลับโหมดใน Template**:
   - นำปุ่ม `.mode-toggle-group` กลับมาใส่ใน header ของการ์ดสรุปรูปภาพ
4. **เรียกใช้ในฟังก์ชันการสร้างรูป**:
   - ตรวจสอบ `if (this.collageMode() === 'masonry')` เรียก `renderMasonryCollage` และ `else` เรียก `renderDiagonalCollage`
