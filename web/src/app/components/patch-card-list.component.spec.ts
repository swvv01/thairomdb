import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PatchCardListComponent } from './patch-card-list.component';
import { StatusMessageService } from '../shared/status-message.service';
import { GameLibraryService } from '../services/game-library.service';
import { Patch } from '../models/patch.models';

describe('PatchCardListComponent', () => {
  let component: PatchCardListComponent;
  let fixture: ComponentFixture<PatchCardListComponent>;

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
    expect(titleEl?.textContent?.trim()).toBe('รายละเอียดเวอร์ชัน - Dragon Quest V');

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

  it('renders actions row inside patch-cover-wrap under cover image', () => {
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

    const heading = fixture.nativeElement.querySelector('.patch-card .heading');
    expect(heading).not.toBeNull();
    expect(heading.querySelector('.patch-card__actions-row')).toBeNull();
  });

  it('renders badge before game title in heading as inline flow', () => {
    component.patches = [{
      ...basePatch,
      haveUpdateFlag: true
    }];
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.patch-card .heading');
    expect(heading).not.toBeNull();

    const badge = heading.querySelector('.game-badge');
    const title = heading.querySelector('.game-title');
    expect(badge).not.toBeNull();
    expect(title).not.toBeNull();
    expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
