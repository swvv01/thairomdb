# คู่มือการตั้งค่า Cloudflare Pages (Cloudflare Pages Deployment Guide)

คู่มือนี้รวบรวมขั้นตอนการเชื่อมต่อ Git Repository และตั้งค่า Build Configuration สำหรับโปรเจกต์ **ROM Collector (THAI ROM DB)** บน **Cloudflare Pages** ให้สามารถ Deploy และอัปเดตเว็บแบบอัตโนมัติ (CI/CD) ได้อย่างถูกต้อง

---

## 1. ข้อมูลภาพรวมโครงสร้างโปรเจกต์

- **Repository:** `swvv01/thairomdb` (หรือ Fork ที่เกี่ยวข้อง)
- **Production Branch:** `production`
- **Application Directory:** โค้ดทั้งหมดของ Angular 17 อยู่ในโฟลเดอร์ `web/`
- **Output Directory หลัง Build:** `web/dist/cloudflare` (ไม่มีโฟลเดอร์ `browser/` ซ้อนด้านใน)
- **Node.js Version:** แนะนำ Node `20`

---

## 2. ขั้นตอนการตั้งค่าบน Cloudflare Dashboard

เมื่อเข้าไปที่ Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**:

### 2.1 เลือก Repository
- **Git account:** เลือกบัญชี GitHub ที่มีสิทธิ์เข้าถึง (เช่น `swvv01`)
- **Repository:** เลือก `thairomdb`
- **Production branch:** เลือก `production`

---

### 2.2 ตั้งค่า Build Configuration

| ช่องการตั้งค่า (Setting) | ค่าที่ต้องระบุ | คำอธิบาย |
|---|---|---|
| **Framework preset** | `Angular` | Preset พื้นฐานของ Cloudflare |
| **Build command** | `npm run build` | คำสั่ง Build ของ Angular |
| **Build output directory** | `dist/cloudflare` | โฟลเดอร์ผลลัพธ์ไฟล์ Static Web |
| **Root directory (advanced)** | `web` | **สำคัญมาก:** ต้องระบุเพื่อให้ Cloudflare รันคำสั่งในโฟลเดอร์ `web/` |

> [!IMPORTANT]
> **Root directory (advanced):**
> เนื่องจากโค้ด Angular และไฟล์ `package.json` อยู่ในโฟลเดอร์ `web` (ไม่ใช่ Root ของ Git Repo) หากไม่ตั้งช่องนี้เป็น `web` ระบบจะหาไฟล์ `package.json` ไม่พบและ Build ล้มเหลว

---

### 2.3 ตั้งค่า Environment Variables (ตัวแปรสภาพแวดล้อม)

ใต้หัวข้อ **Variables and secrets** (หรือในแท็บ Settings หลังสร้างโปรเจกต์):

| Type | Name | Value | คำอธิบาย |
|---|---|---|---|
| Plain text | `NODE_VERSION` | `20` | บังคับให้ Cloudflare Pages ใช้ Node.js 20 ในการ Build (รองรับ Angular 17 เต็มรูปแบบ) |

---

## 3. การรองรับระบบ SPA Routing (ป้องกัน Error 404 เมื่อ Refresh หน้าเว็บ)

ใน Angular Single Page Application (SPA) การเข้าถึง URL โดยตรง (เช่น `/browse`, `/admin/patch`, `/donate`) ต้องให้เซิร์ฟเวอร์ส่งไฟล์ `index.html` กลับมาเสมอ

โปรเจกต์นี้ได้เตรียมไฟล์ `web/src/_redirects` ไว้ใน `src/assets` เรียบร้อยแล้ว:
```text
/* /index.html 200
```
เมื่อ Angular ทำการ Build ไฟล์นี้จะถูกคัดลอกลงโฟลเดอร์ `dist/cloudflare/_redirects` โดยอัตโนมัติ ทำให้ Cloudflare Pages จัดการ Rewrite Route ของทุกหน้าให้ถูกต้อง 100%

---

## 4. ข้อควรระวังและแนวทางแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

### 4.1 ปัญหา Bundle Budget Exceeded (Build Failed ด้วย Error 1.00 MB)
- **สาเหตุ:** ค่า Default ของ Angular มีการจำกัดขนาดไฟล์เริ่มต้นไว้ที่ 1MB หากโปรเจกต์มีขนาดเกินจะสั่งหยุด Build ทันที
- **วิธีแก้:** ใน `web/angular.json` ได้ปรับขนาด `budgets` รองรับไว้แล้ว:
  ```json
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "1mb",
      "maximumError": "1.5mb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "8kb",
      "maximumError": "12kb"
    }
  ]
  ```

### 4.2 ปัญหาโฟลเดอร์ซ้อน `browser/` ใน Angular 17+
- **สาเหตุ:** Angular Application Builder รุ่นใหม่จะสร้างโฟลเดอร์ย่อยชื่อ `browser` ภายใน output directory เสมอ (เช่น `dist/.../browser`)
- **วิธีแก้:** ใน `web/angular.json` มีการตั้งค่า `"browser": ""` ไว้แล้ว:
  ```json
  "outputPath": {
    "base": "dist/cloudflare",
    "browser": ""
  }
  ```
  ทำให้ไฟล์ทั้งหมดจะวางอยู่ที่ `dist/cloudflare/` โดยตรงตรงกับค่าคอนฟิกของ Cloudflare Pages ทันที
