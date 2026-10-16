# สถาปัตยกรรม Cloudflare Edge Cache Proxy และ Cache Validation

เอกสารนี้อธิบายสถาปัตยกรรมและรายละเอียดการทำงานของระบบ **Cloudflare Edge Cache Proxy** ร่วมกับ **Client Cache Validation (HEAD Check)** ของโปรเจกต์ **ROM Collector (THAI ROM DB)** เพื่อแก้ไขและป้องกันปัญหาการใช้แบนด์วิดท์เกินขีดจำกัดของ Firebase Realtime Database

---

## 1. ปัญหาและที่มา (Background & Problem)

* **สถาปัตยกรรมเดิม:** หน้าเว็บดึงรายการแพตช์เกมทั้งหมด (`patches`) จาก Firebase Realtime Database โดยตรงผ่าน Firebase SDK
* **ปัญหาที่พบ:** ในรอบ 15 วัน ระบบมีการดาวน์โหลดข้อมูลจาก Firebase RTDB ไปแล้วกว่า **8 GB** (ซึ่งเกือบชนโควตาฟรี 10 GB/เดือน ของ Firebase Spark Plan) มีความเสี่ยงที่ฐานข้อมูลจะถูกระงับการทำงานเมื่อครบโควตา
* **การแก้ไข:** ใช้ **Cloudflare Worker** ที่มีอยู่แล้ว ([r2-worker](file:///d:/me/rom_collector/r2-worker)) ทำหน้าที่เป็น **Edge Cache Proxy** ดักหน้าคำขอดึงข้อมูล ช่วยลดการเรียก Firebase ลงได้มากกว่า **98%** (เหลือการเรียก Firebase ไม่ถึง 30 - 50 MB ต่อเดือน)

---

## 2. แผนผังสถาปัตยกรรม (Architecture Diagram)

```mermaid
flowchart TD
    User["ผู้ใช้เปิดเว็บ (Client)"] --> CheckLocal{"มีข้อมูลใน localStorage หรือไม่?"}
    
    CheckLocal -->|มีข้อมูลเดิม| SendHead["ยิง HEAD /api/data/patches<br/>(ขนาดจิ๋ว ~0.2 KB)"]
    CheckLocal -->|ไม่มีข้อมูลเดิม (เข้าครั้งแรก)| SendGet["ยิง GET /api/data/patches<br/>(ดาวน์โหลด JSON เต็ม)"]
    
    SendHead --> CheckTimestamp{"X-Edge-Cached-At<br/>ตรงกับในเครื่องหรือไม่?"}
    CheckTimestamp -->|ตรงกัน| UseLocal["ใช้ข้อมูลเดิมใน localStorage ทันที<br/>(ดาวน์โหลด JSON ใหม่ 0 KB, เร็ว 0ms)"]
    CheckTimestamp -->|ไม่ตรงกัน (มีข้อมูลใหม่)| SendGet

    SendGet --> CFWorker["Cloudflare Worker (โหนด BKK)"]
    CFWorker --> CheckEdgeCache{"มีแคชใน Edge หรือไม่?"}
    
    CheckEdgeCache -->|Cache HIT (18 ชม.)| ReturnEdge["ส่งคืน JSON จาก Edge Cache ทันที<br/>(10-20ms, ฟรี ไม่แตะ Firebase)"]
    CheckEdgeCache -->|Cache MISS หรือ VIP Force Reload| FetchFirebase[("Firebase Realtime Database<br/>REST API (/patches.json)")]
    
    FetchFirebase --> SaveEdge["อัปเดต Edge Cache (18 ชม.)<br/>+ ประทับเวลา X-Edge-Cached-At"]
    SaveEdge --> ReturnClient["ส่งคืน JSON ให้เบราว์เซอร์<br/>+ เซฟลง localStorage"]

    CFWorker -.->|Worker ขัดข้อง| Fallback["Graceful Fallback<br/>สลับไปดึง Firebase RTDB SDK ตรงๆ"]
```

---

## 3. รายละเอียดการทำงานของแต่ละส่วน

### 3.1 Cloudflare Worker ([r2-worker/src/index.ts](file:///d:/me/rom_collector/r2-worker/src/index.ts))
* **Route:** `/api/data/patches` (รองรับทั้ง `GET` และ `HEAD`)
* **ระยะเวลาแคช (TTL):** 18 ชั่วโมง (`s-maxage=64800`) บน Cloudflare CDN โหนดกรุงเทพฯ
* **การส่งคืนเวลาแคช:** ส่งผ่าน Header `X-Edge-Cached-At: ISOString` เพื่อระบุเวลาจริงที่ Worker ดึงข้อมูลมาจาก Firebase
* **คำขอแบบ `HEAD`:** ตรวจสอบและส่งกลับเฉพาะ HTTP Headers (ไม่มี Body หรือ Payload ขนาดใหญ่) ช่วยให้ Client ตรวจสอบเวอร์ชันได้โดยใช้แบนด์วิดท์เพียง ~0.2 KB
* **VIP / Admin Force Reload:**
  * รองรับพารามิเตอร์ `?fresh=true`
  * ตรวจสอบความปลอดภัยด้วย Header `X-Purge-Key` เทียบกับ Secret ใน Worker เพื่อป้องกันไม่ให้บุคคลภายนอกหรือบอทแอบยิง bypass แคช
  * เมื่อยืนยันสิทธิ์ถูกต้อง Worker จะวิ่งไปดึงข้อมูลสดจาก Firebase ทันที และเขียนทับแคช 18 ชั่วโมงรอบใหม่ให้ทุกคน
  * **การเรียกใช้งาน:** ทำงานเมื่อกดปุ่ม **"ดึงข้อมูลล่าสุด"** ในแถบเมนูข้าง (Sidebar) ของผู้ใช้ VIP/Admin เท่านั้น โดยระบบจะไม่ล้างแคชอัตโนมัติในทุกการบันทึก/แก้ไขเกม เพื่อรองรับการเพิ่มเกมเป็นชุด (Batch) ต่อเนื่องหลายเกมโดยไม่สิ้นเปลืองโควตาและไม่ล้างแคชซ้ำซ้อน

### 3.2 Frontend Cache Validation ([web/src/app/repositories/patch.repository.ts](file:///d:/me/rom_collector/web/src/app/repositories/patch.repository.ts))
* เมื่อเปิดหน้าเว็บ หากในเครื่องมีข้อมูลและเวลาแคชเดิม (`localSavedAt`):
  1. ส่งคำขอ `HEAD /api/data/patches` ไปยัง Cloudflare Worker
  2. เปรียบเทียบ `X-Edge-Cached-At` กับ `localSavedAt` ใน `localStorage`
  3. หากตรงกัน: ส่งคืน `isSameAsLocal: true` เพื่อนำข้อมูลจาก `localStorage` มาแสดงผลทันทีโดยไม่ต้องดาวน์โหลด JSON ซ้ำ
  4. หากไม่ตรงกัน หรือยังไม่มีข้อมูล: ส่งคำขอ `GET /api/data/patches` เพื่อดาวน์โหลดและบันทึกชุดใหม่
* **Graceful Fallback:** หาก Worker ไม่ตอบสนองหรือขัดข้อง ระบบจะ fallback ไปดึงผ่าน Firebase RTDB SDK โดยอัตโนมัติ

### 3.3 การแสดงผล `#last-update` ([web/src/app/app.component.html](file:///d:/me/rom_collector/web/src/app/app.component.html))
* กล่อง `#last-update` แสดงเวลาจริงที่ข้อมูลถูกบันทึกไว้ที่ Cloudflare Edge Server (จาก Header `X-Edge-Cached-At`)
* ผู้ใช้ทุกคนจะเห็นเวลาอัปเดตเดียวกันอย่างถูกต้อง ไม่ว่าเปิดจากเครื่องใด

---

## 4. ผลลัพธ์และการประหยัดทรัพยากร (Impact & Resource Savings)

| ตัวชี้วัด | สถาปัตยกรรมเดิม | สถาปัตยกรรมใหม่ | ผลลัพธ์ |
|---|---|---|---|
| **Firebase RTDB Download Bandwidth** | ~16 GB / เดือน (เกินโควตาฟรี 10 GB) | **~30 - 50 MB / เดือน** | ประหยัดแบนด์วิดท์ลง **98%+** |
| **ความเร็วในการโหลดซ้ำ (Page Refresh)** | 500 KB - 1 MB ต่อครั้ง | **~0.2 KB (HEAD check)** | เร็วขึ้น และใช้เน็ตลดลง 3,500 เท่า |
| **Cloudflare Workers Requests** | - | ~2,000 req / วัน | ใช้เพียง **2%** ของโควตาฟรี (100,000 req/วัน) |
| **Cloudflare Bandwidth Fee** | - | **$0 (ฟรี ไม่จำกัด)** | ไม่มีค่าใช้จ่ายส่วนเกิน |
