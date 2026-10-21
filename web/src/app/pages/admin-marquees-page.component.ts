import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarqueeItem } from '../models/marquee.models';
import { MarqueeRepository } from '../repositories/marquee.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { AdminMasterPageComponent } from './admin-master-page.component';

@Component({
  selector: 'app-admin-marquees-page',
  standalone: true,
  imports: [AsyncPipe, FormsModule, AdminMasterPageComponent],
  templateUrl: './admin-marquees-page.component.html',
  styleUrl: './admin-marquees-page.component.css'
})
export class AdminMarqueesPageComponent {
  private readonly repo = inject(MarqueeRepository);
  private readonly status = inject(StatusMessageService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly items = this.repo.watchDirectAll();
  protected open = false;
  protected id: string | null = null;
  protected text = '';
  protected isActive = true;
  protected saving = false;

  protected add(): void {
    this.id = null;
    this.text = '';
    this.isActive = true;
    this.open = true;
  }

  protected edit(item: MarqueeItem): void {
    this.id = item.id;
    this.text = item.text;
    this.isActive = item.isActive;
    this.open = true;
  }

  protected close(): void {
    if (!this.saving) {
      this.open = false;
    }
  }

  protected async save(): Promise<void> {
    if (this.saving) return;
    const trimmed = this.text.trim();
    if (!trimmed) {
      this.status.show('กรุณากรอกข้อความ Marquee', 'error');
      return;
    }

    this.saving = true;
    this.status.show('กำลังบันทึกข้อความ Marquee...');
    try {
      const editing = !!this.id;
      if (this.id) {
        await this.repo.update(this.id, trimmed, this.isActive);
      } else {
        await this.repo.create(trimmed, this.isActive);
      }
      this.open = false;
      this.status.show(editing ? 'แก้ไขข้อความ Marquee สำเร็จ' : 'เพิ่มข้อความ Marquee สำเร็จ', 'success');
    } catch (e) {
      this.status.show(e instanceof Error ? e.message : 'ไม่สามารถบันทึกข้อความ Marquee ได้', 'error');
    } finally {
      this.saving = false;
    }
  }

  protected async remove(item: MarqueeItem): Promise<void> {
    if (this.saving || !window.confirm(`ยืนยันการลบข้อความ "${item.text}" หรือไม่?`)) return;
    this.saving = true;
    this.status.show('กำลังลบข้อความ Marquee...');
    try {
      await this.repo.delete(item.id);
      this.status.show('ลบข้อความ Marquee สำเร็จ', 'success');
    } catch (e) {
      this.status.show(e instanceof Error ? e.message : 'ไม่สามารถลบข้อความ Marquee ได้', 'error');
    } finally {
      this.saving = false;
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
