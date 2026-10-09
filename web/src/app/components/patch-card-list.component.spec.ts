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

  it('renders single line patch version', () => {
    component.patches = [{ ...basePatch, patchVersion: 'v1.0' }];
    fixture.detectChanges();

    const versionEl = fixture.nativeElement.querySelector('.patch-card__version');
    expect(versionEl).not.toBeNull();
    expect(versionEl?.textContent?.trim()).toBe('เวอร์ชันแพตช์: v1.0');
  });

  it('renders multiline patch version containing newlines', () => {
    const multilineVersion = 'v1.05\n- แก้แปลผิดบริบทใน true pacifist route\n- แก้ softlock\n- แก้การตั้งค่าจอย';
    component.patches = [{ ...basePatch, patchVersion: multilineVersion }];
    fixture.detectChanges();

    const versionEl = fixture.nativeElement.querySelector('.patch-card__version');
    expect(versionEl).not.toBeNull();
    expect(versionEl.textContent).toContain('เวอร์ชันแพตช์: v1.05');
    expect(versionEl.textContent).toContain('- แก้แปลผิดบริบทใน true pacifist route');
    expect(versionEl.textContent).toContain('- แก้ softlock');
    expect(versionEl.textContent).toContain('- แก้การตั้งค่าจอย');
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
    expect(labels).toContain('เวอร์ชันแพตช์:');
    expect(labels).toContain('เวลาเล่นจบ:');
    expect(labels).toContain('เพิ่มเมื่อ:');
  });
});
