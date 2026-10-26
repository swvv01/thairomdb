# Pinterest Grid Mode Knowledge & Architecture

เอกสารบันทึกรายละเอียดสถาปัตยกรรม การออกแบบ และแนวทางการดูแลรักษาฟีเจอร์ **Pinterest Grid Mode (Masonry Layout)** ของระบบแสดงรายการเกม (Browse Pages)

---

## 1. ที่มาและจุดประสงค์ (Background & Overview)

* **ที่มา:** แต่เดิมระบบแสดงรายการเกมในรูปแบบการ์ดแนวตั้ง (Card / List Mode) ซึ่งเหมาะสำหรับการอ่านรายละเอียดของเกมทีละรายการ แต่อาจไม่ตอบโจทย์ผู้ใช้ที่ต้องการสำรวจ (Browse) ดูภาพปกเกมจำนวนมากได้อย่างเพลิดเพลิน
* **เป้าหมาย:**
  1. สร้างโหมดการแสดงผลแบบ **Pinterest Masonry Grid Layout** เน้นรูปภาพปกเกมแบบ Visual-First
  2. จัดเรียงตามอัตราส่วนความสูงจริงของปกโดยไม่มีช่องว่างแนวตั้ง และแบ่งเป็น 2 คอลัมน์ขึ้นไปอย่างสมดุล
  3. ตั้งค่าให้เป็น **โหมดเริ่มต้น (Default Mode)** สำหรับผู้ใช้บนหน้าจอ Desktop ขนาด $\ge$ 1024px
  4. จดจำการสลับโหมดของผู้ใช้ผ่าน `localStorage` หากผู้ใช้ต้องการใช้ List Mode
  5. ระบบโหลดข้อมูลแบบต่อเนื่องอัตโนมัติ (Infinite Scroll) พร้อมดึงข้อมูลล่วงหน้าก่อนผู้ใช้เลื่อนถึงช่องว่าง
  6. ขยายหน้าจอเต็มพื้นที่ (Full Width) พร้อมระบบ Hamburger Navigation Drawer สำหรับเข้าถึงเมนูหลัก

---

## 2. สถาปัตยกรรมระดับ Service (`BrowseGridModeService`)

ไฟล์: [`web/src/app/services/browse-grid-mode.service.ts`](file:///d:/me/rom_collector/web/src/app/services/browse-grid-mode.service.ts)

### 2.1 State & Persistence Management
- **LocalStorage Key:** `thairomdb_browse_grid_mode`
- **Default Policy:**
  - หากไม่มีค่าบันทึกมาก่อน (`saved === null`) จะกำหนดให้เริ่มต้นเป็น `true` (Grid Mode)
  - หากมีค่าบันทึกไว้ จะตรวจสอบว่าตรงกับ `'grid'` หรือไม่ (`saved === 'grid'`)
- **Signal-Based Architecture:**
  - `isGridMode`: Writable Signal เก็บสถานะความต้องการของผู้ใช้ (`true` หรือ `false`)
  - `isDesktopOrTablet`: Writable Signal ติดตามขนาดหน้าจอ Desktop ผ่าน `window.matchMedia('(min-width: 1024px)')`
  - `isBrowseRoute`: Writable Signal ตรวจจับว่า URL ปัจจุบันเป็นหน้ารายการเกมที่รองรับ Grid Mode หรือไม่
  - `activeGridMode`: Computed Signal สรุปผลการเปิดใช้งานจริง:
    ```typescript
    readonly activeGridMode = computed(
      () => this._isGridMode() && this._isDesktopOrTablet() && this._isBrowseRoute()
    );
    ```

### 2.2 Breakpoint & Responsive Guard (1024px - Desktop Only)
- **ทำไมต้อง 1024px?**
  - Grid Mode ได้รับการออกแบบมาเพื่อให้ประสบการณ์สำรวจรูปภาพปกแบบ Masonry อย่างเต็มประสิทธิภาพบนหน้าจอขนาดใหญ่ (Desktop / Laptop)
  - หน้าจอขนาดตั้งแต่ 1024px ขึ้นไปมีพื้นที่เพียงพอสำหรับการจัดแสดงผลหลายคอลัมน์พร้อมช่องว่างที่เหมาะสม
  - หน้าจอที่มีขนาดต่ำกว่า 1024px (มือถือและแท็บเล็ต) จะถูกจำกัดให้แสดงผลในรูปแบบ List Mode แบบมาตรฐานเท่านั้น โดยที่ `activeGridMode = false` และซ่อนปุ่มสลับโหมดออกจาก Header

---

## 3. การแสดงผลและควบคุมใน App Shell (`AppComponent`)

ไฟล์:
- [`web/src/app/app.component.html`](file:///d:/me/rom_collector/web/src/app/app.component.html)
- [`web/src/app/app.component.css`](file:///d:/me/rom_collector/web/src/app/app.component.css)
- [`web/src/app/app.component.ts`](file:///d:/me/rom_collector/web/src/app/app.component.ts)

### 3.1 ปุ่ม Toggle สลับโหมดบน Header
- ติดตั้งปุ่ม Retro Toggle ที่มุมขวาของ Header (ซ่อน `#last-update`)
- จัดวางแบบ 2 บรรทัด (Vertical Stack): บรรทัดบนเป็น Label `Grid` (ขนาด 1rem) และบรรทัดล่างเป็นสวิตช์ **3D Beveled Retro Slider** (`.retro-slider`, สูง 1rem กว้าง 2rem)
- โครงสร้างและมิติของสวิตช์:
  - รางสไลด์ยุบตัว 3D Inset Bevel (`#808080 #ffffff #ffffff #808080`) ขนาด 1rem x 2rem
  - ปุ่มเลื่อน 3D Raised Beveled Knob (`#ffffff #808080 #808080 #ffffff`) เลื่อนซ้าย-ขวาอย่างนุ่มนวล
- การแสดงสี:
  - ขณะปิด (List Mode / Inactive): รางสไลด์เป็นสีร่องมืดเข้ม `#333333` และปุ่ม Knob อยู่ฝั่งซ้าย
  - ขณะเปิด (Grid Mode / Active): รางสไลด์เปลี่ยนเป็นสี `var(--color-accent)` และปุ่ม Knob เลื่อนไปฝั่งขวา
  - ข้อความ Label `Grid` คงสีปกติ `var(--color-text)` เสมอ และไม่มีการเปลี่ยนสีตอน hover
- ซ่อนบนหน้าจอมือถือและแท็บเล็ตผ่าน `@media (max-width: 1023px) { display: none !important; }`

### 3.2 การขยายเต็มจอ (Full Width)
- เมื่อ `activeGridMode()` เป็นจริง:
  - Sidebar ซ้าย (`.retro-rail`) และ Sidebar ขวา (`.right-ad-sidebar`) จะถูกซ่อน (`display: none !important`)
  - คอนเทนเนอร์ตรงกลาง (`.browse-column`) จะขยายกว้างเต็ม 100%
  - ปุ่ม Action แบบลอย (`.browse-floating-actions`) ย้ายไปอยู่ที่ `right: 1rem` เพื่อไม่ให้ทับซ้อนเนื้อหา

### 3.3 Main Menu Drawer Overlay (☰)
- ใน Grid Mode จะแสดงปุ่ม Hamburger `☰` ที่มุมซ้ายสุดของ Header (หน้าโลโก้)
- เมื่อคลิกปุ่ม จะเปิด Sidebar ซ้าย (`#system-sidebar`) ขึ้นมาเป็น **Drawer Overlay**
- มี Backdrop สีเข้มคลุมหน้าจอ และรองรับการปิดเมนูผ่าน:
  1. คลิกที่ Backdrop
  2. คลิกปุ่ม `☰` ซ้ำ
  3. กดปุ่ม `Escape` บนคีย์บอร์ด
  4. คลิกเลือกลิงก์เปลี่ยนเส้นทางหน้าเว็บ (Navigation Route)
- **Header Offset Rule:** กำหนด `padding-top: 5.5rem` ให้กับ Drawer เมื่อเปิดขึ้นมา เพื่อหลบแถบ Top Header และ Marquee ไม่ให้บังหัวเมนูด้านบน พร้อมทั้งกำหนด `padding-top: 5rem` (หรือ `2.75rem` สำหรับ VIP) ให้กับ `.app-shell.is-grid-mode` เมื่อ `body.sidebar-open` เพื่อชดเชยการที่ `.app-header` เปลี่ยนเป็น `position: fixed` ป้องกันไม่ให้ `main-content` เลื่อนเข้าไปมุดใต้ Header
- **รวมเนื้อหา Sidebar ทั้งหมดเหมือน Mobile Mode (Full Mobile-Like Sidebar):** ดึงเนื้อหาฝั่ง Right Sidebar (`secondarySidebar`) มาแสดงใน Drawer ของ Left Sidebar ด้วย (ได้แก่ บทความ, Tags, บริจาค, ลิงก์อื่นๆ, ตัวนับผู้เข้าชม และการเลือกธีม) โดยไม่แสดงซ้ำซ้อนใน Right Sidebar ทำให้ Drawer ของ Grid Mode ทำงานครบถ้วนสมบูรณ์เหมือนกับเมนูบน Mobile 100%
- **เอกสารอ้างอิงสถาปัตยกรรม Drawer Toggle:** ดูรายละเอียดเชิงลึกของระบบ Toggle, Document Flow และ Z-Index ได้ที่ [`docs/sidebar-toggle-knowledge.md`](file:///d:/me/rom_collector/docs/sidebar-toggle-knowledge.md)

---

## 4. โครงสร้างและการจัดวาง Grid Layout (`BrowsePageComponent`)

ไฟล์:
- [`web/src/app/pages/browse-page.component.html`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.html)
- [`web/src/app/pages/browse-page.component.css`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.css)
- [`web/src/app/pages/browse-page.component.ts`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.ts)

### 4.1 Pinterest Masonry Columns
การจัดแสดงผลใช้ CSS Multi-column layout:
```css
.browse-grid-mode {
  column-width: 210px;
  column-gap: 0.75rem;
  width: 100%;
}

.browse-grid-item {
  break-inside: avoid;
  margin-bottom: 0.75rem;
  display: block;
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
```
- **การจัดกึ่งกลางและ Responsive Width:**
  - บนหน้าจอ 480px - 544px: ปรับขนาดการ์ดอัตโนมัติให้พอดี 2 คอลัมน์ (ประมาณ 210px - 225px)
  - บนหน้าจอ 544px ขึ้นไป: ขยายการ์ดได้สูงสุดประมาณ 250px พร้อมจัดกึ่งกลางเนื้อหา (`justify-content: center; margin-inline: auto;`)
  - จำนวนคอลัมน์จะเพิ่มขึ้นอัตโนมัติตามความกว้างหน้าจอ (3, 4, 5+ คอลัมน์)

### 4.2 การควบคุมความกว้างของช่องค้นหาและตัวกรอง (Controls Max-Width)
- แถบเครื่องมือค้นหาและตัวกรอง (`app-game-list-controls`) ถูกจำกัดความกว้างสูงสุดไว้ที่ **`max-width: 42rem`** (ประมาณ 672px) พร้อมจัดกึ่งกลาง (`margin-inline: auto`)
- ป้องกันไม่ให้แถบค้นหายืดกว้างจนเสียสัดส่วนบนหน้าจอกว้างพิเศษ (Ultrawide Monitor) โดยคงดีไซน์ที่กะทัดรัดเช่นเดียวกับ Card Mode

### 4.3 Hover Overlay Information
เมื่อชี้เมาส์ไปที่รูปภาพปกเกม จะแสดงกล่องข้อความ Gradient ซ้อนทับด้านล่างด้วยโทนสีแบบ Fixed High-Contrast เพื่อให้อ่านชัดเจน 100% บนทุกธีมและทุกภาพปก:
- **บรรทัดที่ 1:** `[ระบบ] ชื่อเกม` โดยระบบใช้สีขาว `var(--color-card-overlay-system)` และชื่อเกมใช้สีเหลืองทอง `var(--color-card-overlay-title)`
- **บรรทัดที่ 2:** `by ทีมแปล` โดยใช้สีข้อความรอง `var(--color-card-overlay-by)` (ลาเวนเดอร์อ่อน)
- **พื้นหลังและเงา:** ใช้ Fixed Dark Gradient `var(--color-card-overlay-bg)` คู่กับเงาดำ `var(--color-card-overlay-shadow)` ป้องกันปัญหาตัวอักษรกลืนกับภาพปกหรือสีธีมสว่าง (เช่น ธีม Pocket Pet)

### 4.4 Game Badges บนรูปปก (NEW / UPDATE)
- แสดง Game Badge ลอยเด่นอยู่ที่มุมบนขวาของรูปปก (`.pinterest-card__badge` ที่ `top: 0.35rem; right: 0.35rem; z-index: 2;`)
- ผู้ใช้สามารถเห็นสถานะเกมที่มีการอัปเดต (`update.gif`) หรือเกมมาใหม่ (`new.gif`) ได้ทันทีโดยไม่ต้องรอ Hover
- กำหนด `pointer-events: none` เพื่อให้คลิกผ่านไปยังการเปิด Detail Modal ของเกมได้ตามปกติ
- บังคับ `display: inline-flex !important` เพื่อป้องกันการถูกซ่อนจากมีเดียคิวรีระดับการ์ดปกติบนจอแท็บเล็ต

### 4.5 Cover Image Placeholder ระหว่างโหลดรูปภาพ (`fa-regular fa-image`)
เพื่อแก้ปัญหาการ์ดแฟบ (Collapse) และภาพกระตุก (Cumulative Layout Shift - CLS) ก่อนที่ไฟล์ภาพปกเกมจะถูกดาวน์โหลดจากเซิร์ฟเวอร์เสร็จ:
- **โครงสร้างและสีพื้นหลัง:** ใส่ `.pinterest-card__placeholder` ภายใน `.pinterest-card__cover-wrap` โดยใช้โทนสีพื้นหลัง `var(--color-card-loading-bg)` (อิงจาก `var(--color-surface-light)`) ให้ปรับตามธีมของเว็บไซต์อัตโนมัติ พร้อมไอคอน FontAwesome `fa-regular fa-image` ที่กึ่งกลาง
- **มิติเริ่มต้น:** กำหนด `aspect-ratio: 3 / 4` คู่กับ `min-height: 200px` และความกว้าง `width: 100%` เพื่อจองพื้นที่สัดส่วนกล่องเกมแนวตั้งมาตรฐานใน Masonry
- **แอนิเมชัน Pulse สไตล์ Skeleton:** กำหนดแอนิเมชัน `pinterest-placeholder-pulse` ให้ไอคอนขนาด 2.75rem ค่อยๆ หรี่และขยายจังหวะนุ่มนวลระหว่างรอรูปภาพจริง
- **คงการแสดงผล Overlay และ Badge:** ในช่วงที่ Placeholder กำลังแสดงผล แถบข้อความชื่อเกมและ Game Badge จะยังคงปรากฏชัดเจน (`opacity: 1`) เพื่อให้ผู้ใช้สามารถอ่านข้อมูลเกมได้ทันทีโดยไม่ต้องรอรูปโหลด
- **Smooth Image Reveal:** ตัวรูปภาพจริงซ่อนอยู่ในเบื้องหลัง (`opacity: 0; position: absolute;`) และเมื่อดาวน์โหลดเสร็จสมบูรณ์ (`onImageLoad`) ตัว Placeholder จะถูกซ่อน (`display: none !important`) และภาพจริงจะ Fade-in ขึ้นมา (`opacity: 1; position: static;`) ด้วย `transition: opacity 0.25s ease` ปรับความสูงตามสัดส่วนภาพจริงโดยอัตโนมัติ

---

## 5. Infinite Scroll & กลยุทธ์การดึงข้อมูล

### 5.1 บังคับใช้ Continuous Scroll เท่านั้น
- เมื่ออยู่ใน Grid Mode ระบบจะบังคับใช้โหมดโหลดต่อเนื่องเท่านั้น (`effectivePageMode` คืนค่า continuous เสมอ)
- ซ่อน Pagination Bar และปุ่ม "สลับไปโหมดแบ่งหน้า" ทั้งหมด
- ดึงข้อมูลรอบละ **50 รายการ** (`pageSize = 50`)

### 5.2 ระบบตรวจจับการเลื่อนจออัตโนมัติ (`IntersectionObserver`)
- วาง Sentinel Element (`.infinite-scroll-sentinel`) ล่องหนไว้ใต้รายการเกม
- กำหนดระยะตรวจจับล่วงหน้า **`rootMargin: '400px'`**:
  - เมื่อผู้ใช้เลื่อนหน้าจอเข้าใกล้จุดสิ้นสุดก่อนถึง 400px ตัว Observer จะสั่งโหลด 50 รายการถัดไปทันที
  - ช่วยแก้ปัญหาช่องว่าง (Blank Gap) ด้านล่าง ให้ผู้ใช้เลื่อนดูเกมได้อย่างต่อเนื่องลื่นไหล
- เมื่อโหลดครบทุกรายการแล้ว (`!hasMore`) ระบบจะยกเลิก Sentinel และแสดงสถานะสิ้นสุดรายการ

---

## 6. การแสดงผลการ์ดเกมใน Modal (`PatchCardListComponent`)

ไฟล์:
- [`web/src/app/components/patch-card-list.component.html`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.html)
- [`web/src/app/components/patch-card-list.component.css`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.css)
- [`web/src/app/components/patch-card-list.component.ts`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.ts)

### 6.1 Detail Dialog & Template Reuse
- เมื่อคลิกที่รูปภาพปกใน Grid Mode ระบบจะเปิด `<dialog class="patch-detail-dialog">`
- การ์ดเกมถูกรวมศูนย์ไว้ใน `<ng-template #patchCard let-patch="patch">` ทำให้ทั้ง List Mode ปกติ และ Detail Dialog ใน Grid Mode ใช้เทมเพลตร่วมกัน 100% โดยไม่ต้องเขียนซ้ำซ้อน
- รองรับการปิด Dialog ด้วย:
  1. ปุ่มกากบาท `X` ที่มุมขวาบน
  2. การคลิกพื้นที่ Backdrop ด้านนอก
  3. การกดปุ่ม `Escape`

### 6.2 Responsive Modal Content
- **ไม่แสดง Game Badge:** ภายใน `patch-detail-dialog` จะไม่แสดงป้าย `game-badge` (`NEW`/`UPDATE`) เพื่อให้ชื่อเกมในหัวข้อสะอาดตา โดยข้อมูลสถานะการอัปเดตจะแสดงอยู่ในส่วนเนื้อหา `patch-card__description` แทน
- **ปุ่ม Action บน Mobile Dialog:** เนื่องจากรูปปกถูกซ่อนบนหน้าจอขนาด $\le$ 640px ทำให้ปุ่ม Action บนรูปปกไม่แสดง จึงมีการเพิ่ม `.patch-card__dialog-actions` แสดงปุ่มไอคอนสไตล์ Retro (แก้ไข และเก็บเข้าคลัง/บุ๊กมาร์ก) จัดเรียงชิดซ้ายอยู่ใต้ชื่อเกมโดยตรง เพื่อให้ผู้ใช้มือถือสามารถเข้าถึงปุ่มได้สะดวก
- **บนหน้าจอ Mobile ใน Dialog:** ซ่อนรูปปกอัตโนมัติ (`.patch-cover-wrap { display: none !important; }`) เพื่อให้ผู้ใช้เห็นเนื้อหาและปุ่มดาวน์โหลด/บุ๊กมาร์กได้ทันทีโดยไม่ต้องเลื่อนหน้าจอ
- **บนหน้าจอ Desktop/Tablet ใน Dialog:** แสดงองค์ประกอบครบถ้วนตามแบบฉบับ Retro Card โดยปุ่ม Action ยังคงลอยอยู่บนรูปปกตามปกติ ไม่แสดงซ้ำซ้อนใต้ชื่อเกม

---

## 7. ข้อควรระวังและแนวทางการดูแลรักษา (Guidelines & Gotchas)

1. **การเขียน Unit Test:**
   - เนื่องจาก `pageSize` ใน `BrowsePageComponent` จะมีค่าเป็น 50 เมื่อเปิด Grid Mode และเป็น 10 เมื่อปิด Grid Mode หากต้องการทดสอบชุดทดสอบแบบแบ่งหน้า (Pagination) หรือชุดทดสอบที่อิง 10 รายการ ต้องเซ็ต `localStorage` ให้เป็น `'list'` ล่วงหน้า:
     ```typescript
     window.localStorage.setItem(BrowseGridModeService.storageKey, 'list');
     ```
   - ในการทดสอบ `BrowseGridModeService` ที่มีการเรียกใช้ `inject(Router)` ต้องครอบด้วย `TestBed.runInInjectionContext(...)` เมื่อสร้างอินสแตนซ์ใหม่
2. **การรักษาธีมสี (Semantic Theme Variables):**
   - ห้ามใช้ Hardcoded Hex/RGB หรือคลาส Tailwind Static Color (เช่น `bg-white`, `text-black`)
   - ใช้ Semantic Variable เสมอ เช่น `var(--color-bg-surface)`, `var(--color-border-subtle)`, `var(--color-text-muted)`
3. **การหลีกเลี่ยงอักขระ Middle Dot:**
   - ห้ามใช้อักขระ middle dot ในข้อความ UI หรือโค้ด ให้ใช้เครื่องหมายขีด `-` แทนตามข้อกำหนดฟอนต์ของโปรเจกต์

---

## 8. รายการไฟล์ที่เกี่ยวข้อง (Related Files)

- **Service & Logic:**
  - [`BrowseGridModeService`](file:///d:/me/rom_collector/web/src/app/services/browse-grid-mode.service.ts)
  - [`BrowseGridModeService Spec`](file:///d:/me/rom_collector/web/src/app/services/browse-grid-mode.service.spec.ts)
- **App Shell & Drawer:**
  - [`AppComponent Template`](file:///d:/me/rom_collector/web/src/app/app.component.html)
  - [`AppComponent Styles`](file:///d:/me/rom_collector/web/src/app/app.component.css)
  - [`AppComponent Component`](file:///d:/me/rom_collector/web/src/app/app.component.ts)
  - [`AppComponent Spec`](file:///d:/me/rom_collector/web/src/app/app.component.spec.ts)
- **Browse Page & Infinite Scroll:**
  - [`BrowsePageComponent Template`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.html)
  - [`BrowsePageComponent Styles`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.css)
  - [`BrowsePageComponent Component`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.ts)
  - [`BrowsePageComponent Spec`](file:///d:/me/rom_collector/web/src/app/pages/browse-page.component.spec.ts)
- **Patch Card & Modal:**
  - [`PatchCardListComponent Template`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.html)
  - [`PatchCardListComponent Styles`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.css)
  - [`PatchCardListComponent Component`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.ts)
  - [`PatchCardListComponent Spec`](file:///d:/me/rom_collector/web/src/app/components/patch-card-list.component.spec.ts)
