import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, map, take } from 'rxjs';
import { TranslatorRepository } from '../repositories/translator.repository';
import { PatchRepository } from '../repositories/patch.repository';
import { Translator } from '../models/patch.models';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { removeFacebookReference } from '../shared/url.util';
import { AdminMasterPageComponent } from './admin-master-page.component';
import { showEdgeSyncFeedback } from '../shared/edge-sync-feedback.util';

@Component({
  selector: 'app-admin-translators-page',
  standalone: true,
  imports: [AsyncPipe, FormsModule, AdminMasterPageComponent],
  templateUrl: './admin-translators-page.component.html',
  styleUrl: './admin-translators-page.component.css'
})
export class AdminTranslatorsPageComponent {
  private readonly repo = inject(TranslatorRepository);
  private readonly patchRepo = inject(PatchRepository);
  private readonly status = inject(StatusMessageService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private appliedQueryId: string | null = null;

  protected readonly items = this.repo.watchDirectAll().pipe(
    map((items) =>
      [...items].sort(
        (a, b) =>
          a.shortName.localeCompare(b.shortName, 'th', { sensitivity: 'base' }) ||
          a.name.localeCompare(b.name, 'th', { sensitivity: 'base' })
      )
    )
  );

  protected open = false;
  protected saving = false;
  protected syncingPatchTool = false;
  protected id: string | null = null;
  protected shortName = '';
  protected name = '';
  protected modTool = '';
  protected link = '';

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const queryId = params.get('edit');
      if (!queryId || queryId === this.appliedQueryId) return;
      this.items.pipe(take(1)).subscribe((items) => {
        const translator = items.find((item) => item.id === queryId);
        if (translator) {
          this.appliedQueryId = queryId;
          this.edit(translator);
        }
      });
    });
  }

  private clearEditQuery(): void {
    if (this.route.snapshot.queryParamMap.has('edit')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { edit: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  protected add(): void {
    this.clearEditQuery();
    this.id = null;
    this.shortName = '';
    this.name = '';
    this.modTool = '';
    this.link = '';
    this.open = true;
  }

  protected edit(x: Translator): void {
    this.id = x.id;
    this.shortName = x.shortName;
    this.name = x.name;
    this.modTool = x.modTool ?? '';
    this.link = x.link ?? '';
    this.open = true;
  }

  protected close(): void {
    this.open = false;
    this.clearEditQuery();
  }

  protected async save(): Promise<void> {
    if (this.saving || this.syncingPatchTool) return;
    if (!this.shortName.trim() || !this.name.trim()) {
      this.status.show('กรุณาระบุชื่อย่อและชื่อเต็มของทีมแปล', 'error');
      return;
    }
    this.saving = true;
    this.status.show('กำลังบันทึกทีมแปล...');
    try {
      const editing = !!this.id;
      const link = removeFacebookReference(this.link);
      const modTool = removeFacebookReference(this.modTool);
      const result = this.id
        ? await this.repo.update(this.id, this.shortName, this.name, link, modTool)
        : await this.repo.create(this.shortName, this.name, link, modTool);
      this.close();
      showEdgeSyncFeedback(this.status, editing ? 'แก้ไขทีมแปลสำเร็จ' : 'เพิ่มทีมแปลสำเร็จ', result.edgeSynced);
    } catch (e) {
      this.status.show(e instanceof Error ? e.message : 'ไม่สามารถบันทึกทีมแปลได้', 'error');
    } finally {
      this.saving = false;
    }
  }

  protected async syncPatchToolToAllGames(): Promise<void> {
    if (this.saving || this.syncingPatchTool || !this.id) return;
    const targetTool = removeFacebookReference(this.modTool).trim();
    if (!targetTool) {
      this.status.show('กรุณาระบุ Mod tool ก่อนซิงค์', 'error');
      return;
    }

    this.syncingPatchTool = true;
    this.status.show('กำลังตรวจสอบข้อมูลเกม…');
    try {
      const patches = await firstValueFrom(this.patchRepo.watchAll());
      const matchingCount = patches.filter((p) => p.translatorId === this.id).length;

      if (matchingCount === 0) {
        this.status.show('ไม่พบเกมของทีมแปลนี้ในระบบ', 'info');
        return;
      }

      const teamDisplayName = `${this.shortName.trim() || 'ทีมแปล'} - ${this.name.trim() || ''}`.trim();
      const confirmed = window.confirm(
        `ยืนยันอัปเดต Patch Tool เป็น "${targetTool}" สำหรับทุกเกมของ ${teamDisplayName} (พบ ${matchingCount} เกม) หรือไม่?`
      );
      if (!confirmed) {
        this.status.clear();
        return;
      }

      this.status.show('กำลังซิงค์ Patch Tool ไปยังทุกเกม…');

      let edgeSyncedTranslator = true;
      if (this.shortName.trim() && this.name.trim()) {
        const link = removeFacebookReference(this.link);
        const updateResult = await this.repo.update(this.id, this.shortName, this.name, link, targetTool);
        edgeSyncedTranslator = updateResult?.edgeSynced ?? false;
      }

      const batchResult = await this.patchRepo.batchUpdatePatchToolByTranslator(this.id, targetTool);

      showEdgeSyncFeedback(
        this.status,
        `อัปเดต Patch Tool ทั้งหมด ${batchResult.count} เกมสำเร็จ`,
        edgeSyncedTranslator && batchResult.edgeSynced
      );
    } catch (e) {
      this.status.show(e instanceof Error ? e.message : 'ไม่สามารถอัปเดต Patch Tool ได้', 'error');
    } finally {
      this.syncingPatchTool = false;
    }
  }

  protected async remove(x: Translator): Promise<void> {
    if (this.saving || this.syncingPatchTool || !window.confirm(`ยืนยันการลบ ${x.shortName} — ${x.name} หรือไม่?`)) return;
    this.saving = true;
    this.status.show('กำลังลบทีมแปล...');
    try {
      const result = await this.repo.delete(x.id);
      showEdgeSyncFeedback(this.status, 'ลบทีมแปลสำเร็จ', result.edgeSynced);
    } catch (e) {
      this.status.show(e instanceof Error ? e.message : 'ไม่สามารถลบทีมแปลได้', 'error');
    } finally {
      this.saving = false;
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
