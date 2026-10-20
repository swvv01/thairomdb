import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameListControlsComponent } from './game-list-controls.component';
import { FormsModule } from '@angular/forms';

describe('GameListControlsComponent', () => {
  let component: GameListControlsComponent;
  let fixture: ComponentFixture<GameListControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameListControlsComponent, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(GameListControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should not show clear button when keyword is empty', () => {
    component.draft.keyword = '';
    fixture.detectChanges();
    const clearBtn = fixture.nativeElement.querySelector('.search-clear-btn');
    expect(clearBtn).toBeNull();
  });

  it('should show clear button when keyword has text', () => {
    component.draft.keyword = 'Mario';
    fixture.detectChanges();
    const clearBtn = fixture.nativeElement.querySelector('.search-clear-btn');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.getAttribute('aria-label')).toBe('ล้างข้อความค้นหา');
  });

  it('should clear keyword, emit event, and focus input when clear button is clicked', () => {
    spyOn(component.filtersChanged, 'emit');
    component.draft.keyword = 'Chrono Trigger';
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('#game-search') as HTMLInputElement;
    spyOn(searchInput, 'focus');

    const clearBtn = fixture.nativeElement.querySelector('.search-clear-btn') as HTMLButtonElement;
    clearBtn.click();
    fixture.detectChanges();

    expect(component.draft.keyword).toBe('');
    expect(component.filtersChanged.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      keyword: ''
    }));
    expect(searchInput.focus).toHaveBeenCalled();
  });

  it('renders "ความยาวเกม" option in sort select', () => {
    const select = fixture.nativeElement.querySelector('#sort-patches') as HTMLSelectElement;
    const playTimeOption = Array.from(select.options).find(opt => opt.value === 'playTime');
    expect(playTimeOption).toBeTruthy();
    expect(playTimeOption?.textContent?.trim()).toBe('ความยาวเกม');
  });

  it('displays direction toggle button text as "น้อย → มาก" for asc and "มาก → น้อย" for desc', () => {
    component.draft.sortDirection = 'asc';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.sort-field--sort .button') as HTMLButtonElement;
    expect(btn.textContent?.trim()).toBe('น้อย → มาก');

    component.draft.sortDirection = 'desc';
    fixture.detectChanges();
    expect(btn.textContent?.trim()).toBe('มาก → น้อย');
  });

  it('opens translator autocomplete on focus and displays full name', () => {
    component.translators = [
      { id: 't1', name: 'Pixel Thai', shortName: 'PT' },
      { id: 't2', name: 'Siam Quest', shortName: 'SQ' }
    ];
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-translator') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#filter-translator-options button');
    expect(options.length).toBe(3);
    expect(options[0].textContent.trim()).toBe('ทุกทีม');
    expect(options[1].textContent.trim()).toBe('Pixel Thai');
    expect(options[2].textContent.trim()).toBe('Siam Quest');
  });

  it('filters translator autocomplete by short name and full name', () => {
    component.translators = [
      { id: 't1', name: 'Pixel Thai', shortName: 'PT' },
      { id: 't2', name: 'Siam Quest', shortName: 'SQ' }
    ];
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-translator') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.value = 'SQ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#filter-translator-options button');
    expect(options.length).toBe(2);
    expect(options[1].textContent.trim()).toBe('Siam Quest');
  });

  it('selects translator when clicked and emits filtersChanged', () => {
    spyOn(component.filtersChanged, 'emit');
    component.translators = [
      { id: 't1', name: 'Pixel Thai', shortName: 'PT' }
    ];
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-translator') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#filter-translator-options button');
    options[1].click();
    fixture.detectChanges();

    expect(component.draft.translatorId).toBe('t1');
    expect(input.value).toBe('Pixel Thai');
    expect(component.filtersChanged.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      translatorId: 't1'
    }));
  });

  it('clears translator when clear button is clicked', () => {
    spyOn(component.filtersChanged, 'emit');
    component.translators = [
      { id: 't1', name: 'Pixel Thai', shortName: 'PT' }
    ];
    component.draft.translatorId = 't1';
    component.ngOnChanges();
    fixture.detectChanges();

    const clearBtn = fixture.nativeElement.querySelector('.control-autocomplete__clear') as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    fixture.detectChanges();

    expect(component.draft.translatorId).toBeNull();
    expect(component.filtersChanged.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      translatorId: null
    }));
  });

  it('filters system autocomplete by short name and displays full name', () => {
    component.systems = ['GBA', 'SFC'];
    component.systemMasters = [
      { id: '1', shortName: 'GBA', name: 'Game Boy Advance' },
      { id: '2', shortName: 'SFC', name: 'Super Famicom' }
    ];
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-system') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.value = 'GBA';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('#filter-system-options button');
    expect(options.length).toBe(2);
    expect(options[1].textContent.trim()).toBe('Game Boy Advance');
  });

  it('navigates with keyboard and selects with Enter', () => {
    spyOn(component.filtersChanged, 'emit');
    component.systems = ['GBA', 'SFC'];
    component.systemMasters = [
      { id: '1', shortName: 'GBA', name: 'Game Boy Advance' },
      { id: '2', shortName: 'SFC', name: 'Super Famicom' }
    ];
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-system') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(component.draft.system).toBe('GBA');
    expect(input.value).toBe('Game Boy Advance');
    expect(component.filtersChanged.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      system: 'GBA'
    }));
  });

  it('reverts unselected text on document click', () => {
    component.translators = [
      { id: 't1', name: 'Pixel Thai', shortName: 'PT' }
    ];
    component.draft.translatorId = 't1';
    component.ngOnChanges();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#filter-translator') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.value = 'Random non-matching text';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    document.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(input.value).toBe('Pixel Thai');
  });

  it('hides system filter when routeKind is port', () => {
    component.routeKind = 'port';
    fixture.detectChanges();

    const systemInput = fixture.nativeElement.querySelector('#filter-system');
    expect(systemInput).toBeNull();
  });

  it('collapses sort row when close button in titlebar is clicked and re-opens when toggle is clicked', () => {
    const sortRow = fixture.nativeElement.querySelector('#game-sort-row') as HTMLElement;
    const restoreBtn = fixture.nativeElement.querySelector('.sort-toggle') as HTMLButtonElement;
    restoreBtn.click();
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.sort-row__close-btn') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();

    closeBtn.click();
    fixture.detectChanges();

    const toggleBtn = fixture.nativeElement.querySelector('.sort-toggle') as HTMLButtonElement;

    expect(sortRow.classList.contains('sort-row--collapsed')).toBeTrue();
    expect(toggleBtn.classList.contains('sort-toggle--closed')).toBeTrue();

    toggleBtn.click();
    fixture.detectChanges();

    expect(sortRow.classList.contains('sort-row--collapsed')).toBeFalse();
    expect(sortRow.classList.contains('sort-row--open')).toBeTrue();
    expect(toggleBtn.classList.contains('sort-toggle--closed')).toBeFalse();
  });

  it('starts collapsed in every mode', () => {
    expect(fixture.nativeElement.querySelector('#game-sort-row').classList.contains('sort-row--collapsed')).toBeTrue();
  });

  it('displays routeLabel and totalCount in browse-route-label__title', () => {
    component.routeLabel = 'รอมแปลไทย';
    component.totalCount = 42;
    fixture.detectChanges();

    const titleEl = fixture.nativeElement.querySelector('.browse-route-label__title') as HTMLElement;
    expect(titleEl).toBeTruthy();
    expect(titleEl.textContent).toContain('รอมแปลไทย (42)');
  });

  it('emits clearAll when browse-route-label__clear is clicked', () => {
    spyOn(component.clearAll, 'emit');
    fixture.detectChanges();

    const clearBtn = fixture.nativeElement.querySelector('.browse-route-label__clear') as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    clearBtn.click();

    expect(component.clearAll.emit).toHaveBeenCalled();
  });

  it('toggles sort collapsed when clicking on browse-route-label container', () => {
    const labelEl = fixture.nativeElement.querySelector('.browse-route-label') as HTMLElement;
    expect(component['sortCollapsed']).toBeTrue();

    labelEl.click();
    fixture.detectChanges();
    expect(component['sortCollapsed']).toBeFalse();

    labelEl.click();
    fixture.detectChanges();
    expect(component['sortCollapsed']).toBeTrue();
  });
});
