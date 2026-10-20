import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Patch, Translator } from '../models/patch.models';
import { PatchRepository } from '../repositories/patch.repository';
import { TranslatorRepository } from '../repositories/translator.repository';
import { StatusMessageService } from '../shared/status-message.service';
import { AuthService } from '../services/auth.service';

interface TranslatorGroup {
  translatorName: string;
  games: Patch[];
}

function pad(num: number): string {
  return String(num).padStart(2, '0');
}

export function toLocalInputString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDisplayDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-admin-post-summary-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-post-summary-page.component.html',
  styleUrl: './admin-post-summary-page.component.css'
})
export class AdminPostSummaryPageComponent implements OnInit, OnDestroy {
  private readonly patchRepository = inject(PatchRepository);
  private readonly translatorRepository = inject(TranslatorRepository);
  private readonly statusMessageService = inject(StatusMessageService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  private readonly subscriptions = new Subscription();

  protected readonly patches = signal<Patch[]>([]);
  protected readonly translators = signal<Translator[]>([]);
  protected readonly loading = signal(true);
  protected readonly copied = signal(false);

  // Default: current time - 24 hours to current time
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');

  constructor() {
    this.resetToDefaultRange();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.patchRepository.watchAll().subscribe({
        next: (items) => {
          this.patches.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.statusMessageService.show('ไม่สามารถโหลดข้อมูลเกมได้', 'error');
          this.loading.set(false);
        }
      })
    );

    this.subscriptions.add(
      this.translatorRepository.watchAll().subscribe({
        next: (items) => {
          this.translators.set(items);
        },
        error: () => {
          this.statusMessageService.show('ไม่สามารถโหลดข้อมูลทีมแปลได้', 'error');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected resetToDefaultRange(): void {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.toDate.set(toLocalInputString(now));
    this.fromDate.set(toLocalInputString(past24h));
  }

  protected setPreset(preset: '24h' | 'today' | '3d' | '7d'): void {
    const now = new Date();
    this.toDate.set(toLocalInputString(now));

    if (preset === '24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    } else if (preset === 'today') {
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      this.fromDate.set(toLocalInputString(midnight));
    } else if (preset === '3d') {
      const past = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    } else if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      this.fromDate.set(toLocalInputString(past));
    }
  }

  protected onFromDateChange(value: string): void {
    this.fromDate.set(value);
  }

  protected onToDateChange(value: string): void {
    this.toDate.set(value);
  }

  protected readonly filteredPatches = computed(() => {
    const fromStr = this.fromDate();
    const toStr = this.toDate();
    const fromTime = fromStr ? new Date(fromStr).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = toStr ? new Date(toStr).getTime() : Number.POSITIVE_INFINITY;

    return this.patches().filter((patch) => {
      const timestamp = Date.parse(patch.updateDate);
      if (Number.isNaN(timestamp)) return false;
      return timestamp >= fromTime && timestamp <= toTime;
    });
  });

  protected readonly translatorGroups = computed<TranslatorGroup[]>(() => {
    const translatorsMap = new Map<string, Translator>();
    for (const t of this.translators()) {
      translatorsMap.set(t.id, t);
    }

    const groupsMap = new Map<string, Patch[]>();

    for (const patch of this.filteredPatches()) {
      const translator = translatorsMap.get(patch.translatorId);
      const name = (translator?.name || translator?.shortName || patch.translatedBy || 'ไม่ระบุทีมแปล').trim();
      const existing = groupsMap.get(name) ?? [];
      existing.push(patch);
      groupsMap.set(name, existing);
    }

    const result: TranslatorGroup[] = [];
    for (const [translatorName, games] of groupsMap.entries()) {
      games.sort((a, b) => a.gameTitle.localeCompare(b.gameTitle, 'th', { sensitivity: 'base' }));
      result.push({ translatorName, games });
    }

    result.sort((a, b) => b.games.length - a.games.length || a.translatorName.localeCompare(b.translatorName, 'th', { sensitivity: 'base' }));
    return result;
  });

  protected readonly stats = computed(() => {
    const gameCount = this.filteredPatches().length;
    const translatorCount = this.translatorGroups().length;
    return { gameCount, translatorCount };
  });

  protected readonly postSummaryText = computed(() => {
    const totalGames = this.filteredPatches().length;
    const groups = this.translatorGroups();

    if (groups.length === 0) {
      return `📢 อัปเดตเกมแปลไทยวันนี้ (0 เกม) 🎮✨\n\n(ไม่พบเกมที่อัปเดตในช่วงเวลาดังกล่าว)`;
    }

    const body = groups.map((g) => {
      const games = g.games.map((game) => `- ${game.gameTitle} [${game.system}]`).join('\n');
      return `🕹️ ${g.translatorName} (${g.games.length} เกม)\n${games}`;
    }).join('\n\n');

    return `📢 อัปเดตเกมแปลไทยวันนี้ (${totalGames} เกม) 🎮✨\n\n${body}\n\n#THAIRomDB #เกมแปลไทย #ไทยรอม #RetroGaming`;
  });

  protected async copyText(): Promise<void> {
    const text = this.postSummaryText();
    if (!text) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers or environments without clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      this.copied.set(true);
      this.statusMessageService.show('คัดลอกข้อความสำเร็จ', 'success');
      setTimeout(() => {
        this.copied.set(false);
      }, 2500);
    } catch {
      this.statusMessageService.show('ไม่สามารถคัดลอกข้อความได้ กรุณากดเลือกข้อความและคัดลอกด้วยตนเอง', 'error');
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
