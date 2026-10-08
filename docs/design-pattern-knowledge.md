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

### 3.4 Admin Master Floating Card Stack Pattern
ในหน้า CRUD ข้อมูล Master กลางของฝั่ง Admin ที่ใช้งาน Component กลาง `AdminMasterPageComponent` (`<app-admin-master-page>`):
- **หน้าที่ใช้งานร่วมกัน:**
  - `/admin/systems` (จัดการเครื่องเกม)
  - `/admin/translators` (จัดการทีมแปล)
  - `/admin/tags` (จัดการแท็ก)
  - `/admin/sidebar-links` (จัดการลิงก์ sidebar)
- **มาตรฐาน Layout แบบ Centered Floating Card Stack:**
  - จัดวางด้วย Wrapper กลาง `.admin-master-card-wrap` (`max-width: 52rem; margin: 0 auto; gap: 2.4rem;` บนมือถือ `gap: 1.5rem;`)
  - **Header Card:** แยกเป็นการ์ดหัวข้อและปุ่มเพิ่มข้อมูล 1 ใบ พร้อม Search Box ในตัว (`.admin-master-header-card`)
  - **Item Cards Stack:** รายการข้อมูลแต่ละรายการแยกเป็น 1 การ์ด (`.master-item-card`) ภายใน `.master-cards-stack` (`gap: 1.25rem;`) ป้องกันไม่ให้ชื่อเต็มขนาดยาวหรือปุ่มจัดการตกบรรทัด
  - **Card Appearance Parity:** การ์ดทุกใบใช้ `background: var(--color-surface); border: 1px solid var(--color-shadow); box-shadow: 2px 2px 0 var(--color-shadow); padding: 1.45rem;` (มือถือ `1rem;`) เสมอ

### 3.5 Centered Floating Card Stack Pattern (มาตรฐานหน้าแบบการ์ดลอยตรงกลาง)

แบบแผนการจัดหน้ามาตรฐานสำหรับหน้าฟอร์ม, หน้ารายการเฉพาะเรื่อง, หรือหน้าธุรกรรมที่ต้องการให้เนื้อหาจัดวางรวมกลุ่มเป็นระเบียบ สวยงาม และลอยเด่นอยู่กึ่งกลางพื้นที่หน้าจอเสมือนหน้าต่างวินโดว์/เดสก์ท็อป

- **หน้าที่ใช้งานมาตรฐานนี้:**
  - `/add` (เพิ่ม/แก้ไขแพตช์เกม)
  - `/donate` (ร่วมสนับสนุนค่าเซิร์ฟเวอร์)
  - `/donations` (บันทึกประวัติการสนับสนุน)
  - `/redeem` (แลกรับสิทธิ์ VIP)
  - `/admin/articles` (จัดการบทความ: รายการบทความ, เพิ่ม/แก้ไข และ พรีวิว)
  - `/articles` & `/article/:slug` (หน้ารวมบทความและหน้ารายละเอียดบทความสาธารณะ)

#### 1) มาตรฐานพื้นหลังโปร่งใส (Transparent Page Shell Standard)
- เพื่อให้การ์ดลอยเด่นอยู่บนพื้นหลัง Desktop Shell ของแต่ละธีม (เช่น สี Classic Navy `#004e98` ใน Classic Blue หรือพื้นหลังระบบในธีม Default/Pocket-Pet) คอนเทนเนอร์ระดับหน้า (`main`, `.article-container`, `.[page]-page-shell`) **ต้องกำหนดเป็นพื้นหลังโปร่งใส (`background: transparent;`) เสมอ**
- ห้ามใส่ `background: var(--color-surface);` ที่แท็กครอบระดับหน้าหรือ `:host` เพราะจะทำให้พื้นหลังทึบตันบดบัง Desktop Shell ทั้งหน้าจอ
- การใส่สีพื้นหลัง `background: var(--color-surface);` อนุญาตเฉพาะที่ตัวการ์ด (`.card`, `.[page]-card`) เท่านั้น

#### 2) โครงสร้างคอลัมน์กึ่งกลาง (Centered Card Stack Wrapper)
- ครอบกลุ่มการ์ดทั้งหมดด้วย Wrapper กึ่งกลาง:
  - `max-width: 52rem;` (ขนาดมาตรฐานความกว้างการ์ดที่สมดุลกับกล่อง QR Code, ฟอร์มกรอกข้อมูล และลิสต์รายการ)
  - `margin: 0 auto;` (จัดกึ่งกลางแนวนอน)
  - `display: flex; flex-direction: column;`
  - **ระยะช่องไฟระหว่างการ์ด (Gap):** กำหนด `gap: 2.4rem;` (ขนาดช่องไฟมาตรฐานเดียวกันกับระยะห่างระหว่าง Game Card `.patch-card` ในหน้าแรก `/`)
  - **บนจอมือถือ (≤ 640px):** ปรับระยะช่องไฟเป็น `gap: 1.5rem;`

#### 3) ดีไซน์ขอบและเงาของการ์ด (Card Appearance Parity with Game Cards)
การ์ดทุกใบใน Stack (ทั้งการ์ดหลัก, การ์ดเสริม, และการ์ดแจ้งเตือน) ต้องมีหน้าตาเป็นอันหนึ่งอันเดียวกัน:
- `background: var(--color-surface);`
- `border: 1px solid var(--color-shadow);`
- `box-shadow: 2px 2px 0 var(--color-shadow);` (Pixel art shadow คมชัด 0 blur)
- `padding: 1.45rem;` (บนจอปกติ) และ `padding: 1rem;` (บนจอมือถือ ≤ 640px)
- `box-sizing: border-box; width: 100%; min-width: 0;`

#### 4) โครงสร้างหัวข้อภายในการ์ด (Embedded Card Header)
แทนที่การใช้ Full-bleed Hero Banner แยกส่วนด้านบน ให้ย้ายหัวข้อหลักเข้ามาไว้ที่ส่วนบนสุดภายในการ์ดหลักโดยตรง:
- มีเส้นกั้นใต้หัวข้อ: `border-bottom: 1px solid var(--color-border); padding-bottom: 1.5rem;`
- ขนาดฟอนต์ `h1`: `clamp(2rem, 5vw, 3.25rem);` พร้อมข้อความเน้นสีด้วย `<span>` เช่น `color: var(--color-highlight)` หรือ `var(--color-link)`
- คำอธิบาย: `color: var(--color-text-muted); line-height: 1.5;`

#### 5) การ์ดแจ้งเตือนและปุ่มนำทาง (Callout / Action Card Pattern)
สำหรับการ์ดแจ้งเตือนหรือการ์ดเสริมด้านล่าง (เช่น แจ้งเตือนแลกสิทธิ์ VIP หรือร่วมสนับสนุน):
- **หัวข้อ:** ใช้ไอคอนสื่อความหมายพร้อมสีไฮไลต์ (เช่น `fa-solid fa-gift text-[var(--color-highlight)]`)
- **ปุ่มนำทาง (Action Buttons):**
  - **ปุ่มหลัก (Primary):** `background: var(--color-highlight); color: var(--color-surface); border: 1px solid var(--color-border); box-shadow: 2px 2px 0 var(--color-shadow);`
  - **ปุ่มรอง (Secondary):** `background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); box-shadow: 2px 2px 0 var(--color-shadow);`
  - มี Hover effect: `filter: brightness(1.1); transform: translate(-1px, -1px);`

#### 6) Boilerplate Code Template สำหรับหน้าใหม่

```html
<main class="example-page-shell article-container pb-24 sm:pb-8">
  <div class="example-card-wrap">
    <!-- Card 1: Main Content Card -->
    <article class="example-card">
      <header class="example-header">
        <h1 class="example-title">หัวข้อหลักภาษาไทย<br><span>HIGHLIGHT ENGLISH</span></h1>
        <p class="example-description">คำอธิบายรายละเอียดแบบย่อ...</p>
      </header>

      <section class="example-body">
        <!-- ฟอร์ม หรือ คอนเทนต์หลัก -->
      </section>
    </article>

    <!-- Card 2: Callout / Action Card (ถ้ามี) -->
    <article class="callout-card" aria-label="แจ้งเตือนการใช้งาน">
      <h3 class="callout-heading">
        <i class="fa-solid fa-circle-info mr-2" aria-hidden="true"></i>
        ข้อความแนะนำหรือการแจ้งเตือน
      </h3>
      <p class="callout-desc">รายละเอียดคำแนะนำสำหรับการดำเนินการถัดไป...</p>
      <div class="callout-actions">
        <a routerLink="/primary-route" class="callout-btn callout-btn--primary">ปุ่มหลัก</a>
        <a routerLink="/secondary-route" class="callout-btn callout-btn--secondary">ปุ่มรอง</a>
      </div>
    </article>
  </div>
</main>
```

```css
:host {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.example-page-shell {
  min-height: calc(100vh - 2.5rem);
  color: var(--color-text);
  background: transparent;
}

.example-card-wrap {
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
  justify-content: center;
  margin: 0 auto;
  max-width: 52rem;
  width: 100%;
}

.example-card,
.callout-card {
  background: var(--color-surface);
  border: 1px solid var(--color-shadow);
  box-shadow: 2px 2px 0 var(--color-shadow);
  box-sizing: border-box;
  padding: 1.45rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.example-header {
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1.5rem;
}

.example-title {
  color: var(--color-text);
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.05;
  margin: 0 0 1rem;
  overflow-wrap: break-word;
  word-break: break-word;
}

.example-title span {
  color: var(--color-highlight);
}

.example-description {
  color: var(--color-text-muted);
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 640px) {
  :host .example-page-shell {
    padding: 1rem 0.75rem;
  }

  .example-card-wrap {
    gap: 1.5rem;
  }

  .example-card,
  .callout-card {
    padding: 1rem;
  }
}
```

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
