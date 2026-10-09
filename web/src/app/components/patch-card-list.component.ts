import { Component, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Patch, Tag, Translator } from '../models/patch.models';
import { browseRoute } from '../shared/browse-route.util';
import { SystemMaster } from '../repositories/system.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { GameLibraryService } from '../services/game-library.service';

@Component({
  selector: 'app-patch-card-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './patch-card-list.component.html',
  styleUrl: './patch-card-list.component.css'
})
export class PatchCardListComponent {
  private static readonly newGameWindowMs = 7 * 24 * 60 * 60 * 1000;
  private readonly status = inject(StatusMessageService);
  protected readonly libraryService = inject(GameLibraryService);
  @Input() patches: Patch[] = [];
  @Input() translators: Translator[] = [];
  @Input() systems: SystemMaster[] = [];
  @Input() tags: Tag[] = [];
  @Input() canEdit = false;
  protected readonly loadedImages = signal(new Set<string>());
  protected readonly downloadingPatchId = signal<string | null>(null);
  protected readonly togglingLibraryId = signal<string | null>(null);

  protected async toggleLibrary(patch: Patch): Promise<void> {
    if (this.togglingLibraryId() === patch.id) return;
    this.togglingLibraryId.set(patch.id);
    try {
      await this.libraryService.toggleLibrary(patch.id, patch.gameTitle);
    } finally {
      this.togglingLibraryId.set(null);
    }
  }
  protected translatorLink(patch: Patch): string | undefined {
    return this.translators.find((translator) => translator.id === patch.translatorId)?.link;
  }
  protected translatorTool(patch: Patch): string | undefined {
    return this.translators.find((translator) => translator.id === patch.translatorId)?.modTool;
  }
  protected translatorShortName(patch: Patch): string | undefined {
    return this.translators.find((translator) => translator.id === patch.translatorId)?.shortName;
  }
  protected translatorName(patch: Patch): string {
    return this.translators.find((translator) => translator.id === patch.translatorId)?.name ?? patch.translatedBy;
  }
  protected coverFilename(patch: Patch): string {
    const gameTitle = patch.gameTitle.trim().replace(/:/g, ' -').replace(/\s+/g, ' ');
    const shortName = this.translators.find((item) => item.id === patch.translatorId)?.shortName.trim().replace(/\s+/g, ' ');
    return `${shortName ? `${gameTitle} (Thai by ${shortName})` : gameTitle || 'cover'}.png`;
  }
  protected cardTags(patch: Patch): Tag[] {
    return patch.tags.map((id) => this.tags.find((tag) => tag.id === id)).filter((tag): tag is Tag => Boolean(tag));
  }
  protected browseRoute = browseRoute;
  protected systemName(shortName: string): string {
    return this.systems.find((system) => system.shortName === shortName)?.name ?? shortName;
  }
  protected hasTags(tags: string[]): boolean {
    return tags.some((tag) => tag.trim().length > 0);
  }
  protected hasDownloadLinks(patch: Patch): boolean {
    return Boolean(patch.coverUrl || patch.patchTool || patch.patchFileUrl || patch.referenceUrl || patch.walkthroughUrl || patch.patchedRomUrl);
  }
  protected formatUpdateDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }
  protected formatCardPlayTime(patch: Patch): string {
    if (patch.playTime === 0) {
      return 'ไม่มีข้อมูล';
    }
    const hasPlayTime = patch.playTime != null && patch.playTime > 0;
    const hasPlayTimeFull = patch.playTimeFull != null && patch.playTimeFull > 0;
    if (hasPlayTime && hasPlayTimeFull) {
      return `${patch.playTime} - ${patch.playTimeFull} ชั่วโมง`;
    }
    if (hasPlayTime) {
      return `${patch.playTime} ชั่วโมง`;
    }
    return `${patch.playTimeFull} ชั่วโมง`;
  }
  protected onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/images/no-image.jpg';
  }
  protected onImageLoad(patchId: string): void {
    this.loadedImages.update((loaded) => new Set(loaded).add(patchId));
  }
  protected imageUrl(patch: Patch): string {
    if (!patch.coverUrl) return 'assets/images/no-image.jpg';
    const version = encodeURIComponent(patch.updateDate || patch.id);
    return `${patch.coverUrl}${patch.coverUrl.includes('?') ? '&' : '?'}v=${version}`;
  }
  protected async downloadCover(event: Event, patch: Patch): Promise<void> {
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.button === 1) {
      return;
    }
    event.preventDefault();
    if (this.downloadingPatchId() === patch.id) return;
    this.downloadingPatchId.set(patch.id);

    this.status.show('กำลังดาวน์โหลดภาพปก…');
    try {
      const sep = patch.coverUrl.includes('?') ? '&' : '?';
      const downloadUrl = `${patch.coverUrl}${sep}download=1`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = this.coverFilename(patch);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      this.status.show('ดาวน์โหลดภาพปกสำเร็จ', 'success');
    } catch {
      window.open(patch.coverUrl, '_blank', 'noopener,noreferrer');
      this.status.show('ไม่สามารถดาวน์โหลดภาพปกโดยตรงได้ ระบบได้เปิดรูปในแท็บใหม่ให้แล้ว', 'error');
    } finally {
      this.downloadingPatchId.set(null);
    }
  }
  protected isNewGame(updateDate: string): boolean {
    const timestamp = Date.parse(updateDate);
    const now = Date.now();
    return !Number.isNaN(timestamp)
      && timestamp >= now - PatchCardListComponent.newGameWindowMs
      && timestamp <= now;
  }
}
