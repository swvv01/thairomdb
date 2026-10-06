# Mobile Layout & Navigation Knowledge Guide (ROM Collector)

เอกสารรวบรวมแบบแผนและข้อควรระวังในการออกแบบและพัฒนา Layout, แถบ Header, Marquee, Sidebar และ Navigation บนหน้าจอ Mobile (หน้าจอขนาดเล็ก $\le$ 900px)

---

## 1. Multi-Tier Header Pattern (โครงสร้าง Header หลายชั้น)

### 1.1 ปัญหาของ Hardcoded `top` Offsets
เมื่อมี Header หลายแถวเรียงกัน (เช่น Topbar + Marquee ข่าวสาร) การกำหนด `position: fixed` แยกชิ้นกันโดยระบุระยะ `top: ...` (เช่น `top: 0` สำหรับแถบบน และ `top: 4rem` สำหรับแถบล่าง) **ห้ามทำโดยเด็ดขาด**
- **สาเหตุ:** หากความสูงจริงของแถบบนไม่ตรงกับตัวเลขที่เดาไว้ (เช่น Topbar สูง 2.625rem / 42px แต่ตั้งแถบล่างไว้ที่ `4rem` / 64px) จะเกิดช่องโหว่ว่างเปล่า (Gap) ขนาด 22px คั่นกลางระหว่างแถบทั้งสองทันที
- นอกจากนี้ เมื่อเกิด Text Wrap หรือผู้ใช้ปรับขนาดฟอนต์บนมือถือ ระยะ `top` ที่ฮาร์ดโค้ดไว้จะเหลื่อมล้ำหรือทับซ้อนกัน

### 1.2 โซลูชันที่ถูกต้อง (Single Container Pattern)
หุ้มทุกแถบของ Header ไว้ภายใต้คอนเทนเนอร์เดียวกัน:
```html
<header class="app-header">
  <div class="app-topbar ...">
    <!-- โลโก้, ปุ่ม Hamburger, วันที่อัปเดต -->
  </div>
  @if (!authService.isVip()) {
  <div class="marquee ...">
    <!-- แถบข้อความวิ่ง (ซ่อนเมื่อเป็น VIP) -->
  </div>
  }
</header>
```
และใน CSS กำหนด `position: fixed` ที่คอนเทนเนอร์แม่เท่านั้น:
```css
@media (max-width: 900px) {
  :host-context(body.sidebar-open) .app-header {
    left: 0;
    position: fixed;
    right: 0;
    top: 0;
    z-index: 30;
  }
}
```
- **ผลลัพธ์:** ทั้ง Topbar และ Marquee จะไหลต่อกันตาม Flow ธรรมชาติ (Normal Document Flow) ภายใน `.app-header` ทำให้ติดกันสนิท 100% เสมอ ไม่ว่าฟอนต์หรือหน้าจอจะเปลี่ยนไปอย่างไร

---

## 2. Mobile Drawer Scrolling & Height Constraints (การจำกัดความสูงและ Scroll ใน Sidebar)

### 2.1 กับดัก `position: fixed` กับ `height: auto` (สาเหตุที่ Sidebar เลื่อนไม่ได้)
เมื่อตั้งค่า Drawer บน Mobile เป็น `position: fixed; top: 0;` โดย**ไม่มีการระบุ `bottom: 0` หรือ `max-height`**:
- บราวเซอร์จะคำนวณความสูงของกล่องเป็น `height: auto` ตามธรรมชาติ
- ความสูงของ Drawer จะยืดขยายยาวลงไปข้างล่างตามเนื้อหาทั้งหมด (เช่น รายการเกมและทีมแปลที่ยาวเกิน 2,000px)
- เมื่อตัวกล่องขยายครอบเนื้อหาไว้ทั้งหมด เนื้อหาจึงไม่เกิดการล้น (overflow) ภายในกล่อง
- ส่งผลให้ `overflow-y: auto` **ไม่สร้าง Scrollbar และไม่สามารถเลื่อนดูเนื้อหาได้**
- และเนื่องจากบนมือถือมีกฎ `body.sidebar-open { overflow: hidden; }` จึงทำให้ทั้งหน้าจอถูกล็อกอย่างสมบูรณ์

### 2.2 พฤติกรรมตามสเปกของ CSS `overflow-y`
ตามมาตรฐาน CSS Specification (W3C):
> หากกำหนด `overflow-y: auto;` หรือ `scroll;` โดยไม่ได้ระบุ `overflow-x` ตัวบราวเซอร์จะคำนวณค่า `overflow-x` เป็น `auto` โดยอัตโนมัติ (ไม่ใช่ `visible`)

ส่งผลให้หากมีคอนเทนต์ภายในกว้างเกินกล่องแม้แต่ 1px จะเกิดแถบ Scrollbar แนวนอนทันที จึงต้องระบุ `overflow-x: hidden;` ควบคู่เสมอ

### 2.3 โซลูชันที่ถูกต้อง: Top-0 Full Height Pattern พร้อม Dynamic VIP Padding
เพื่อให้รองรับทั้งผู้ใช้ทั่วไป (มี Marquee สูง 5rem) และผู้ใช้ VIP (ซ่อน Marquee เหลือ Header ~2.75rem):
1. **กำหนด `top: 0; bottom: 0;` และ `max-height: 100dvh;`:** ตรึงกล่องให้อยู่ในหน้าจอตลอดเวลาเพื่อเปิดใช้งาน `overflow-y: auto;`
2. **ใช้ `padding-top` แทน `top: 5rem`:** ให้ Sidebar อยู่เลเยอร์ใต้ Header (`z-index: 20` ใต้ Header `z-index: 30`) แล้วดันเนื้อหาลงมาด้วย Padding:
   - ผู้ใช้ทั่วไป (มี Marquee): `padding-top: 5rem;`
   - ผู้ใช้ VIP (ไม่มี Marquee): `padding-top: 2.75rem;` ผ่านคลาส `.is-vip`

```css
@media (max-width: 900px) {
  .retro-rail {
    background: var(--color-surface);
    bottom: 0;                  /* ตรึงขอบล่างกับหน้าจอ */
    display: none;
    left: 0;
    max-height: 100vh;
    max-height: 100dvh;         /* บังคับความสูงไม่ให้เกินหน้าจอ เพื่อให้ scroll ได้ */
    min-width: 0;
    overflow-x: hidden;          /* ป้องกัน Scrollbar แนวนอน */
    overflow-y: auto;            /* เลื่อนแนวตั้ง */
    position: fixed;
    top: 0;                     /* เริ่มจากด้านบนสุด */
    width: min(18rem, 85vw);
    z-index: 20;
    padding: 5rem 1rem 1rem 0.5rem;
  }

  .retro-rail.is-vip {
    padding-top: 2.75rem;       /* สำหรับ VIP ที่ไม่มี Marquee */
  }

  .retro-rail.mobile-sidebar-open {
    display: block;
    padding-bottom: 8rem;        /* พื้นที่ด้านล่างให้กดเมนูสุดท้ายได้ง่าย */
  }

  :host-context(body.sidebar-open) .app-shell {
    padding-top: 5rem;
  }

  :host-context(body.sidebar-open) .app-shell.is-vip {
    padding-top: 2.75rem;
  }
}
```

3. **บังคับตัดคำในปุ่มและลิงก์:**
```css
.retro-rail-link,
.retro-system-button {
  overflow-wrap: break-word;
  word-break: break-word;
}
```

---

## 3. Desktop Padding Isolation (การแยก Padding ระหว่าง Desktop กับ Mobile)

บนหน้าจอ Desktop (`min-width: 901px`):
- `.app-shell` เป็น CSS Grid และ `<header class="app-header">` อยู่ใน Normal Document Flow (ไม่ได้เป็น `position: fixed`)
- หากคลาสแม่ `.retro-rail` กำหนด `padding: 5rem ...` จะส่งผลให้เมนูบน Desktop ถูกดันลงมา 5rem เกิดช่องว่างเปล่าด้านบนโดยไม่จำเป็น
- **วิธีแก้:** ต้องรีเซ็ต `padding-top: 1rem;` ภายใต้ `@media (min-width: 901px)` เสมอ:
```css
@media (min-width: 901px) {
  .retro-rail {
    display: flex;
    flex-direction: column;
    padding-top: 1rem;
  }
}
```

---

## 4. Flexbox Baseline Alignment (การจัดแนวตัวอักษรกับไอคอนในระดับเดียวกัน)

### 4.1 ปัญหาของ `align-items: center` กับ Element ต่างชนิด
ในแถวรายการที่มีทั้งปุ่มข้อความยาวและไอคอน เช่น แถวทีมแปล (`.sidebar-translator-row`):
- บน Mobile ปุ่มข้อความ (`.retro-system-button`) ถูกกำหนด `min-height: 44px;` และ `padding: 0.65rem 0.75rem;` เพื่อให้ผ่านเกณฑ์ Mobile Touch Target
- ตัวอักษรจึงถูกดันลงมาด้วย `padding-top: 0.65rem` (~10px) และอยู่ที่ครึ่งบนของกล่อง 44px
- แต่ไอคอน (เช่น ไอคอนดินสอแก้ข้อมูล หรือไอคอนโซเชียล) มีความสูงเพียง ~16px หากแถวใช้ `align-items: center;` ไอคอนจะถูกจัดไว้ตรงกึ่งกลางกล่อง 44px (ระดับ ~22px) ทำให้ไอคอนห้อยต่ำกว่าระดับตัวอักษร (~8px) ไม่เป็นระนาบเดียวกัน

### 4.2 โซลูชันที่ถูกต้อง (Baseline Alignment Pattern)
1. **กำหนด Flexbox Container ให้จัดแนวด้วย Baseline:**
   ```css
   .sidebar-translator-row {
     align-items: baseline;
     display: flex;
     gap: .35rem;
   }
   ```
2. **ตั้งค่า Wrapper ของไอคอนให้ส่งต่อ Baseline:**
   ```css
   .sidebar-translator-edit-link,
   .sidebar-translator-links,
   .sidebar-translator-links a {
     align-items: baseline;
     display: inline-flex;
     line-height: inherit;
   }
   ```
3. **รีเซ็ต `vertical-align` ของไอคอน FontAwesome:**
   FontAwesome กำหนด `vertical-align: -0.125em;` เป็นค่าเริ่มต้นสำหรับตัวละติน ในแถวที่ต้องการระนาบตรงกับฟอนต์ไทย ให้รีเซ็ตเป็น:
   ```css
   .sidebar-translator-row i {
     vertical-align: baseline;
   }
   ```
4. **กำหนด Touch Target และ Padding บน Mobile ให้สอดคล้องกัน:**
   ```css
   @media (max-width: 900px) {
     .sidebar-translator-edit-link,
     .sidebar-translator-links a {
       min-height: 44px;
       padding: 0.65rem 0.25rem;
       line-height: 1.2;
       touch-action: manipulation;
     }

     .sidebar-translator-row > .retro-system-button {
       padding-left: 0.25rem;
       padding-right: 0.25rem;
     }
   }
   ```
   - ไอคอนทั้งซ้ายและขวาจะได้ `padding-top: 0.65rem` เท่ากับข้อความ
   - ได้พื้นที่แตะสัมผัส (Touch Target) สูง 44px ครบถ้วนตามมาตรฐานมือถือ
   - เส้น Baseline ของข้อความและไอคอนทั้งหมดจะวางอยู่บนเส้นระนาบเดียวกันอย่างสมบูรณ์

---

## 5. Breakpoint Collision Prevention (การป้องกันการชนกันของ Media Query ช่วงรอยต่อ)

### 5.1 ปัญหาของ Breakpoint Overlap (Dead-zone ช่วง 769px - 900px)
ในระบบเดิม มีการตั้งค่า Media Query ที่ทับซ้อนกัน:
- `@media (min-width: 769px)` สำหรับเปิดใช้งาน 2-Column CSS Grid (`grid-template-columns: 288px minmax(0, 1fr);`)
- `@media (max-width: 900px)` สำหรับเปิดใช้งาน Mobile Drawer ซ่อน Sidebar เป็น `display: none;` หรือ `position: fixed;` และแสดงปุ่ม Hamburger

**ผลลัพธ์เมื่อหน้าจอกว้าง 769px - 900px:**
- ทั้งสองเงื่อนไขทำงานพร้อมกัน
- ตามพฤติกรรมของ CSS Grid เมื่อลูกตัวแรก (`.retro-rail`) กลายเป็น `display: none` หรือหลุดจาก Normal Flow ด้วย `position: fixed` ตัวลูกถัดไป (`.app-content`) จะถูกเลื่อนเข้ามาอยู่ใน Track ที่ 1 แทน
- Track ที่ 1 มีความกว้างคงที่เพียง `288px` ทำให้คอนเทนต์ทั้งหน้าเว็บ (เช่น หน้า `/add` หรือหน้าต่างๆ) ถูกบีบอัดจนเหลือความกว้างเพียง 288px ชิดซ้าย และเกิดพื้นที่ว่างเปล่าขนาดใหญ่ทางขวามือ

### 5.2 มาตรฐาน Breakpoint ที่ถูกต้องสำหรับระบบ
เพื่อให้แน่ใจว่าจะไม่เกิดช่องว่างหรือการชนกันของเลย์เอาต์:
1. **จับคู่ Breakpoint อย่างเคร่งครัด:**
   - **Mobile / Drawer:** `@media (max-width: 900px)`
   - **Desktop Grid:** `@media (min-width: 901px)` (ห้ามใช้ `769px` เป็นอันขาด)
   - **Desktop Wide (3-Column):** `@media (min-width: 1200px)`
2. **Component ย่อยต้องใช้ Breakpoint เดียวกัน:**
   - องค์ประกอบที่มีการปรับตำแหน่งบน Mobile เช่น ปุ่มลอย (`.floating-action`, `.browse-floating-actions`), ระยะของแถบฟอร์ม (`.form-actions`), หรือหัวข้อ Route Label ต้องใช้ `@media (max-width: 900px)` ให้สอดคล้องกันทั้งแอปพลิเคชัน

