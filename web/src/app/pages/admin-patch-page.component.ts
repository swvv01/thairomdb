import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatorRepository } from '../repositories/translator.repository';
import { TagRepository } from '../repositories/tag.repository';
import { removeFacebookReference } from '../shared/url.util';
import { SystemMaster, SystemRepository } from '../repositories/system.repository';
import { CoverInputComponent } from '../components/cover-input.component';
import { PatchRepository } from '../repositories/patch.repository';
import { CoverStorageService } from '../services/cover-storage.service';
import { StatusMessageService } from '../shared/status-message.service';
import { Tag, Translator } from '../models/patch.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmDialogComponent } from '../components/confirm-dialog.component';
import { AuthService } from '../services/auth.service';

const compareDropdownLabels = (a: { shortName: string; name: string }, b: { shortName: string; name: string }): number =>
  a.shortName.localeCompare(b.shortName, 'th', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
const defaultDocumentTitle = 'เกมแปลไทย เกมย้อนยุค ROM Hack และปกเกม | THAI ROM DB';

@Component({
  selector: 'app-admin-patch-page', styleUrl: './admin-patch-page.component.css',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, CoverInputComponent, ConfirmDialogComponent],
  templateUrl: './admin-patch-page.component.html'
})
export class AdminPatchPageComponent {
  @ViewChild(CoverInputComponent) private coverInput?: CoverInputComponent;
  @ViewChild('tagInput') private tagInput?: ElementRef<HTMLInputElement>;
  @ViewChild('playTimeInput') private playTimeInput?: ElementRef<HTMLInputElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translatorRepository = inject(TranslatorRepository);
  private readonly patchRepository = inject(PatchRepository);
  private readonly coverStorage = inject(CoverStorageService);
  private readonly status = inject(StatusMessageService);
  private readonly tagRepository = inject(TagRepository);
  private readonly systemRepository = inject(SystemRepository);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  private async isNotAdmin(): Promise<boolean> {
    return !this.auth.isAdmin() && !(await this.auth.waitForAdminCheck(1500));
  }
  protected readonly translators = this.translatorRepository.watchAll();
  protected readonly tags = this.tagRepository.watchAll();
  protected readonly systems = this.systemRepository.watchAll();
  protected systemOptions: SystemMaster[] = [];
  protected systemSearchText = '';
  protected systemAutocompleteOpen = false;
  protected readonly form = this.fb.nonNullable.group({ updateDate: [this.todayInputDate(), Validators.required], haveUpdateFlag: [false], patchVersion: [''], playTime: [null as number | null, [Validators.min(0)]], playTimeFull: [null as number | null, [Validators.min(0)]], gameTitle: ['', Validators.required], system: ['', Validators.required], translatorId: ['', Validators.required], patchTool: [''], patchFileUrl: [''], patchedRomUrl: [''], referenceText: [''], referenceUrl: [''], walkthroughUrl: [''] });
  protected cover?: Blob;
  protected saving = false;
  protected readonly showFloatingSave = signal(true);
  protected readonly isOffline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  protected readonly hasBottomBanner = computed(() => this.isOffline() || !!(typeof this.status.message === 'function' ? this.status.message() : false));
  protected pastingField: string | null = null;
  protected deleteConfirmOpen = false;
  protected editId: string | null = null;
  private existingCoverUrl = '';
  protected newTranslatorName = '';
  protected newTranslatorShortName = '';
  protected newTranslatorLink = '';
  protected newTranslatorModTool = '';
  protected translatorDialogOpen = false;
  protected selectedTags: string[] = [];
  protected newTagName = '';
  protected tagSuggestions: Tag[] = [];
  protected tagAutocompleteOpen = false;
  protected translatorSearchText = '';
  protected translatorAutocompleteOpen = false;
  protected newSystemName = '';
  protected newSystemShortName = '';
  protected systemDialogOpen = false;
  protected savingTranslator = false;
  protected savingSystem = false;
  protected loadingData = false;
  private editLoadRequest = 0;
  private saveRequestId = 0;
  private skipDeactivateConfirm = false;

  canDeactivate(): boolean {
    if (this.skipDeactivateConfirm) return true;
    return window.confirm('ต้องการออกจากหน้านี้หรือไม่? ข้อมูลที่ยังไม่ได้บันทึกจะหายไป');
  }
  constructor() {
    this.initializeFilenameGeneration();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (!id) this.skipDeactivateConfirm = false;
      void this.loadEditRecord(id);
    });
  }



  protected translatorOptions: Translator[] = [];

  private initializeFilenameGeneration(): void {
    this.translators.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (translators) => {
        this.translatorOptions = [...translators].sort(compareDropdownLabels);
        const selected = this.translatorOptions.find((item) => item.id === this.form.controls.translatorId.value);
        if (selected) this.translatorSearchText = this.translatorLabel(selected);
      }
    });
    this.systems.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((systems) => {
      this.systemOptions = [...systems].sort(compareDropdownLabels);
      const selected = this.systemOptions.find((item) => item.shortName === this.form.controls.system.value);
      if (selected) this.systemSearchText = this.systemLabel(selected);
    });
    this.form.controls.gameTitle.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((gameTitle) => {
      const normalizedTitle = this.normalizeGameTitle(gameTitle);
      if (normalizedTitle !== gameTitle) this.form.controls.gameTitle.setValue(normalizedTitle, { emitEvent: false });
    });
    this.form.controls.translatorId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((translatorId) => {
      const translator = this.translatorOptions.find((item) => item.id === translatorId);
      if (translator) {
        this.translatorSearchText = this.translatorLabel(translator);
        this.form.controls.patchTool.setValue(translator.modTool ?? '');
      } else if (!translatorId) {
        this.translatorSearchText = '';
        this.form.controls.patchTool.setValue('');
      }
    });
    this.tags.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tags) => {
      this.tagSuggestions = tags;
      this.selectedTags = this.selectedTags.filter((id) => tags.some((tag) => tag.id === id));
    });
  }

  private normalizeGameTitle(value: string): string { return value.replace(/é/g, 'e'); }
  protected systemLabel(system: SystemMaster): string { return `${system.shortName} — ${system.name}`; }
  protected filteredSystemOptions(): SystemMaster[] {
    const query = this.systemSearchText.trim().toLocaleLowerCase();
    if (!query) return this.systemOptions;
    return this.systemOptions.filter((system) =>
      `${system.shortName} ${system.name}`.toLocaleLowerCase().includes(query));
  }
  protected openSystemAutocomplete(event: FocusEvent): void {
    this.systemAutocompleteOpen = true;
    (event.target as HTMLInputElement).select();
  }
  protected onSystemInput(value: string): void {
    this.systemSearchText = value;
    this.systemAutocompleteOpen = true;
    if (!this.systemOptions.some((system) => system.shortName === this.form.controls.system.value && this.systemLabel(system) === value)) {
      this.form.controls.system.setValue('', { emitEvent: false });
    }
  }
  protected selectSystem(system: SystemMaster): void {
    this.systemSearchText = this.systemLabel(system);
    this.systemAutocompleteOpen = false;
    this.form.controls.system.setValue(system.shortName);
  }
  protected translatorLabel(translator: Translator): string { return `${translator.shortName} — ${translator.name}`; }
  protected filteredTranslatorOptions(): Translator[] {
    const query = this.translatorSearchText.trim().toLocaleLowerCase();
    if (!query) return this.translatorOptions;
    return this.translatorOptions.filter((translator) =>
      `${translator.shortName} ${translator.name}`.toLocaleLowerCase().includes(query));
  }
  protected openTranslatorAutocomplete(event: FocusEvent): void {
    this.translatorAutocompleteOpen = true;
    (event.target as HTMLInputElement).select();
  }
  protected onTranslatorInput(value: string): void {
    this.translatorSearchText = value;
    this.translatorAutocompleteOpen = true;
    if (!this.translatorOptions.some((translator) => this.form.controls.translatorId.value === translator.id && this.translatorLabel(translator) === value)) {
      this.form.controls.translatorId.setValue('', { emitEvent: false });
      this.form.controls.patchTool.setValue('');
    }
  }
  protected selectTranslator(translator: Translator): void {
    this.translatorSearchText = this.translatorLabel(translator);
    this.translatorAutocompleteOpen = false;
    this.form.controls.translatorId.setValue(translator.id);
  }

  protected cancelSave(): void {
    this.saveRequestId++;
    this.saving = false;
    this.status.clear();
  }

  protected async save(): Promise<void> {
    if (this.saving) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.status.show('กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'error'); return; }
    const requestId = ++this.saveRequestId;
    this.saving = true;
    if (await this.isNotAdmin()) {
      if (requestId === this.saveRequestId) {
        this.saving = false;
        this.status.show('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถบันทึกแพตช์ได้', 'error');
      }
      return;
    }
    if (requestId !== this.saveRequestId) return;
    this.status.show('กำลังบันทึกแพตช์…');
    try {
      const value = this.form.getRawValue();
      const draft = {
        ...value,
        playTime: value.playTime != null && (value.playTime as unknown) !== '' && !Number.isNaN(Number(value.playTime)) && Number(value.playTime) >= 0 ? Number(value.playTime) : null,
        playTimeFull: value.playTimeFull != null && (value.playTimeFull as unknown) !== '' && !Number.isNaN(Number(value.playTimeFull)) && Number(value.playTimeFull) >= 0 ? Number(value.playTimeFull) : null,
        gameTitle: this.normalizeGameTitle(value.gameTitle.trim()),
        updateDate: this.toIsoDate(value.updateDate),
        patchTool: removeFacebookReference(value.patchTool),
        patchFileUrl: removeFacebookReference(value.patchFileUrl),
        patchedRomUrl: removeFacebookReference(value.patchedRomUrl),
        referenceUrl: removeFacebookReference(value.referenceUrl),
        walkthroughUrl: removeFacebookReference(value.walkthroughUrl),
        tags: this.selectedTags
      };
      let coverUrl = '';
      const patchId = this.editId ?? crypto.randomUUID();
      if (this.cover) {
        coverUrl = await this.coverStorage.upload(patchId, this.cover, `cover_max250px_${Date.now()}.png`);
        if (requestId !== this.saveRequestId) return;
      }
      if (this.editId) {
        await this.patchRepository.update(this.editId, draft, this.cover ? coverUrl : undefined);
        if (requestId !== this.saveRequestId) return;
        if (this.cover && this.existingCoverUrl && this.existingCoverUrl !== coverUrl) {
          // Removing an old cover is cleanup only. It must never turn a
          // successful patch save into a failure (especially for migrated
          // covers that belong to the former Firebase project).
          void this.coverStorage.remove(this.existingCoverUrl).catch(() => undefined);
        }
      }
      else {
        await this.patchRepository.create(draft, coverUrl, patchId);
        if (requestId !== this.saveRequestId) return;
      }
      this.status.show('บันทึกแพตช์สำเร็จ', 'success');
      const translatorModTool = this.translatorOptions.find((item) => item.id === value.translatorId)?.modTool ?? '';
      this.form.reset({
        updateDate: this.todayInputDate(),
        haveUpdateFlag: false,
        patchVersion: '',
        playTime: null,
        playTimeFull: null,
        gameTitle: '',
        system: value.system,
        translatorId: value.translatorId,
        patchTool: translatorModTool,
        patchFileUrl: '',
        patchedRomUrl: '',
        referenceText: '',
        referenceUrl: '',
        walkthroughUrl: ''
      });
      this.selectedTags = []; this.cover = undefined; this.coverInput?.clear();
      if (this.editId) {
        this.editId = null;
        this.skipDeactivateConfirm = true;
        window.close();
        if (!window.closed) void this.router.navigateByUrl('/add', { replaceUrl: true });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (requestId !== this.saveRequestId) return;
      this.status.show(error instanceof Error ? error.message : 'ไม่สามารถบันทึกแพตช์ได้', 'error');
    } finally {
      if (requestId === this.saveRequestId) {
        this.saving = false;
      }
    }
  }

  protected async pasteTo(field: 'gameTitle' | 'patchTool' | 'patchFileUrl' | 'patchedRomUrl' | 'referenceUrl' | 'walkthroughUrl'): Promise<void> {
    if (this.pastingField) return;
    this.pastingField = field;
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) this.form.controls[field].setValue(text);
    } catch {
      // Clipboard access can be denied by the browser; leave the current value unchanged.
    } finally {
      this.pastingField = null;
    }
  }

  protected syncPlayTimeFullFromPlayTime(): void {
    const playTimeValue = this.form.controls.playTime.value;
    this.form.controls.playTimeFull.setValue(playTimeValue ?? null);
  }

  protected openHowLongToBeat(): void {
    const rawTitle = this.form.controls.gameTitle.value;
    const title = rawTitle.replace(/[:-]/g, ' ').replace(/\s+/g, ' ').trim();
    const query = encodeURIComponent(encodeURIComponent(title));
    const url = title ? `https://howlongtobeat.com/?q=${query}` : 'https://howlongtobeat.com';
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected async deletePatch(): Promise<void> {
    if (!this.editId || this.saving) return;
    if (await this.isNotAdmin()) {
      this.status.show('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบแพตช์ได้', 'error');
      return;
    }
    this.deleteConfirmOpen = true;
  }

  protected cancelDelete(): void { this.deleteConfirmOpen = false; }

  protected async confirmDelete(): Promise<void> {
    if (!this.editId || this.saving) return;
    this.deleteConfirmOpen = false;
    this.saving = true;
    this.status.show('กำลังลบแพตช์…');
    try {
      await this.patchRepository.delete(this.editId);
      this.status.show('ลบแพตช์สำเร็จ', 'success');
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (error) {
      this.status.show(error instanceof Error ? error.message : 'ไม่สามารถลบแพตช์ได้', 'error');
    } finally {
      this.saving = false;
    }
  }

  private async loadEditRecord(id: string | null): Promise<void> {
    const request = ++this.editLoadRequest;
    this.editId = id;
    document.title = defaultDocumentTitle;
    this.existingCoverUrl = '';
    this.cover = undefined;
    this.coverInput?.clear();
    this.selectedTags = [];
    this.systemSearchText = '';
    this.translatorSearchText = '';
    this.form.reset({
      updateDate: this.todayInputDate(),
      haveUpdateFlag: false,
      patchVersion: '',
      playTime: null,
      playTimeFull: null,
      gameTitle: '',
      system: '',
      translatorId: '',
      patchTool: '',
      patchFileUrl: '',
      patchedRomUrl: '',
      referenceText: '',
      referenceUrl: '',
      walkthroughUrl: ''
    });
    if (!id) return;
    this.loadingData = true;
    let shouldScrollToPlayTime = false;
    try {
      const patch = await this.patchRepository.getById(id);
      if (request !== this.editLoadRequest) return;
      if (!patch) { this.status.show('ไม่พบแพตช์ที่ต้องการแก้ไข', 'error'); return; }
      this.editId = id;
      document.title = `${patch.gameTitle} | THAI ROM DB`;
      this.existingCoverUrl = patch.coverUrl ?? '';
      this.form.patchValue({ updateDate: this.toInputDate(patch.updateDate), haveUpdateFlag: patch.haveUpdateFlag === true, patchVersion: patch.patchVersion ?? '', playTime: patch.playTime ?? null, playTimeFull: patch.playTimeFull ?? null, gameTitle: patch.gameTitle, system: patch.system, translatorId: patch.translatorId, patchTool: patch.patchTool, patchFileUrl: patch.patchFileUrl, patchedRomUrl: patch.patchedRomUrl ?? '', referenceText: patch.referenceText ?? '', referenceUrl: patch.referenceUrl ?? '', walkthroughUrl: patch.walkthroughUrl ?? '' }, { emitEvent: false });
      const selectedTranslator = this.translatorOptions.find((item) => item.id === patch.translatorId);
      if (selectedTranslator) this.translatorSearchText = this.translatorLabel(selectedTranslator);
      const selectedSystem = this.systemOptions.find((item) => item.shortName === patch.system);
      if (selectedSystem) this.systemSearchText = this.systemLabel(selectedSystem);
      const patchTags = Array.isArray(patch.tags) ? patch.tags : [];
      this.selectedTags = patchTags.filter((tagId) => this.tagSuggestions.some((tag) => tag.id === tagId));
      if (patch.playTime == null || (patch.playTime as unknown) === '' || Number(patch.playTime) < 0) {
        shouldScrollToPlayTime = true;
      }
    } finally {
      if (request === this.editLoadRequest) {
        this.loadingData = false;
        this.cdr.detectChanges();
        if (shouldScrollToPlayTime) {
          this.scrollToPlayTime();
        }
      }
    }
  }

  private scrollToPlayTime(): void {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const inputEl = this.playTimeInput?.nativeElement ?? document.querySelector<HTMLInputElement>('input[formControlName="playTime"]');
        if (inputEl) {
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputEl.focus({ preventScroll: true });
        }
      }, 150);
    });
  }
  private todayInputDate(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  private toInputDate(value: string): string {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return this.todayInputDate();
    const date = new Date(timestamp);
    const pad = (part: number): string => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  private toIsoDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('กรุณาระบุวันที่อัปเดตให้ถูกต้อง');
    return date.toISOString();
  }
  protected setUpdateDateNow(): void { this.form.controls.updateDate.setValue(this.todayInputDate()); }
  protected setDefaultPatchTool(): void {
    const translator = this.translatorOptions.find((item) => item.id === this.form.controls.translatorId.value);
    this.form.controls.patchTool.setValue(translator?.modTool ?? '');
  }
  protected setRomPatcherTool(): void {
    this.form.controls.patchTool.setValue('https://www.marcrobledo.com/RomPatcher.js');
  }
  protected tagName(id: string): string { return this.tagSuggestions.find((tag) => tag.id === id)?.name ?? ''; }
  protected toggleTag(id: string): void { this.selectedTags = this.selectedTags.includes(id) ? this.selectedTags.filter((tag) => tag !== id) : [...this.selectedTags, id]; }
  protected filteredTagSuggestions(): Tag[] {
    const query = this.newTagName.trim().toLocaleLowerCase();
    return this.tagSuggestions
      .filter((tag) => !this.selectedTags.includes(tag.id))
      .filter((tag) => !query || tag.name.toLocaleLowerCase().includes(query))
      .slice(0, 8);
  }
  protected selectTag(tag: Tag): void {
    if (!this.selectedTags.includes(tag.id)) this.selectedTags = [...this.selectedTags, tag.id];
    this.newTagName = '';
    this.tagAutocompleteOpen = false;
    queueMicrotask(() => this.tagInput?.nativeElement.focus());
  }
  protected removeTag(id: string): void { this.selectedTags = this.selectedTags.filter((tag) => tag !== id); }
  protected onTagInput(value: string): void { this.newTagName = value; this.tagAutocompleteOpen = true; }
  protected openTagAutocomplete(): void { this.tagAutocompleteOpen = true; }
  @HostListener('document:click')
  protected closeTagAutocomplete(): void {
    this.tagAutocompleteOpen = false;
    this.translatorAutocompleteOpen = false;
    this.systemAutocompleteOpen = false;
  }
  @HostListener('window:online')
  protected onOnline(): void {
    this.isOffline.set(false);
  }
  @HostListener('window:offline')
  protected onOffline(): void {
    this.isOffline.set(true);
  }
  protected async createTag(): Promise<void> {
    const name = this.newTagName.trim();
    if (!name) return;
    const existing = this.tagSuggestions.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) { this.selectTag(existing); return; }
    if (await this.isNotAdmin()) {
      this.status.show('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเพิ่ม tag ได้', 'error');
      return;
    }
    try {
      const tag = await this.tagRepository.create(name);
      this.selectTag(tag);
    } catch (error) {
      this.status.show(error instanceof Error ? error.message : 'ไม่สามารถเพิ่ม tag ได้', 'error');
    }
  }
  protected async createTranslator(): Promise<void> {
    if (this.savingTranslator) return;
    try {
      const name = this.newTranslatorName.trim();
      if (!name || !this.newTranslatorShortName.trim()) { this.status.show('กรุณาระบุชื่อย่อและชื่อเต็มของทีมแปล', 'error'); return; }
      if (await this.isNotAdmin()) {
        this.status.show('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเพิ่มทีมแปลได้', 'error');
        return;
      }
      this.savingTranslator = true;
      this.status.show('กำลังบันทึกทีมแปล…');
      const translator = await this.translatorRepository.create(this.newTranslatorShortName, name, removeFacebookReference(this.newTranslatorLink), this.newTranslatorModTool);
      this.translatorOptions = [...this.translatorOptions.filter((item) => item.id !== translator.id), translator].sort(compareDropdownLabels);
      this.form.controls.translatorId.setValue(translator.id);
      if (!this.editId) this.form.controls.patchTool.setValue(translator.modTool ?? '');
      this.newTranslatorName = '';
      this.newTranslatorShortName = '';
      this.newTranslatorLink = '';
      this.newTranslatorModTool = '';
      this.translatorDialogOpen = false;
      this.status.show('เพิ่มทีมแปลสำเร็จ', 'success');
    } catch (error) {
      this.status.show(error instanceof Error ? error.message : 'ไม่สามารถเพิ่มทีมแปลได้', 'error');
    } finally {
      this.savingTranslator = false;
    }
  }
  protected openTranslatorDialog(): void { this.translatorDialogOpen = true; }
  protected closeTranslatorDialog(): void { this.translatorDialogOpen = false; }
  protected async createSystem(): Promise<void> {
    if (this.savingSystem) return;
    try {
      if (await this.isNotAdmin()) {
        this.status.show('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเพิ่มเครื่องเกมได้', 'error');
        return;
      }
      this.savingSystem = true;
      this.status.show('กำลังบันทึกเครื่องเกม…');
      const system = await this.systemRepository.create(this.newSystemShortName, this.newSystemName);
      this.form.controls.system.setValue(system.shortName);
      this.systemSearchText = this.systemLabel(system);
      this.newSystemName = '';
      this.newSystemShortName = '';
      this.systemDialogOpen = false;
      this.status.show('เพิ่มเครื่องเกมสำเร็จ', 'success');
    } catch (error) {
      this.status.show(error instanceof Error ? error.message : 'ไม่สามารถเพิ่มเครื่องเกมได้', 'error');
    } finally {
      this.savingSystem = false;
    }
  }

  protected openSystemDialog(): void { this.systemDialogOpen = true; }
  protected closeSystemDialog(): void { this.systemDialogOpen = false; }

}
