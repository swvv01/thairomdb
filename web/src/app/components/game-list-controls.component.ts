import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameListFilters, Translator } from '../models/patch.models';
import { BrowseRouteKind } from '../shared/browse-route.util';
import { SystemMaster } from '../repositories/system.repository';

export interface SystemOption {
  shortName: string;
  name: string;
}

@Component({
  selector: 'app-game-list-controls',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './game-list-controls.component.html',
  styleUrl: './game-list-controls.component.css'
})
export class GameListControlsComponent implements OnChanges {
  @Input() translators: Translator[] = [];
  @Input() systems: string[] = [];
  @Input() systemMasters: SystemMaster[] = [];
  @Input() routeKind: BrowseRouteKind | null = null;
  @Input() routeLabel: string | null = null;
  @Input() totalCount = 0;
  @Input() draft: GameListFilters = { keyword: '', tag: null, translatorId: null, system: null, sortBy: 'updateDate', sortDirection: 'desc' };
  @Output() filtersChanged = new EventEmitter<GameListFilters>();
  @Output() clearAll = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  protected sortOpen = false;
  protected sortCollapsed = true;
  private initializedRoute = false;
  private previousRouteKind: BrowseRouteKind | null = null;

  // Translator autocomplete state
  protected translatorSearchText = '';
  protected translatorOpen = false;
  protected translatorUserFiltered = false;
  protected highlightedTranslatorIndex = -1;

  // System autocomplete state
  protected systemSearchText = '';
  protected systemOpen = false;
  protected systemUserFiltered = false;
  protected highlightedSystemIndex = -1;

  ngOnChanges(): void {
    if (!this.initializedRoute || this.previousRouteKind !== this.routeKind) {
      this.sortCollapsed = true;
      this.sortOpen = false;
      this.previousRouteKind = this.routeKind;
      this.initializedRoute = true;
    }
    if (!this.translatorOpen) {
      this.translatorSearchText = this.selectedTranslatorName();
    }
    if (!this.systemOpen) {
      this.systemSearchText = this.selectedSystemName();
    }
  }

  get systemOptions(): SystemOption[] {
    return this.systems.map((short) => {
      const master = this.systemMasters.find((m) => m.shortName.toLowerCase() === short.toLowerCase());
      return { shortName: short, name: master?.name || short };
    }).sort((a, b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }));
  }

  protected selectedTranslatorName(): string {
    if (!this.draft.translatorId) return '';
    return this.translators.find((t) => t.id === this.draft.translatorId)?.name ?? '';
  }

  protected selectedSystemName(): string {
    if (!this.draft.system) return '';
    const match = this.systemOptions.find((s) => s.shortName.toLowerCase() === this.draft.system?.toLowerCase());
    return match ? match.name : this.draft.system;
  }

  protected filteredTranslators(): Translator[] {
    if (!this.translatorUserFiltered) return this.translators;
    const q = this.translatorSearchText.trim().toLowerCase();
    if (!q) return this.translators;
    return this.translators.filter((t) =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.shortName && t.shortName.toLowerCase().includes(q))
    );
  }

  protected filteredSystems(): SystemOption[] {
    if (!this.systemUserFiltered) return this.systemOptions;
    const q = this.systemSearchText.trim().toLowerCase();
    if (!q) return this.systemOptions;
    return this.systemOptions.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.shortName.toLowerCase().includes(q)
    );
  }

  protected openTranslator(event?: FocusEvent): void {
    this.systemOpen = false;
    this.translatorOpen = true;
    this.translatorUserFiltered = false;
    this.highlightedTranslatorIndex = -1;
    (event?.target as HTMLInputElement | undefined)?.select();
  }

  protected onTranslatorInput(value: string): void {
    this.translatorSearchText = value;
    this.translatorUserFiltered = true;
    this.translatorOpen = true;
    this.highlightedTranslatorIndex = -1;
  }

  protected selectTranslator(translator: Translator | null): void {
    this.draft.translatorId = translator?.id ?? null;
    this.translatorSearchText = translator?.name ?? '';
    this.translatorOpen = false;
    this.translatorUserFiltered = false;
    this.highlightedTranslatorIndex = -1;
    this.emit();
  }

  protected clearTranslator(event?: Event): void {
    event?.stopPropagation();
    this.selectTranslator(null);
  }

  protected openSystem(event?: FocusEvent): void {
    this.translatorOpen = false;
    this.systemOpen = true;
    this.systemUserFiltered = false;
    this.highlightedSystemIndex = -1;
    (event?.target as HTMLInputElement | undefined)?.select();
  }

  protected onSystemInput(value: string): void {
    this.systemSearchText = value;
    this.systemUserFiltered = true;
    this.systemOpen = true;
    this.highlightedSystemIndex = -1;
  }

  protected selectSystem(system: SystemOption | null): void {
    this.draft.system = system?.shortName ?? null;
    this.systemSearchText = system?.name ?? '';
    this.systemOpen = false;
    this.systemUserFiltered = false;
    this.highlightedSystemIndex = -1;
    this.emit();
  }

  protected clearSystem(event?: Event): void {
    event?.stopPropagation();
    this.selectSystem(null);
  }

  protected onTranslatorKeydown(event: KeyboardEvent): void {
    if (!this.translatorOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.openTranslator();
      }
      return;
    }
    const options = this.filteredTranslators();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedTranslatorIndex = Math.min(options.length - 1, this.highlightedTranslatorIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedTranslatorIndex = Math.max(-1, this.highlightedTranslatorIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedTranslatorIndex === -1) {
        this.selectTranslator(null);
      } else if (this.highlightedTranslatorIndex >= 0 && this.highlightedTranslatorIndex < options.length) {
        this.selectTranslator(options[this.highlightedTranslatorIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAll();
    }
  }

  protected onSystemKeydown(event: KeyboardEvent): void {
    if (!this.systemOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.openSystem();
      }
      return;
    }
    const options = this.filteredSystems();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedSystemIndex = Math.min(options.length - 1, this.highlightedSystemIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedSystemIndex = Math.max(-1, this.highlightedSystemIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedSystemIndex === -1) {
        this.selectSystem(null);
      } else if (this.highlightedSystemIndex >= 0 && this.highlightedSystemIndex < options.length) {
        this.selectSystem(options[this.highlightedSystemIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAll();
    }
  }

  @HostListener('document:click')
  protected closeAll(): void {
    if (this.translatorOpen) {
      this.translatorOpen = false;
      this.translatorUserFiltered = false;
      this.translatorSearchText = this.selectedTranslatorName();
      this.highlightedTranslatorIndex = -1;
    }
    if (this.systemOpen) {
      this.systemOpen = false;
      this.systemUserFiltered = false;
      this.systemSearchText = this.selectedSystemName();
      this.highlightedSystemIndex = -1;
    }
  }

  protected closeSort(): void {
    this.sortOpen = false;
    this.sortCollapsed = true;
  }

  protected openSort(): void {
    this.sortOpen = true;
    this.sortCollapsed = false;
  }

  protected toggleSort(): void {
    this.sortCollapsed ? this.openSort() : this.closeSort();
  }

  protected onClearAll(event: Event): void {
    event.stopPropagation();
    this.clearAll.emit();
  }

  protected clearKeyword(): void {
    this.draft.keyword = '';
    this.emit();
    this.searchInput?.nativeElement.focus();
  }

  protected emit(): void { this.filtersChanged.emit({ ...this.draft }); }
}
