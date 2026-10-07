import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Database, get, ref, remove, set, update } from '@angular/fire/database';
import { AuthService } from './auth.service';
import { StatusMessageService } from '../shared/status-message.service';

const GUEST_STORAGE_KEY = 'thairomdb_guest_library';
const VIP_CACHE_KEY_PREFIX = 'thairomdb_vip_library_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CachedLibrary {
  savedAt: number;
  ids: string[];
}

@Injectable({ providedIn: 'root' })
export class GameLibraryService {
  private readonly database = inject(Database, { optional: true });
  private readonly auth = inject(AuthService, { optional: true });
  private readonly status = inject(StatusMessageService, { optional: true });

  readonly libraryPatchIds = signal<Set<string>>(new Set());
  readonly libraryCount = computed(() => this.libraryPatchIds().size);
  readonly isSyncing = signal(false);

  constructor() {
    // โหลดครั้งแรกจาก local ทันทีเพื่อให้ UI พร้อมทำงานแบบ 0ms
    this.initLocalData();

    // Effect ตรวจจับการเปลี่ยนแปลงของสถานะ Auth / VIP
    if (this.auth && typeof this.auth.user === 'function' && typeof this.auth.isVip === 'function') {
      effect(() => {
        const user = typeof this.auth?.user === 'function' ? this.auth.user() : null;
        const isVip = typeof this.auth?.isVip === 'function' ? this.auth.isVip() : false;

        untracked(() => {
          if (user && isVip) {
            const userKey = this.getUserKey(user);
            if (userKey) {
              this.handleVipSession(userKey);
              return;
            }
          }
          this.initLocalData();
        });
      });
    }
  }

  private getUserKey(user: { email?: string | null; uid: string } | null): string | null {
    if (!user) return null;
    const email = user.email?.trim().toLowerCase();
    if (email && email.includes('@')) {
      return email.replace(/\./g, ',');
    }
    return user.uid;
  }

  isInLibrary(patchId: string): boolean {
    return this.libraryPatchIds().has(patchId);
  }

  /**
   * สลับสถานะ เก็บเข้าคลัง / ลบออกจากคลัง
   */
  async toggleLibrary(patchId: string, gameTitle = 'เกม'): Promise<boolean> {
    const isPresent = this.isInLibrary(patchId);
    if (isPresent) {
      await this.removeFromLibrary(patchId, gameTitle);
      return false;
    } else {
      await this.addToLibrary(patchId, gameTitle);
      return true;
    }
  }

  /**
   * เพิ่มเกมเข้าคลัง
   */
  async addToLibrary(patchId: string, gameTitle = 'เกม'): Promise<void> {
    const current = new Set(this.libraryPatchIds());
    if (current.has(patchId)) return;

    // Async feedback: progress
    this.status?.show(`กำลังเพิ่ม "${gameTitle}" เข้าคลัง...`);
    try {
      current.add(patchId);
      this.libraryPatchIds.set(current);

      const user = typeof this.auth?.user === 'function' ? this.auth.user() : null;
      const isVip = typeof this.auth?.isVip === 'function' ? this.auth.isVip() : false;
      const userKey = this.getUserKey(user);

      if (user && isVip && userKey && this.database) {
        // เซฟลง Local cache ของ VIP
        this.saveVipLocalCache(userKey, current);
        // บันทึกเจาะจงที่ RTDB: set(...) ค่าเป็น 1 ไม่เปลือง bandwidth
        await set(ref(this.database, `userLibraries/${userKey}/${patchId}`), 1);
      } else {
        // บันทึกลง guest localStorage
        this.saveGuestLocalData(current);
      }
      this.status?.show(`เพิ่ม "${gameTitle}" เข้าคลังเรียบร้อยแล้ว`, 'success');
    } catch (error) {
      // Rollback memory if failed
      current.delete(patchId);
      this.libraryPatchIds.set(current);
      this.status?.show(`ไม่สามารถเพิ่ม "${gameTitle}" เข้าคลังได้`, 'error');
      throw error;
    }
  }

  /**
   * ลบเกมออกจากคลัง
   */
  async removeFromLibrary(patchId: string, gameTitle = 'เกม'): Promise<void> {
    const current = new Set(this.libraryPatchIds());
    if (!current.has(patchId)) return;

    this.status?.show(`กำลังนำ "${gameTitle}" ออกจากคลัง...`);
    try {
      current.delete(patchId);
      this.libraryPatchIds.set(current);

      const user = typeof this.auth?.user === 'function' ? this.auth.user() : null;
      const isVip = typeof this.auth?.isVip === 'function' ? this.auth.isVip() : false;
      const userKey = this.getUserKey(user);

      if (user && isVip && userKey && this.database) {
        this.saveVipLocalCache(userKey, current);
        // ลบเฉพาะโหนดจาก RTDB
        await remove(ref(this.database, `userLibraries/${userKey}/${patchId}`));
      } else {
        this.saveGuestLocalData(current);
      }
      this.status?.show(`นำ "${gameTitle}" ออกจากคลังแล้ว`, 'success');
    } catch (error) {
      current.add(patchId);
      this.libraryPatchIds.set(current);
      this.status?.show(`ไม่สามารถนำ "${gameTitle}" ออกจากคลังได้`, 'error');
      throw error;
    }
  }

  /**
   * บังคับดึงข้อมูลคลังจาก RTDB (สำหรับ VIP กด "ดึงข้อมูลล่าสุด" หรือเรียกเมื่อจำเป็น)
   */
  async refreshFromRemote(): Promise<void> {
    const user = typeof this.auth?.user === 'function' ? this.auth.user() : null;
    const isVip = typeof this.auth?.isVip === 'function' ? this.auth.isVip() : false;
    const userKey = this.getUserKey(user);
    if (!user || !isVip || !userKey || !this.database) return;

    try {
      this.isSyncing.set(true);
      const snapshot = await get(ref(this.database, `userLibraries/${userKey}`));
      const data = snapshot.val();
      const remoteIds = new Set<string>();

      if (data && typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (val === 1 || val === true) {
            remoteIds.add(key);
          }
        }
      }

      this.libraryPatchIds.set(remoteIds);
      this.saveVipLocalCache(userKey, remoteIds);
    } catch (error) {
      console.error('Failed to refresh user library from RTDB:', error);
    } finally {
      this.isSyncing.set(false);
    }
  }

  // --- จัดการแคชและ Local Data ---

  private initLocalData(): void {
    const guestIds = this.readGuestLocalData();
    this.libraryPatchIds.set(guestIds);
  }

  private async handleVipSession(userKey: string): Promise<void> {
    const cached = this.readVipLocalCache(userKey);
    const guestIds = this.readGuestLocalData();

    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      // มีแคชของ VIP ที่ยังไม่หมดอายุ
      const currentIds = new Set(cached.ids);
      this.libraryPatchIds.set(currentIds);

      // ถ้ามี guestIds ค้างอยู่ (เช่น เก็บเกมไว้ก่อนล็อกอิน/ก่อนอัปเกรด) ให้ Merge ขึ้น RTDB
      if (guestIds.size > 0) {
        await this.mergeAndSyncGuestToVip(userKey, currentIds, guestIds);
      }
    } else {
      // ไม่มีแคช หรือแคชหมดอายุ -> ดึงจาก RTDB ครั้งเดียว
      await this.refreshFromRemote();

      // ถ้ามี guestIds ค้างอยู่ ให้ทำการ Merge
      if (guestIds.size > 0) {
        await this.mergeAndSyncGuestToVip(userKey, this.libraryPatchIds(), guestIds);
      }
    }
  }

  private async mergeAndSyncGuestToVip(userKey: string, vipIds: Set<string>, guestIds: Set<string>): Promise<void> {
    const toUpload: Record<string, number> = {};
    const merged = new Set(vipIds);

    for (const id of guestIds) {
      if (!merged.has(id)) {
        merged.add(id);
        toUpload[id] = 1;
      }
    }

    this.libraryPatchIds.set(merged);
    this.saveVipLocalCache(userKey, merged);
    this.clearGuestLocalData();

    // ส่ง delta เฉพาะ ID ที่ยังไม่มีใน RTDB
    if (Object.keys(toUpload).length > 0 && this.database) {
      try {
        await update(ref(this.database, `userLibraries/${userKey}`), toUpload);
      } catch (error) {
        console.error('Failed to sync guest library delta to RTDB:', error);
      }
    }
  }

  private readGuestLocalData(): Set<string> {
    try {
      const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveGuestLocalData(ids: Set<string>): void {
    try {
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // ignore storage errors
    }
  }

  private clearGuestLocalData(): void {
    try {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  private readVipLocalCache(uid: string): CachedLibrary | null {
    try {
      const raw = window.localStorage.getItem(`${VIP_CACHE_KEY_PREFIX}${uid}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.savedAt === 'number' && Array.isArray(parsed.ids)) {
        return parsed as CachedLibrary;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveVipLocalCache(uid: string, ids: Set<string>): void {
    try {
      const entry: CachedLibrary = {
        savedAt: Date.now(),
        ids: [...ids]
      };
      window.localStorage.setItem(`${VIP_CACHE_KEY_PREFIX}${uid}`, JSON.stringify(entry));
    } catch {
      // ignore storage errors
    }
  }
}
