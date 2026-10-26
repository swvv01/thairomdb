import { Injectable, inject } from '@angular/core';
import { Database, get, ref, update, query, orderByChild } from '@angular/fire/database';
import { Donation } from '../models/donation.models';
import { RepositoryError } from './repository-error';

@Injectable({ providedIn: 'root' })
export class DonationRepository {
  private readonly database = inject(Database);

  async getAllDonations(): Promise<Donation[]> {
    try {
      const q = query(ref(this.database, 'donations'), orderByChild('donatedAt'));
      const snapshot = await get(q);
      const items: Donation[] = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key!, ...child.val() });
      });
      return items.reverse(); // Newest first
    } catch {
      throw new RepositoryError('ไม่สามารถดึงข้อมูลการบริจาคได้', 'read');
    }
  }

  async updateDonorProfile(donationId: string, donorName: string, imageUrl: string, uid: string, isAdmin = false): Promise<void> {
    if (!donationId) throw new RepositoryError('ไม่พบรหัสการบริจาค', 'update');
    const name = donorName.trim();
    if (!name) throw new RepositoryError('กรุณากรอกชื่อผู้บริจาค', 'update');
    if (name.length > 400) throw new RepositoryError('ชื่อผู้บริจาคต้องไม่เกิน 400 ตัวอักษร', 'update');

    try {
      const donRef = ref(this.database, `donations/${donationId}`);
      const snapshot = await get(donRef);
      if (!snapshot.exists()) {
        throw new RepositoryError('ไม่พบข้อมูลการบริจาคนี้ในระบบ', 'update');
      }

      const data = snapshot.val();
      if (data.redeemedBy && data.redeemedBy !== uid) {
        throw new RepositoryError('คุณไม่มีสิทธิ์แก้ไขข้อมูลการ์ดนี้', 'update');
      }

      const updates: Partial<Donation> = {
        amount: data.amount,
        donatedAt: data.donatedAt,
        redeemedBy: data.redeemedBy || uid,
        donorName: name,
        isCustomized: true,
        customizedAt: new Date().toISOString()
      };

      if (imageUrl && imageUrl.trim()) {
        updates.imageUrl = imageUrl.trim();
      }

      await update(donRef, updates);
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถบันทึกข้อมูลผู้บริจาคได้', 'update');
    }
  }
}
