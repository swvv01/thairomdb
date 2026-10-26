import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { SystemMaster, SystemRepository } from '../repositories/system.repository';
import { AdminMasterPageComponent } from './admin-master-page.component';
import { showEdgeSyncFeedback } from '../shared/edge-sync-feedback.util';

@Component({
  selector: 'app-admin-systems-page', standalone: true,
  imports: [AsyncPipe, FormsModule, AdminMasterPageComponent],
  templateUrl: './admin-systems-page.component.html',
  styleUrl: './admin-systems-page.component.css'
})
export class AdminSystemsPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly repository = inject(SystemRepository);
  private readonly status = inject(StatusMessageService);
  protected readonly systems = this.repository.watchDirectAll().pipe(map((systems) => [...systems].sort((a, b) => a.shortName.localeCompare(b.shortName, 'th', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }))));
  protected dialogOpen = false;
  protected editingId: string | null = null;
  protected shortName = '';
  protected name = '';
  protected saving = false;

  protected openCreate(): void { this.editingId = null; this.shortName = ''; this.name = ''; this.dialogOpen = true; }
  protected openEdit(system: SystemMaster): void { this.editingId = system.id; this.shortName = system.shortName; this.name = system.name; this.dialogOpen = true; }
  protected closeDialog(): void { this.dialogOpen = false; }

  protected async save(): Promise<void> {
    if (this.saving) return;
    if (!this.shortName.trim() || !this.name.trim()) { this.status.show('กรุณาระบุชื่อย่อและชื่อเต็มของเครื่องเกม', 'error'); return; }
    const editing = !!this.editingId;
    this.saving = true;
    this.status.show('กำลังบันทึกเครื่องเกม…');
    try {
      const result = this.editingId
        ? await this.repository.update(this.editingId, this.shortName, this.name)
        : await this.repository.create(this.shortName, this.name);
      this.closeDialog();
      showEdgeSyncFeedback(this.status, editing ? 'แก้ไขเครื่องเกมสำเร็จ' : 'เพิ่มเครื่องเกมสำเร็จ', result.edgeSynced);
    } catch (error) { this.status.show(error instanceof Error ? error.message : 'ไม่สามารถบันทึกเครื่องเกมได้', 'error'); }
    finally { this.saving = false; }
  }

  protected async remove(system: SystemMaster): Promise<void> {
    if (this.saving) return;
    const confirmed = window.confirm(`ยืนยันการลบ ${system.shortName} — ${system.name} หรือไม่?\n\nคำเตือน: แพตช์เดิมที่อ้างอิงเครื่องเกมนี้อาจยังแสดงชื่อเดิม แต่จะไม่มีใน master แล้ว`);
    if (!confirmed) return;
    this.saving = true;
    this.status.show('กำลังลบเครื่องเกม…');
    try {
      const result = await this.repository.delete(system.id);
      showEdgeSyncFeedback(this.status, 'ลบเครื่องเกมสำเร็จ', result.edgeSynced);
    } catch (error) { this.status.show(error instanceof Error ? error.message : 'ไม่สามารถลบเครื่องเกมได้', 'error'); }
    finally { this.saving = false; }
  }

  protected async signOut(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/', { replaceUrl: true }); }
}
