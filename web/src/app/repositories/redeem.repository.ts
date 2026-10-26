import { Injectable, inject } from '@angular/core';
import { Database, get, ref, update, remove, query, orderByChild, limitToLast, equalTo } from '@angular/fire/database';
import { RedeemCode } from '../models/redeem.models';
import { RepositoryError } from './repository-error';

@Injectable({ providedIn: 'root' })
export class RedeemRepository {
  private readonly database = inject(Database);

  async getCode(code: string): Promise<RedeemCode | null> {
    const codeStr = code.trim();
    if (!codeStr) return null;
    try {
      const snapshot = await get(ref(this.database, `redeemCodes/${codeStr}`));
      if (!snapshot.exists()) return null;
      return { id: snapshot.key!, ...snapshot.val() } as RedeemCode;
    } catch {
      return null; // Don't throw to prevent leaking errors on unauthenticated read if not allowed
    }
  }

  async redeemCode(code: string, uid: string, email: string): Promise<{ donationId?: string }> {
    const codeStr = code.trim();
    if (!codeStr) throw new RepositoryError('กรุณากรอกโค้ด', 'update');
    
    try {
      // First, get the code to make sure it exists and get its amount
      // Since rules require amount to be the same, we need the original amount
      const snapshot = await get(ref(this.database, `redeemCodes/${codeStr}`));
      if (!snapshot.exists()) {
        throw new RepositoryError('ไม่พบโค้ดนี้ในระบบ', 'update');
      }
      
      const data = snapshot.val();
      if (data['isRedeemed']) {
        throw new RepositoryError('โค้ดนี้ถูกใช้งานไปแล้ว', 'update');
      }

      const updates: Partial<RedeemCode> = {
        amount: data['amount'], // Required by rule to stay the same
        isRedeemed: true,
        redeemedBy: uid,
        redeemedEmail: email,
        redeemedAt: new Date().toISOString()
      };

      await update(ref(this.database, `redeemCodes/${codeStr}`), updates);

      if (data.donationId) {
        try {
          await update(ref(this.database, `donations/${data.donationId}`), {
            redeemedBy: uid
          });
        } catch (e) {
          console.warn('Failed to link donation to user:', e);
        }
      }

      return { donationId: data.donationId };
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถใช้งานโค้ดนี้ได้ (ข้อมูลอาจไม่ถูกต้องหรือถูกใช้ไปแล้ว)', 'update');
    }
  }

  async getUserRedeemedCodes(uid: string): Promise<RedeemCode[]> {
    if (!uid) return [];
    try {
      const q = query(ref(this.database, 'redeemCodes'), orderByChild('redeemedBy'), equalTo(uid));
      const snapshot = await get(q);
      const items: RedeemCode[] = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key!, ...child.val() });
      });
      return items;
    } catch {
      return [];
    }
  }

  async syncDonations(): Promise<{ synced: number }> {
    try {
      const snapshot = await get(ref(this.database, 'redeemCodes'));
      if (!snapshot.exists()) return { synced: 0 };
      
      const updates: any = {};
      let syncCount = 0;
      
      snapshot.forEach((child) => {
        const codeStr = child.key;
        const data = child.val();
        
        if (data.amount > 0 && !data.donationId) {
          const donationId = 'don_' + Date.now().toString(36) + Math.random().toString(36).substring(2) + syncCount;
          
          updates["donations/" + donationId] = { amount: data.amount, donatedAt: data.donatedAt || data.createdAt };
          updates["redeemCodes/" + codeStr + "/donationId"] = donationId;
          syncCount++;
        }
      });
      
      if (syncCount > 0) {
        await update(ref(this.database), updates);
      }
      return { synced: syncCount };
    } catch (error) {
      throw new RepositoryError('ไม่สามารถซิงค์ข้อมูลการบริจาคได้', 'update');
    }
  }

  async addCode(code: string, amount: number, adminUid: string, donatedAt?: string): Promise<void> {
    const codeStr = code.trim();
    if (!codeStr) throw new RepositoryError('กรุณากรอกโค้ด', 'create');
    if (amount < 0) throw new RepositoryError('จำนวนเงินต้องไม่ติดลบ', 'create');

    try {
      const existing = await get(ref(this.database, `redeemCodes/${codeStr}`));
      if (existing.exists()) {
        throw new RepositoryError('โค้ดนี้มีอยู่ในระบบแล้ว', 'create');
      }

      const createdAt = new Date().toISOString();
      const data: Omit<RedeemCode, 'id'> = {
        amount,
        isRedeemed: false,
        createdAt,
        createdBy: adminUid
      };
      
      if (donatedAt) {
        data.donatedAt = donatedAt;
      }

      const updates: any = {};
      if (amount > 0) {
        const donationId = 'don_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        data.donationId = donationId;
        updates[`donations/${donationId}`] = { amount, donatedAt: donatedAt || createdAt };
      }
      updates[`redeemCodes/${codeStr}`] = data;

      await update(ref(this.database), updates);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถเพิ่มโค้ดได้', 'create');
    }
  }

  async revokeCode(code: string): Promise<void> {
    const codeStr = code.trim();
    if (!codeStr) return;

    try {
      const updates = {
        isRedeemed: false,
        redeemedBy: null,
        redeemedEmail: null,
        redeemedAt: null
      };
      await update(ref(this.database, `redeemCodes/${codeStr}`), updates);
    } catch {
      throw new RepositoryError('ไม่สามารถยกเลิกการใช้งานโค้ดได้', 'update');
    }
  }

  async deleteCode(code: string): Promise<void> {
    const codeStr = code.trim();
    if (!codeStr) return;

    try {
      const snapshot = await get(ref(this.database, `redeemCodes/${codeStr}`));
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      if (data?.donationId) {
        await remove(ref(this.database, `donations/${data.donationId}`));
      }

      await remove(ref(this.database, `redeemCodes/${codeStr}`));
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถลบโค้ดได้', 'delete');
    }
  }

  async updateCode(oldCode: string, newCode: string, newAmount: number, newDonatedAt?: string): Promise<void> {
    const oldCodeStr = oldCode.trim();
    const newCodeStr = newCode.trim();
    if (!oldCodeStr || !newCodeStr) throw new RepositoryError('กรุณากรอกโค้ด', 'update');
    if (newAmount < 0) throw new RepositoryError('จำนวนเงินต้องไม่ติดลบ', 'update');

    try {
      const snapshot = await get(ref(this.database, `redeemCodes/${oldCodeStr}`));
      if (!snapshot.exists()) {
        throw new RepositoryError('ไม่พบโค้ดนี้ในระบบ', 'update');
      }

      const data = snapshot.val();
      
      if (oldCodeStr !== newCodeStr) {
        const newCodeSnapshot = await get(ref(this.database, `redeemCodes/${newCodeStr}`));
        if (newCodeSnapshot.exists()) {
          throw new RepositoryError(`โค้ด ${newCodeStr} มีอยู่ในระบบแล้ว`, 'update');
        }
      }

      const updates: any = {};

      if (oldCodeStr !== newCodeStr) {
        const newData = { ...data };
        newData.amount = newAmount;
        if (newDonatedAt) {
          newData.donatedAt = newDonatedAt;
        } else {
          delete newData.donatedAt;
        }
        updates[`redeemCodes/${newCodeStr}`] = newData;
        updates[`redeemCodes/${oldCodeStr}`] = null;
      } else {
        updates[`redeemCodes/${oldCodeStr}/amount`] = newAmount;
        if (newDonatedAt) {
          updates[`redeemCodes/${oldCodeStr}/donatedAt`] = newDonatedAt;
        } else if (data.donatedAt) {
          updates[`redeemCodes/${oldCodeStr}/donatedAt`] = null;
        }
      }

      if (data.donationId) {
        if (newAmount > 0) {
          updates[`donations/${data.donationId}/amount`] = newAmount;
          if (newDonatedAt) {
            updates[`donations/${data.donationId}/donatedAt`] = newDonatedAt;
          } else if (data.donatedAt) {
            updates[`donations/${data.donationId}/donatedAt`] = data.createdAt;
          }
        } else {
          updates[`donations/${data.donationId}`] = null;
          if (oldCodeStr === newCodeStr) {
            updates[`redeemCodes/${oldCodeStr}/donationId`] = null;
          } else {
            delete updates[`redeemCodes/${newCodeStr}`].donationId;
          }
        }
      } else if (newAmount > 0) {
        const donationId = 'don_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        if (oldCodeStr === newCodeStr) {
          updates[`redeemCodes/${oldCodeStr}/donationId`] = donationId;
        } else {
          updates[`redeemCodes/${newCodeStr}/donationId`] = donationId;
        }
        updates[`donations/${donationId}`] = { amount: newAmount, donatedAt: newDonatedAt || data.createdAt };
      }

      await update(ref(this.database), updates);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถแก้ไขโค้ดได้', 'update');
    }
  }

  async getRecentCodes(limit = 100): Promise<RedeemCode[]> {
    try {
      const q = query(ref(this.database, 'redeemCodes'), orderByChild('createdAt'), limitToLast(limit));
      const snapshot = await get(q);
      const items: RedeemCode[] = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key!, ...child.val() });
      });
      return items.reverse(); // Newest first
    } catch {
      throw new RepositoryError('ไม่สามารถดึงข้อมูลโค้ดได้', 'read');
    }
  }
}
