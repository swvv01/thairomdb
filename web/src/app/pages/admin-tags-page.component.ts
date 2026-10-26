import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { TagRepository } from '../repositories/tag.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { Tag } from '../models/patch.models';
import { AdminMasterPageComponent } from './admin-master-page.component';
import { showEdgeSyncFeedback } from '../shared/edge-sync-feedback.util';

@Component({ selector: 'app-admin-tags-page', standalone: true, imports: [AsyncPipe, FormsModule, AdminMasterPageComponent], templateUrl: './admin-tags-page.component.html' })
export class AdminTagsPageComponent {
  private readonly repo = inject(TagRepository); private readonly status = inject(StatusMessageService); private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly route = inject(ActivatedRoute); private readonly destroyRef = inject(DestroyRef); private appliedQueryId: string | null = null;
  protected readonly items = this.repo.watchDirectAll(); protected open = false; protected id: string | null = null; protected name = ''; protected slug = ''; protected saving = false;
  constructor() { this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => { const queryId = params.get('edit'); if (!queryId || queryId === this.appliedQueryId) return; this.items.pipe(take(1)).subscribe((items) => { const tag = items.find((item) => item.id === queryId); if (tag) { this.appliedQueryId = queryId; this.edit(tag); } }); }); }
  private clearEditQuery(): void { if (this.route.snapshot.queryParamMap.has('edit')) void this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true }); }
  protected add(): void { this.clearEditQuery(); this.id = null; this.name = ''; this.slug = ''; this.open = true; }
  protected edit(x: Tag): void { this.id = x.id; this.name = x.name; this.slug = x.slug; this.open = true; }
  protected syncDefaultSlug(name: string): void { if (!this.id && !this.slug) this.slug = name; }
  protected close(): void { if (!this.saving) { this.open = false; this.clearEditQuery(); } }
  protected async save(): Promise<void> { if (this.saving) return; if (!this.name.trim()) { this.status.show('กรุณาระบุชื่อหมวดหมู่', 'error'); return; } if (!this.slug.trim()) this.slug = this.name; this.saving = true; this.status.show('กำลังบันทึก tag...'); try { const editing = !!this.id; const result = this.id ? await this.repo.update(this.id, this.name, this.slug) : await this.repo.create(this.name, this.slug); this.open = false; this.clearEditQuery(); showEdgeSyncFeedback(this.status, editing ? 'แก้ไขหมวดหมู่สำเร็จ' : 'เพิ่มหมวดหมู่สำเร็จ', result.edgeSynced); } catch (e) { this.status.show(e instanceof Error ? e.message : 'ไม่สามารถบันทึกหมวดหมู่ได้', 'error'); } finally { this.saving = false; } }
  protected async remove(x: Tag): Promise<void> { if (this.saving || !window.confirm(`ยืนยันการลบ ${x.name} หรือไม่?`)) return; this.saving = true; this.status.show('กำลังลบ tag...'); try { const result = await this.repo.delete(x.id); showEdgeSyncFeedback(this.status, 'ลบหมวดหมู่สำเร็จ', result.edgeSynced); } catch (e) { this.status.show(e instanceof Error ? e.message : 'ไม่สามารถลบหมวดหมู่ได้', 'error'); } finally { this.saving = false; } }
  protected async signOut(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/', { replaceUrl: true }); }
}
