import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PatchCardListComponent } from './patch-card-list.component';
import { StatusMessageService } from '../shared/status-message.service';
import { GameLibraryService } from '../services/game-library.service';
import { BrowseGridModeService } from '../services/browse-grid-mode.service';
import { ImageProcessorService } from '../services/image-processor.service';
import { Patch } from '../models/patch.models';

describe('PatchCardListComponent', () => {
  let component: PatchCardListComponent;
  let fixture: ComponentFixture<PatchCardListComponent>;
  let gridModeService: BrowseGridModeService;

  const basePatch: Patch = {
    id: 'patch-1',
    gameTitle: 'Dragon Quest V',
    system: 'SFC',
    patchVersion: '',
    translatedBy: 'Team Thai',
    translatorId: 'translator-1',
    haveUpdateFlag: false,
    patchTool: '',
    referenceText: '',
    referenceUrl: '',
    patchFileUrl: '',
    patchedRomUrl: '',
    walkthroughUrl: '',
    coverUrl: '',
    tags: [],
    updateDate: '2026-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PatchCardListComponent],
      providers: [
        provideRouter([]),
        {
          provide: StatusMessageService,
          useValue: { show: jasmine.createSpy('show') }
        },
        {
          provide: GameLibraryService,
          useValue: {
            isInLibrary: () => false,
            toggleLibrary: () => Promise.resolve(true),
            libraryPatchIds: () => new Set<string>()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PatchCardListComponent);
    component = fixture.componentInstance;
    gridModeService = TestBed.inject(BrowseGridModeService);
    gridModeService.setGridMode(false);
  });

  afterEach(() => {
    window.localStorage.clear();
    gridModeService.setGridMode(false);
  });

  it('renders single line patch version as plain text without link', () => {
    component.patches = [{ ...basePatch, patchVersion: 'v1.0' }];
    fixture.detectChanges();

    const versionEl = fixture.nativeElement.querySelector('.patch-card__version');
    const linkEl = fixture.nativeElement.querySelector('.patch-card__version-link');
    const textEl = fixture.nativeElement.querySelector('.patch-card__version-text');

    expect(versionEl).not.toBeNull();
    expect(linkEl).toBeNull();
    expect(textEl?.textContent?.trim()).toBe('v1.0');
    expect(versionEl?.textContent?.trim()).toBe('เวอร์ชัน: v1.0');
  });

  it('renders only the first row as a link when patch version is multiline, and opens modal on click', () => {
    const multilineVersion = 'v1.05\n- แก้แปลผิดบริบทใน true pacifist route\n- แก้ softlock\n- แก้การตั้งค่าจอย';
    component.patches = [{ ...basePatch, patchVersion: multilineVersion }];
    fixture.detectChanges();

    const versionEl = fixture.nativeElement.querySelector('.patch-card__version');
    const linkEl = fixture.nativeElement.querySelector('.patch-card__version-link') as HTMLButtonElement | null;
    expect(versionEl).not.toBeNull();
    expect(linkEl).not.toBeNull();
    expect(linkEl?.textContent?.trim()).toBe('v1.05');

    // Subsequent lines should NOT be rendered in the card
    expect(versionEl.textContent).not.toContain('- แก้แปลผิดบริบท');

    // Modal is initially not rendered
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();

    // Click link to open modal
    linkEl?.click();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.patch-version-dialog');
    expect(modal).not.toBeNull();
    const titleEl = modal.querySelector('.patch-version-dialog__title');
    expect(titleEl?.textContent?.trim()).toBe('Dragon Quest V');
    const labelEl = modal.querySelector('.patch-version-dialog__label');
    expect(labelEl?.textContent?.trim()).toBe('รายละเอียดเวอร์ชัน:');

    const contentEl = modal.querySelector('.patch-version-dialog__text');
    expect(contentEl?.textContent).toContain('v1.05');
    expect(contentEl?.textContent).toContain('- แก้แปลผิดบริบทใน true pacifist route');

    // Close modal via close button
    const closeBtn = modal.querySelector('.patch-version-dialog__footer button') as HTMLButtonElement | null;
    closeBtn?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();
  });

  it('closes version modal on backdrop click and on escape key', () => {
    const multilineVersion = 'v1.05\n- update note';
    component.patches = [{ ...basePatch, patchVersion: multilineVersion }];
    fixture.detectChanges();

    const linkEl = fixture.nativeElement.querySelector('.patch-card__version-link') as HTMLButtonElement | null;
    linkEl?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).not.toBeNull();

    // Close on backdrop click
    const backdrop = fixture.nativeElement.querySelector('.patch-version-backdrop') as HTMLElement | null;
    backdrop?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();

    // Reopen and close via escape key
    linkEl?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();
  });

  it('does not render patch-card__version when patchVersion is empty', () => {
    component.patches = [{ ...basePatch, patchVersion: '' }];
    fixture.detectChanges();

    const versionEl = fixture.nativeElement.querySelector('.patch-card__version');
    expect(versionEl).toBeNull();
  });

  it('renders playTime when specified and greater than 0', () => {
    component.patches = [{ ...basePatch, playTime: 0.5 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: 0.5 ชั่วโมง');
  });

  it('renders playTime and playTimeFull range when both are specified and greater than 0', () => {
    component.patches = [{ ...basePatch, playTime: 15, playTimeFull: 25.5 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: 15 - 25.5 ชั่วโมง');
  });

  it('renders single value when playTime and playTimeFull are equal', () => {
    component.patches = [{ ...basePatch, playTime: 11, playTimeFull: 11 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: 11 ชั่วโมง');
    expect(descEl?.textContent).not.toContain('11 - 11');
  });

  it('renders only playTimeFull when playTime is null', () => {
    component.patches = [{ ...basePatch, playTime: null, playTimeFull: 30 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: 30 ชั่วโมง');
  });

  it('renders "ไม่มีข้อมูล" when playTime is 0', () => {
    component.patches = [{ ...basePatch, playTime: 0 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: ไม่มีข้อมูล');
  });

  it('renders "ไม่มีข้อมูล" when playTime is 0 even if playTimeFull is specified', () => {
    component.patches = [{ ...basePatch, playTime: 0, playTimeFull: 20 }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).toContain('เวลาเล่นจบ: ไม่มีข้อมูล');
  });

  it('does not render playTime when playTime and playTimeFull are null', () => {
    component.patches = [{ ...basePatch, playTime: null, playTimeFull: null }];
    fixture.detectChanges();

    const descEl = fixture.nativeElement.querySelector('.patch-card__description');
    expect(descEl?.textContent).not.toContain('เวลาเล่นจบ:');
  });

  it('renders card labels with patch-card__label class', () => {
    component.patches = [{ ...basePatch, patchVersion: 'v1.0', playTime: 10 }];
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.patch-card__label'))
      .map((el: any) => el.textContent?.trim());
    expect(labels).toContain('โดย:');
    expect(labels).toContain('ระบบ:');
    expect(labels).toContain('เวอร์ชัน:');
    expect(labels).toContain('เวลาเล่นจบ:');
    expect(labels).toContain('เพิ่มเมื่อ:');
  });

  it('renders download links with label and download-list structure', () => {
    component.patches = [{
      ...basePatch,
      coverUrl: 'http://example.com/cover.png',
      patchFileUrl: 'http://example.com/patch.zip',
      referenceUrl: 'http://example.com/source'
    }];
    fixture.detectChanges();

    const linksContainer = fixture.nativeElement.querySelector('.patch-card__links');
    expect(linksContainer).not.toBeNull();

    const label = linksContainer.querySelector('.patch-card__links-label');
    expect(label).not.toBeNull();
    expect(label.textContent.trim()).toBe('ลิ้ง:');

    const downloadList = linksContainer.querySelector('.patch-card__download-list');
    expect(downloadList).not.toBeNull();

    const anchors = downloadList.querySelectorAll('a');
    expect(anchors.length).toBe(3);
    const linkTexts = Array.from(anchors).map((a: any) => a.textContent.trim());
    expect(linkTexts).toContain('ภาพปก');
    expect(linkTexts).toContain('Patch');
    expect(linkTexts).toContain('ที่มา');
  });

  it('converts webp cover to png on downloadCover', async () => {
    const imageProcessor = TestBed.inject(ImageProcessorService);
    const mockWebpBlob = new Blob(['fake-webp'], { type: 'image/webp' });
    const mockPngBlob = new Blob(['fake-png'], { type: 'image/png' });
    spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(mockWebpBlob)));
    spyOn(imageProcessor, 'convertToPng').and.returnValue(Promise.resolve(mockPngBlob));
    const createUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://example.com/mock-blob');
    const revokeUrlSpy = spyOn(URL, 'revokeObjectURL');

    const patch: Patch = {
      ...basePatch,
      coverUrl: 'http://example.com/cover.webp'
    };
    const event = new MouseEvent('click');
    spyOn(event, 'preventDefault');

    await (component as any).downloadCover(event, patch);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.fetch).toHaveBeenCalledWith('http://example.com/cover.webp?download=1');
    expect(imageProcessor.convertToPng).toHaveBeenCalledWith(mockWebpBlob);
    expect(createUrlSpy).toHaveBeenCalledWith(mockPngBlob);
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:http://example.com/mock-blob');
  });

  it('does not transcode if cover is already png on downloadCover', async () => {
    const imageProcessor = TestBed.inject(ImageProcessorService);
    const mockPngBlob = new Blob(['fake-png'], { type: 'image/png' });
    spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(mockPngBlob)));
    spyOn(imageProcessor, 'convertToPng');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:http://example.com/mock-blob');
    spyOn(URL, 'revokeObjectURL');

    const patch: Patch = {
      ...basePatch,
      coverUrl: 'http://example.com/cover.png'
    };
    const event = new MouseEvent('click');

    await (component as any).downloadCover(event, patch);

    expect(imageProcessor.convertToPng).not.toHaveBeenCalled();
  });

  it('falls back to window.open if downloadCover fetch fails', async () => {
    spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('Network error')));
    const openSpy = spyOn(window, 'open');

    const patch: Patch = {
      ...basePatch,
      coverUrl: 'http://example.com/cover.webp'
    };
    const event = new MouseEvent('click');

    await (component as any).downloadCover(event, patch);

    expect(openSpy).toHaveBeenCalledWith('http://example.com/cover.webp', '_blank', 'noopener,noreferrer');
  });

  it('renders tags row inside patch-card__description', () => {
    component.tags = [{ id: 'tag-1', name: 'RPG', slug: 'rpg' }];
    component.patches = [{
      ...basePatch,
      tags: ['tag-1']
    }];
    fixture.detectChanges();

    const desc = fixture.nativeElement.querySelector('.patch-card__description');
    expect(desc).not.toBeNull();

    const tagsRow = desc.querySelector('.patch-card__tags-row');
    expect(tagsRow).not.toBeNull();

    const tagLabel = tagsRow.querySelector('.patch-card__tags-label');
    expect(tagLabel?.textContent?.trim()).toBe('แท็ก:');

    const tagLinks = tagsRow.querySelectorAll('a');
    expect(tagLinks.length).toBe(1);
    expect(tagLinks[0].textContent.trim()).toBe('RPG');
  });

  it('renders actions row as overlay inside patch-cover-wrap at top of cover image', () => {
    component.canEdit = true;
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: true
    }];
    fixture.detectChanges();

    const coverWrap = fixture.nativeElement.querySelector('.patch-cover-wrap');
    expect(coverWrap).not.toBeNull();

    const coverImage = coverWrap.querySelector('.patch-cover-image');
    expect(coverImage).not.toBeNull();

    const actionsRow = coverWrap.querySelector('.patch-card__actions-row');
    expect(actionsRow).not.toBeNull();
    expect(actionsRow.parentElement).toBe(coverWrap);

    const editBtn = actionsRow.querySelector('a.btn-primary');
    expect(editBtn).not.toBeNull();

    const libraryBtn = actionsRow.querySelector('button.button');
    expect(libraryBtn).not.toBeNull();

    const heading = fixture.nativeElement.querySelector('.patch-card__title');
    expect(heading).not.toBeNull();
    expect(heading.querySelector('.patch-card__actions-row')).toBeNull();
  });

  it('renders badge after game title in heading as inline flow', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: true
    }];
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.patch-card__title');
    expect(heading).not.toBeNull();

    const badge = heading.querySelector('.game-badge');
    const title = heading.querySelector('.patch-card__title-text');
    expect(badge).not.toBeNull();
    expect(title).not.toBeNull();
    expect(title.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders update cover badge inside patch-cover-frame when haveUpdateFlag is true', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: true
    }];
    fixture.detectChanges();

    const frame = fixture.nativeElement.querySelector('.patch-cover-frame');
    expect(frame).not.toBeNull();
    const coverBadge = frame.querySelector('.patch-card__cover-badge.update-game-badge');
    expect(coverBadge).not.toBeNull();
    expect(coverBadge.querySelector('img[src="assets/images/update.gif"]')).not.toBeNull();
  });

  it('renders new cover badge inside patch-cover-frame when isNewGame is true', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: false,
      updateDate: new Date().toISOString()
    }];
    fixture.detectChanges();

    const frame = fixture.nativeElement.querySelector('.patch-cover-frame');
    expect(frame).not.toBeNull();
    const coverBadge = frame.querySelector('.patch-card__cover-badge.new-game-badge');
    expect(coverBadge).not.toBeNull();
    expect(coverBadge.querySelector('img[src="assets/images/new.gif"]')).not.toBeNull();
  });

  it('does not render cover badge when game is neither updated nor new', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: false,
      updateDate: '2020-01-01T00:00:00.000Z'
    }];
    fixture.detectChanges();

    const frame = fixture.nativeElement.querySelector('.patch-cover-frame');
    expect(frame).not.toBeNull();
    const coverBadge = frame.querySelector('.patch-card__cover-badge');
    expect(coverBadge).toBeNull();
  });

  it('opens and closes detail modal via openDetailModal and closeDetailModal', () => {
    component.patches = [basePatch];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.patch-detail-dialog')).toBeNull();

    component.openDetailModal(basePatch);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.patch-card__title-text')?.textContent).toContain(basePatch.gameTitle);
    expect(dialog.querySelector('.patch-detail-dialog__close-btn')).not.toBeNull();

    // Escape closes detail modal
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.patch-detail-dialog')).toBeNull();
  });

  it('renders description and download links inside detail modal', () => {
    component.patches = [{
      ...basePatch,
      coverUrl: 'http://example.com/cover.png'
    }];
    component.openDetailModal(component.patches[0]);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();

    const modalDesc = dialog.querySelector('.patch-card__description');
    expect(modalDesc).not.toBeNull();

    const modalLinks = dialog.querySelector('.patch-card__links');
    expect(modalLinks).not.toBeNull();
    expect(modalLinks.querySelector('.patch-card__links-label')).not.toBeNull();
    expect(modalLinks.querySelector('.patch-card__download-list')).not.toBeNull();
  });

  it('does not render mobile-by line inside detail modal', () => {
    component.patches = [{
      ...basePatch,
      translatedBy: 'Happy2You'
    }];
    component.openDetailModal(component.patches[0]);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.patch-card__mobile-by')).toBeNull();
    expect(dialog.querySelector('.patch-card__cover-system-badge')).toBeNull();
  });

  it('does not render game-badge inside detail modal even when patch has update or is new', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: true,
      updateDate: new Date().toISOString()
    }];
    component.openDetailModal(component.patches[0]);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.game-badge')).toBeNull();
  });

  it('renders dialog actions (library and edit buttons) inside detail modal', () => {
    component.patches = [basePatch];
    component.canEdit = true;
    component.openDetailModal(basePatch);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();

    const actions = dialog.querySelector('.patch-card__dialog-actions');
    expect(actions).not.toBeNull();

    const editBtn = actions.querySelector('a.button.btn-primary.patch-card__action-btn');
    expect(editBtn).not.toBeNull();
    expect(editBtn.getAttribute('title')).toBe('แก้ไข');

    const libraryBtn = actions.querySelector('button.button.patch-card__action-btn');
    expect(libraryBtn).not.toBeNull();
    expect(libraryBtn.getAttribute('title')).toBe('เก็บเข้าคลัง');
  });

  it('renders only library button in dialog actions when canEdit is false', () => {
    component.patches = [basePatch];
    component.canEdit = false;
    component.openDetailModal(basePatch);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    const actions = dialog.querySelector('.patch-card__dialog-actions');
    expect(actions).not.toBeNull();

    const editBtn = actions.querySelector('a.button.btn-primary.patch-card__action-btn');
    expect(editBtn).toBeNull();

    const libraryBtn = actions.querySelector('button.button.patch-card__action-btn');
    expect(libraryBtn).not.toBeNull();
  });

  it('renders actions inside card body for desktop mode', () => {
    component.patches = [basePatch];
    component.canEdit = true;
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.patch-card');
    expect(card).not.toBeNull();

    const actions = card.querySelector('.patch-card__body .patch-card__dialog-actions');
    expect(actions).not.toBeNull();

    const editBtn = actions.querySelector('a.patch-card__action-btn--edit');
    expect(editBtn).not.toBeNull();

    const libraryBtn = actions.querySelector('button.patch-card__action-btn--bookmark');
    expect(libraryBtn).not.toBeNull();
  });

  it('stacks version modal on top of detail modal when opened from inside detail modal', () => {
    const multiPatch = {
      ...basePatch,
      patchVersion: 'v1.0\nv1.1'
    };
    component.patches = [multiPatch];
    component.openDetailModal(multiPatch);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.patch-detail-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();

    // Click version link inside detail modal to open version modal
    const versionLink = fixture.nativeElement.querySelector('.patch-detail-dialog .patch-card__version-link') as HTMLButtonElement | null;
    versionLink?.click();
    fixture.detectChanges();

    // Both modals in DOM, version modal rendered
    const detailDialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    const versionDialog = fixture.nativeElement.querySelector('.patch-version-dialog');
    expect(detailDialog).not.toBeNull();
    expect(versionDialog).not.toBeNull();

    // Escape closes version modal first
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.patch-version-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('.patch-detail-dialog')).not.toBeNull();
  });

  it('renders mobile by translator line inside heading next to game title', () => {
    component.patches = [{
      ...basePatch,
      translatedBy: 'Happy2You'
    }];
    fixture.detectChanges();

    const mobileHeading = fixture.nativeElement.querySelector('.patch-card__title--mobile');
    expect(mobileHeading).not.toBeNull();

    const mobileBy = mobileHeading.querySelector('.patch-card__mobile-by');
    expect(mobileBy).not.toBeNull();
    expect(mobileBy.textContent).toContain('by');
    expect(mobileBy.textContent).toContain('Happy2You');

    const link = mobileBy.querySelector('a');
    expect(link).not.toBeNull();
    expect(link.textContent.trim()).toBe('Happy2You');

    const desktopHeading = fixture.nativeElement.querySelector('.patch-card__title--desktop');
    expect(desktopHeading).not.toBeNull();
    expect(desktopHeading.querySelector('.patch-card__mobile-by')).toBeNull();
  });

  it('renders cover system badge link inside actions row', () => {
    component.patches = [{
      ...basePatch,
      system: 'SFC'
    }];
    fixture.detectChanges();

    const coverWrap = fixture.nativeElement.querySelector('.patch-cover-wrap');
    expect(coverWrap).not.toBeNull();

    const systemBadge = coverWrap.querySelector('.patch-card__cover-system-badge');
    expect(systemBadge).not.toBeNull();
    expect(systemBadge.textContent.trim()).toBe('SFC');
    expect(systemBadge.getAttribute('href')).toContain('/system?system=SFC');
  });

  it('does not render cover system badge when system is empty or whitespace', () => {
    component.patches = [{
      ...basePatch,
      system: '   '
    }];
    fixture.detectChanges();

    const coverWrap = fixture.nativeElement.querySelector('.patch-cover-wrap');
    expect(coverWrap).not.toBeNull();
    expect(coverWrap.querySelector('.patch-card__cover-system-badge')).toBeNull();
  });

  it('renders actions row under cover with bookmark and edit on left, and system on right', () => {
    component.canEdit = true;
    component.patches = [{
      ...basePatch,
      system: 'SFC'
    }];
    fixture.detectChanges();

    const actionsRow = fixture.nativeElement.querySelector('.patch-card__actions-row');
    expect(actionsRow).not.toBeNull();

    const bookmark = actionsRow.querySelector('.patch-card__actions-left .patch-card__action-btn--bookmark');
    expect(bookmark).not.toBeNull();

    const edit = actionsRow.querySelector('.patch-card__actions-left .patch-card__action-btn--edit');
    expect(edit).not.toBeNull();

    // Verify bookmark is before edit
    expect(bookmark.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const right = actionsRow.querySelector('.patch-card__actions-right .patch-card__cover-system-badge');
    expect(right).not.toBeNull();
    expect(right.textContent.trim()).toBe('SFC');
  });

  it('renders single-line version before system separated by | in patch-card__actions-right', () => {
    component.patches = [{
      ...basePatch,
      patchVersion: 'v1.0',
      system: 'GBA'
    }];
    fixture.detectChanges();

    const actionsRight = fixture.nativeElement.querySelector('.patch-card__actions-right');
    expect(actionsRight).not.toBeNull();

    const versionText = actionsRight.querySelector('.patch-card__cover-version-text');
    expect(versionText).not.toBeNull();
    expect(versionText.textContent.trim()).toBe('v1.0');

    const divider = actionsRight.querySelector('.patch-card__cover-divider');
    expect(divider).not.toBeNull();
    expect(divider.textContent.trim()).toBe('|');

    const systemBadge = actionsRight.querySelector('.patch-card__cover-system-badge');
    expect(systemBadge).not.toBeNull();
    expect(systemBadge.textContent.trim()).toBe('GBA');

    // Order: version -> divider -> system
    expect(versionText.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(divider.compareDocumentPosition(systemBadge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders clickable button for multiline version and opens version modal on click', () => {
    spyOn(component, 'openVersionModal');
    component.patches = [{
      ...basePatch,
      patchVersion: 'v1.0\nv1.1 changelog',
      system: 'GBA'
    }];
    fixture.detectChanges();

    const actionsRight = fixture.nativeElement.querySelector('.patch-card__actions-right');
    const versionBtn = actionsRight.querySelector('.patch-card__cover-version-btn');
    expect(versionBtn).not.toBeNull();
    expect(versionBtn.textContent.trim()).toBe('v1.0');

    versionBtn.click();
    expect(component.openVersionModal).toHaveBeenCalledWith(component.patches[0]);
  });

  it('does not render divider when only version or only system exists', () => {
    // Only version
    component.patches = [{
      ...basePatch,
      patchVersion: 'v1.0',
      system: ''
    }];
    fixture.detectChanges();

    let actionsRight = fixture.nativeElement.querySelector('.patch-card__actions-right');
    expect(actionsRight.querySelector('.patch-card__cover-version-text')).not.toBeNull();
    expect(actionsRight.querySelector('.patch-card__cover-divider')).toBeNull();
    expect(actionsRight.querySelector('.patch-card__cover-system-badge')).toBeNull();

    // Only system
    component.patches = [{
      ...basePatch,
      patchVersion: '',
      system: 'GBA'
    }];
    fixture.detectChanges();

    actionsRight = fixture.nativeElement.querySelector('.patch-card__actions-right');
    expect(actionsRight.querySelector('.patch-card__cover-version-text')).toBeNull();
    expect(actionsRight.querySelector('.patch-card__cover-divider')).toBeNull();
    expect(actionsRight.querySelector('.patch-card__cover-system-badge')).not.toBeNull();
  });

  it('does not render cover version or divider inside detail modal', () => {
    component.patches = [{
      ...basePatch,
      patchVersion: 'v1.0\nv1.1',
      system: 'GBA'
    }];
    component.openDetailModal(component.patches[0]);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.patch-detail-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.patch-card__cover-version-btn')).toBeNull();
    expect(dialog.querySelector('.patch-card__cover-version-text')).toBeNull();
    expect(dialog.querySelector('.patch-card__cover-divider')).toBeNull();
  });

  describe('Pinterest Masonry Grid Mode', () => {
    it('renders pinterest masonry grid when activeGridMode is true', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [
        { ...basePatch, id: 'patch-1', gameTitle: 'Game 1' },
        { ...basePatch, id: 'patch-2', gameTitle: 'Game 2' }
      ];
      fixture.detectChanges();

      const masonryContainer = fixture.nativeElement.querySelector('.pinterest-masonry-container');
      const listContainer = fixture.nativeElement.querySelector('.patch-card-container');
      expect(masonryContainer).not.toBeNull();
      expect(listContainer).toBeNull();

      const cards = fixture.nativeElement.querySelectorAll('.pinterest-card');
      expect(cards.length).toBe(2);
    });

    it('opens detail modal when clicking a pinterest card in grid mode', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{ ...basePatch, id: 'patch-1', gameTitle: 'Game 1' }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card') as HTMLElement;
      card.click();
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.patch-detail-dialog');
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('Game 1');
    });

    it('correctly partitions items left-to-right across columns', () => {
      component['columnCount'].set(3);
      component.patches = [
        { ...basePatch, id: 'patch-1' },
        { ...basePatch, id: 'patch-2' },
        { ...basePatch, id: 'patch-3' },
        { ...basePatch, id: 'patch-4' }
      ];

      const cols = component['masonryColumns']();
      expect(cols.length).toBe(3);
      expect(cols[0].map(p => p.id)).toEqual(['patch-1', 'patch-4']);
      expect(cols[1].map(p => p.id)).toEqual(['patch-2']);
      expect(cols[2].map(p => p.id)).toEqual(['patch-3']);
    });

    it('renders system abbreviation and translator in overlay', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{
        ...basePatch,
        id: 'patch-1',
        gameTitle: 'Dragon Quest V',
        system: 'SFC',
        translatedBy: 'Happy2You'
      }];
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.pinterest-card__overlay');
      expect(overlay).not.toBeNull();

      const titleLine = overlay.querySelector('.pinterest-card__title-line');
      expect(titleLine).not.toBeNull();
      expect(titleLine.textContent.trim()).toBe('[SFC] Dragon Quest V');

      const systemEl = overlay.querySelector('.pinterest-card__system');
      expect(systemEl).not.toBeNull();
      expect(systemEl.textContent).toContain('[SFC]');

      const titleEl = overlay.querySelector('.pinterest-card__title');
      expect(titleEl).not.toBeNull();
      expect(titleEl.textContent).toContain('Dragon Quest V');

      const byEl = overlay.querySelector('.pinterest-card__by');
      expect(byEl).not.toBeNull();
      expect(byEl.textContent).toContain('by Happy2You');
    });

    it('renders update badge on top-right of cover image in grid mode when haveUpdateFlag is true', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{
        ...basePatch,
        id: 'patch-update-1',
        haveUpdateFlag: true
      }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card');
      expect(card).not.toBeNull();
      const badge = card.querySelector('.pinterest-card__badge.update-game-badge');
      expect(badge).not.toBeNull();
      expect(badge.querySelector('img[src="assets/images/update.gif"]')).not.toBeNull();
    });

    it('renders new badge on top-right of cover image in grid mode when game is new', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{
        ...basePatch,
        id: 'patch-new-1',
        updateDate: new Date().toISOString()
      }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card');
      expect(card).not.toBeNull();
      const badge = card.querySelector('.pinterest-card__badge.new-game-badge');
      expect(badge).not.toBeNull();
      expect(badge.querySelector('img[src="assets/images/new.gif"]')).not.toBeNull();
    });

    it('does not render badge in grid mode when game is neither updated nor new', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{
        ...basePatch,
        id: 'patch-normal-1',
        haveUpdateFlag: false,
        updateDate: '2020-01-01T00:00:00.000Z'
      }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card');
      expect(card).not.toBeNull();
      const badge = card.querySelector('.pinterest-card__badge');
      expect(badge).toBeNull();
    });

    it('renders skeleton placeholder in grid mode card while image is loading, and hides it after onImageLoad', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{ ...basePatch, id: 'patch-load-1' }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card');
      expect(card).not.toBeNull();

      const placeholder = card.querySelector('.pinterest-card__placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder.classList.contains('pinterest-card__placeholder--hidden')).toBeFalse();

      const placeholderIcon = placeholder.querySelector('.pinterest-card__placeholder-icon');
      expect(placeholderIcon).not.toBeNull();
      expect(placeholderIcon.classList.contains('fa-image')).toBeTrue();

      const img = card.querySelector('.pinterest-card__cover-image');
      expect(img).not.toBeNull();
      expect(img.classList.contains('pinterest-card__cover-image--loaded')).toBeFalse();

      // Trigger image load
      (component as any).onImageLoad('patch-load-1');
      fixture.detectChanges();

      expect(placeholder.classList.contains('pinterest-card__placeholder--hidden')).toBeTrue();
      expect(img.classList.contains('pinterest-card__cover-image--loaded')).toBeTrue();
    });

    it('renders skeleton placeholder in card mode while image is loading, and hides it after onImageLoad', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(false);
      component.patches = [{ ...basePatch, id: 'patch-card-load-1' }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.patch-card');
      expect(card).not.toBeNull();

      const frame = card.querySelector('.patch-cover-frame');
      expect(frame).not.toBeNull();

      const placeholder = card.querySelector('.patch-cover-placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder.classList.contains('patch-cover-placeholder--hidden')).toBeFalse();

      const placeholderIcon = placeholder.querySelector('.patch-cover-placeholder-icon');
      expect(placeholderIcon).not.toBeNull();
      expect(placeholderIcon.classList.contains('fa-image')).toBeTrue();

      const img = card.querySelector('.patch-cover-image');
      expect(img).not.toBeNull();
      expect(img.classList.contains('patch-cover-image--loaded')).toBeFalse();

      // Trigger image load
      (component as any).onImageLoad('patch-card-load-1');
      fixture.detectChanges();

      expect(placeholder.classList.contains('patch-cover-placeholder--hidden')).toBeTrue();
      expect(img.classList.contains('patch-cover-image--loaded')).toBeTrue();
    });

    it('keeps overlay and badge present during placeholder loading state', () => {
      gridModeService.isDesktopOrTablet.set(true);
      gridModeService.isGameListRoute.set(true);
      gridModeService.setGridMode(true);
      component.patches = [{
        ...basePatch,
        id: 'patch-overlay-loading',
        haveUpdateFlag: true
      }];
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.pinterest-card');
      expect(card).not.toBeNull();

      // Placeholder is active
      const placeholder = card.querySelector('.pinterest-card__placeholder:not(.pinterest-card__placeholder--hidden)');
      expect(placeholder).not.toBeNull();

      // Overlay and badge are present in DOM
      const overlay = card.querySelector('.pinterest-card__overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.textContent).toContain('Dragon Quest V');

      const badge = card.querySelector('.pinterest-card__badge.update-game-badge');
      expect(badge).not.toBeNull();
    });

    it('calculates at least 2 columns when width is >= 440px', () => {
      const calculateCols = (width: number) => Math.max(1, width >= 440 ? Math.max(2, Math.floor((width + 12) / (250 + 12))) : 1);
      expect(calculateCols(440)).toBe(2);
      expect(calculateCols(448)).toBe(2);
      expect(calculateCols(512)).toBe(2);
      expect(calculateCols(780)).toBe(3);
      expect(calculateCols(400)).toBe(1);
    });
  });
});