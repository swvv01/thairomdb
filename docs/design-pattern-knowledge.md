# Design Pattern & UI/UX Knowledge Guide (ROM Collector)

เอกสารรวบรวมแบบแผนการออกแบบ (Design Patterns), สถาปัตยกรรม UI/UX, โครงสร้าง CSS Theme และแนวทางการเขียนโค้ดที่ถูกต้องสำหรับโปรเจกต์ **ROM Collector (THAI ROM DB)**

---

## 1. App Shell & Layout Grid Pattern

### 1.1 โครงสร้าง 3 คอลัมน์ (CSS Grid)
โครงสร้างหลักของเว็บไซต์ใน `web/src/app/app.component.html` จัดวางด้วย CSS Grid ดังนี้:

- **Desktop Wide (≥ 1200px):**
  - คอลัมน์ที่ 1: `288px` (Left Navigation Rail: `.retro-rail`)
  - คอลัมน์ที่ 2: `minmax(0, 1fr)` (Center Content Area: `.app-content`)
  - คอลัมน์ที่ 3: `288px` (Right Ad Sidebar: `.right-ad-sidebar`)
- **Desktop Normal (901px - 1199px):** 2 คอลัมน์ (`288px minmax(0, 1fr)`) ซ่อนแถบโฆษณาด้านขวา
- **Mobile / Small Screen (≤ 900px):** คอลัมน์เดียวเต็มความกว้าง เมนูซ้ายซ่อนเป็น Drawer/Off-canvas พร้อมปุ่ม Hamburger บน Header

### 1.2 การป้องกัน Content ทะลุ / ล้นทับ Sidebar (Overflow Prevention)
เมื่อหน้าจอคอมพิวเตอร์อยู่ในช่วง 1200px - 1450px คอลัมน์กลางจะมีพื้นที่เหลือประมาณ 600px - 750px ซึ่งแคบกว่าปกติ

**ข้อกำหนดที่ต้องปฏิบัติตามสำหรับทุกหน้า:**
1. **Container `.app-content`:**
   - ต้องมี `min-width: 0;` และ `overflow-x: clip;` (หรือ `overflow-x: hidden;`) เพื่อกักไม่ให้เนื้อหาภายในดันคอลัมน์หลุดออกนอก Grid
2. **Page Component Host (`:host`):**
   ```css
   :host {
     display: block;
     width: 100%;
     max-width: 100%;
     min-width: 0;
     box-sizing: border-box;
   }
   ```
3. **Hero Header / Page Title:**
   - คำภาษาไทยขนาดยาว (เช่น `รายการสนับสนุน`, `จัดการเครื่องเกม`) ไม่ตัดช่องว่างอัตโนมัติ หากตั้งขนาดฟอนต์ใหญ่เกินไป (เช่น `6vw`) จะมีความกว้างเกินพื้นที่คอลัมน์กลาง
   - ต้องใช้ `overflow-wrap: break-word;` และ `word-break: break-word;` เสมอ
   - ขนาดฟอนต์ `h1` แนะนำให้ใช้ `clamp(1.75rem, 4vw, 3.25rem)`

---

## 2. Multi-Theme Token Architecture

โปรเจกต์รองรับ 3 ธีมหลัก คือ:
1. **Blue Neon Theme (Default)** (`data-theme=""`)
2. **Pocket-Pet Theme (LCD / Retro Handheld)** (`data-theme="pocket-pet"`)
3. **Classic Blue Theme (Windows 98 Classic)** (`data-theme="classic-blue"`) - แรงบันดาลใจจากสถาปัตยกรรม Windows 98 พร้อมแถบ Title Bar สีน้ำเงินไล่เฉด, แถบวิ่งสีเหลือง Infobar, เมนู Explorer Tree View, และการ์ดหน้าต่าง 3D Bevel คม 0px

### 2.1 กฎการใช้สี: ใช้เฉพาะตัวแปรของ Theme เท่านั้น (Strict Theme Color Token Rule)
> [!IMPORTANT]
> **ห้ามฮาร์ดโค้ดสีเด็ดขาด (No Hardcoded Colors)**:
> 1. **ห้ามใช้สีคงที่ (HEX, RGB, HSL)**: เช่น `#ffffff`, `#000000`, `rgb(...)` ในไฟล์ `.component.css` หรือ inline style ของ Component ใดๆ
> 2. **ห้ามใช้ Tailwind Color Classes**: เช่น `bg-white`, `text-black`, `bg-slate-800`, `text-blue-500`, `border-gray-300` ในหน้าหรือคอมโพเนนต์ของระบบ
> 3. **ทุกสีใน UI ต้องเรียกผ่าน CSS Variables เท่านั้น**: ใช้ `var(--color-*)` ในการกำหนดสีเสมอ เพื่อให้รองรับการเปลี่ยนธีม (Multi-Theme) ได้อย่างสมบูรณ์แบบ
> 4. **ข้อยกเว้นเพียงจุดเดียว**: อนุญาตให้ระบุค่าสีคงที่ได้เฉพาะในไฟล์ `src/styles.css` ในส่วนที่กำหนดค่า Token ให้กับตัวแปรของแต่ละธีม (`:root` และ `body[data-theme='...']`) เท่านั้น

| CSS Variable | ความหมาย / การใช้งาน | ตัวอย่างการใช้ |
|---|---|---|
| `--color-surface` | สีพื้นหลังหลักของหน้าเว็บ / Header / Sidebar | `background: var(--color-surface);` |
| `--color-surface-light` | สีพื้นหลังการ์ด / กล่องคอนเทนต์หลัก | `background: var(--color-surface-light);` |
| `--color-border` | เส้นขอบของหน้าต่าง / การ์ด / เส้นแบ่ง | `border: 1px solid var(--color-border);` |
| `--color-text` | สีตัวอักษรหลัก (High Contrast) | `color: var(--color-text);` |
| `--color-text-muted` | สีตัวอักษรรอง / วันที่ / คำอธิบายย่อย | `color: var(--color-text-muted);` |
| `--color-brand` | สีแบรนด์หลัก (ชมพู Neon / น้ำตาล LCD / น้ำเงิน 98) | สีไอคอนหัวใจ, Badge สำคัญ |
| `--color-highlight` | สีไฮไลต์เด่น (เหลือง Neon / น้ำตาลเข้ม / น้ำเงินเข้ม) | ยอดเงิน, ข้อความหัวข้อเด่น |
| `--color-accent` | สีเน้นย้ำ (เขียวชาร์ตรูส / สีทอง / เหลือง Infobar) | ขอบปุ่ม active, ปุ่ม action สำคัญ |
| `--color-shadow` | เงา Retro Pixel Shadow (เงาทึบ 0 blur) | `box-shadow: 4px 4px 0 var(--color-shadow);` |

---

## 3. Retro & Windows 95/Arcade Component Patterns

### 3.1 Hero Banner Pattern
ใช้ในหน้าเนื้อหาหลัก เช่น Donate, Redeem, Donations:
```html
<section class="donations-hero">
  <div class="hero-copy">
    <p class="eyebrow">Category / English Title</p>
    <h1>หัวข้อภาษาไทย<br><span>ENGLISH / HIGHLIGHT</span></h1>
    <p class="hero-description">คำอธิบายรายละเอียดแบบย่อ...</p>
  </div>
  <div class="hero-mark" aria-hidden="true">♥</div>
</section>
```
- `.hero-mark` คือสัญลักษณ์ Watermark จางๆ ด้านหลัง (`opacity: 0.15`) เช่น `♥` หรือ `★`
- มีเส้นกั้นล่าง `border-bottom: 1px solid var(--color-border);`

### 3.2 Retro Window & Card Pattern
ทุกการ์ดบนหน้าจอจะใช้ขอบทึบและเงาสไตล์ 90s Pixel Art:
```css
.card {
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  box-shadow: 4px 4px 0 var(--color-shadow);
  max-width: 100%;
  box-sizing: border-box;
}
```

### 3.3 Retro Tabs Pattern (Accessible Tabs)
การสลับแท็บต้องรองรับ Accessibility (ARIA Roles) และมี Touch Target ไม่ต่ำกว่า 42-44px:
```html
<div class="tab-switcher" role="tablist" aria-label="เลือกหมวดหมู่">
  <button
    type="button"
    class="tab-btn"
    role="tab"
    [attr.aria-selected]="activeTab === 'current'"
    [class.tab-btn--active]="activeTab === 'current'"
    (click)="selectTab('current')">
    <span>เดือนนี้</span>
    <span class="tab-count-badge" [attr.aria-label]="count + ' รายการ'">{{ count }}</span>
  </button>
</div>
```

### 3.4 Admin Master Single-Column Pattern
ในหน้า CRUD ข้อมูล Master กลางของฝั่ง Admin ที่ใช้งาน Component กลาง `AdminMasterPageComponent` (`<app-admin-master-page>`):
- **หน้าที่ใช้งานร่วมกัน:**
  - `/admin/systems` (จัดการเครื่องเกม)
  - `/admin/translators` (จัดการทีมแปล)
  - `/admin/tags` (จัดการแท็ก)
  - `/admin/sidebar-links` (จัดการลิงก์ sidebar)
- **มาตรฐาน Layout ของรายการ Card:**
  - กำหนดให้ `.master-card-grid` แสดงผลเป็น **1 คอลัมน์เดี่ยว (`grid-template-columns: 1fr;`) ในทุกขนาดหน้าจอ**
  - **เหตุผล:** เพื่อป้องกันไม่ให้ข้อมูลสำคัญ (เช่น ชื่อย่อ, ชื่อเต็มภาษาไทยขนาดยาว, ลิงก์ URL, และปุ่มแก้ไข/ลบ) ถูกบีบอัดจนตกบรรทัดหรือเกิดปัญหา layout เบียดเสียดกันเมื่อมีหลายคอลัมน์

---

## 4. Typography & Font Compatibility Rules

### 4.1 Middle Dot Character Incompatibility
> [!WARNING]
> ฟอนต์ประจำโปรเจกต์ (`RD Chulajaruek`) **ไม่รองรับตัวอักษร Middle Dot (`·`)** จะแสดงผลเป็นสี่เหลี่ยมหรือเครื่องหมายคำถาม ให้ใช้เครื่องหมายขีดคั่น `-` หรือเว้นวรรคแทนเสมอ เช่น:
> - **ผิด:** `25 ก.ย. 2569 · 12:00 น.`
> - **ถูก:** `25 ก.ย. 2569 - 12:00 น.`

### 4.2 Minimum Font Size (ขนาดตัวอักษรขั้นต่ำ 1rem)
> [!IMPORTANT]
> ขนาดตัวอักษรที่เล็กที่สุดที่อนุญาตให้ใช้ในระบบคือ **`1rem`** (เทียบเท่า `text-base` หรือ `16px`) ห้ามใช้ขนาดที่เล็กกว่า 1rem (เช่น `text-xs`, `text-sm`, `0.875rem`, `0.75rem`) ในเนื้อหาและองค์ประกอบ UI เพื่อให้อ่านภาษาไทยได้ชัดเจนและรองรับฟอนต์ `RD Chulajaruek` ได้อย่างเหมาะสม

### 4.3 Full-Space Page Standard
ทุกหน้าที่สร้างใหม่ต้องครอบคลุมพื้นที่ความสูงและกว้างทั้งหมดของคอนเทนต์กลาง:
```css
.page-container {
  min-height: calc(100vh - 2.5rem);
  display: flex;
  flex-direction: column;
}
```

---

## 5. Security & Data Architecture Pattern: Dual-Write Pattern

### 5.1 ปัญหาของ Firebase Realtime Database
Firebase RTDB **ไม่รองรับ Field-level security rules** หากเปิดสิทธิ์ Read ให้สาธารณะในโหนดใด ผู้ใช้จะสามารถเข้าถึง Key (รหัสโค้ดลับ) และทุกฟิลด์ในโหนดนั้นได้

### 5.2 วิธีแก้ปัญหา (Dual-Write Projection Pattern)
เมื่อแอดมินสร้างโค้ดหรือทำธุรกรรมที่มีความลับ (เช่น โค้ดเติมเงิน VIP):
1. **Private Node (`redeemCodes/{code}`):** เก็บข้อมูลโค้ดลับพร้อมสิทธิ์เฉพาะ Admin หรือเจ้าของ UID เท่านั้น
2. **Public Projected Node (`donations/{randomPushId}`):** บันทึกเฉพาะข้อมูลที่ไม่เป็นความลับ ได้แก่ `amount` และ `donatedAt` โดยใช้ Random ID เพื่อไม่ให้สามารถเดาหรือย้อนกลับไปหารหัสลับได้
3. **Admin Sync Mechanism:** มีฟังก์ชัน `syncDonations()` ในฝั่งแอดมิน เพื่อทำ Projection ย้อนหลังสำหรับข้อมูลเดิมที่มีอยู่

---

## 6. Angular Budget Optimization Pattern

`angular.json` ของโปรเจกต์ตั้งข้อจำกัดขนาด Component Style ไว้เข้มงวด:
- `maximumWarning`: `3kb`
- `maximumError`: `6kb`

**วิธีจัดระเบียบสไตล์เพื่อไม่ให้เกิน Budget:**
1. **ใช้ Tailwind สำหรับ Layout & Spacing:** Utility classes เช่น `flex`, `gap-3`, `p-4`, `min-w-0`, `flex-wrap` จะถูกรวมใน Global Stylesheet และถูก Purge ขนาดไฟล์ ทำให้ไม่นับรวมใน Component Style Budget
2. **ใช้ Component CSS เฉพาะ Tokens & Custom Rules:** เก็บเฉพาะตัวแปร CSS Variables, Hero Keyframes, Media Query เฉพาะส่วน, และ Retro Shadow เพื่อให้ไฟล์ `.component.css` มีขนาดเล็ก (< 3kB)
