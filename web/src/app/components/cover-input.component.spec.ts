import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoverInputComponent } from './cover-input.component';
import { ImageProcessorService } from '../services/image-processor.service';

describe('CoverInputComponent', () => {
  let component: CoverInputComponent;
  let fixture: ComponentFixture<CoverInputComponent>;
  let mockProcessor: jasmine.SpyObj<ImageProcessorService>;

  beforeEach(async () => {
    mockProcessor = jasmine.createSpyObj<ImageProcessorService>('ImageProcessorService', ['process']);
    mockProcessor.process.and.resolveTo({
      blob: new Blob(['processed image'], { type: 'image/png' }),
      width: 200,
      height: 300,
      filename: 'cover.png'
    });

    await TestBed.configureTestingModule({
      imports: [CoverInputComponent],
      providers: [
        { provide: ImageProcessorService, useValue: mockProcessor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CoverInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('stores rawBlob and emits processed blob when processing new image', async () => {
    const rawBlob = new Blob(['raw image'], { type: 'image/png' });
    const selectSpy = spyOn(component.selected, 'emit');

    await component['process'](rawBlob, true);

    expect(component['rawBlob']()).toBe(rawBlob);
    expect(component['isCropped']()).toBeFalse();
    expect(component['lastCrop']()).toBeNull();
    expect(component['preview']()).toBeTruthy();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('opens and closes cropper modal when rawBlob exists', () => {
    component['rawBlob'].set(new Blob(['test'], { type: 'image/png' }));
    component['openCropper']();
    expect(component['cropperOpen']()).toBeTrue();

    component['closeCropper']();
    expect(component['cropperOpen']()).toBeFalse();
  });

  it('opens cropper modal when only existingCoverUrl is present', () => {
    component.existingCoverUrl = 'https://example.com/cover.webp';
    fixture.detectChanges();

    expect(component['cropperSource']()).toBe('https://example.com/cover.webp');
    component['openCropper']();
    expect(component['cropperOpen']()).toBeTrue();
  });

  it('handles cropped image, keeps original rawBlob, and remembers lastCrop', async () => {
    const originalBlob = new Blob(['original'], { type: 'image/png' });
    const croppedBlob = new Blob(['cropped'], { type: 'image/png' });
    const cropRect = { x: 10, y: 20, w: 100, h: 150 };

    component['rawBlob'].set(originalBlob);
    component['cropperOpen'].set(true);

    await component['onCropped']({ blob: croppedBlob, cropRect });

    expect(component['cropperOpen']()).toBeFalse();
    expect(component['isCropped']()).toBeTrue();
    expect(component['lastCrop']()).toEqual(cropRect);
    expect(component['rawBlob']()).toBe(originalBlob);
    expect(mockProcessor.process).toHaveBeenCalledWith(croppedBlob, 0.95);
  });

  it('resets to original raw image and clears lastCrop on resetToOriginal()', async () => {
    const originalBlob = new Blob(['original'], { type: 'image/png' });
    component['rawBlob'].set(originalBlob);
    component['isCropped'].set(true);
    component['lastCrop'].set({ x: 10, y: 20, w: 100, h: 150 });

    await component['resetToOriginal']();

    expect(component['isCropped']()).toBeFalse();
    expect(component['lastCrop']()).toBeNull();
    expect(mockProcessor.process).toHaveBeenCalledWith(originalBlob, undefined);
  });

  it('clears preview, rawBlob, isCropped, cropperOpen, and lastCrop on clear()', () => {
    component['rawBlob'].set(new Blob(['test'], { type: 'image/png' }));
    component['isCropped'].set(true);
    component['cropperOpen'].set(true);
    component['lastCrop'].set({ x: 10, y: 20, w: 100, h: 150 });

    component.clear();

    expect(component['preview']()).toBeNull();
    expect(component['rawBlob']()).toBeNull();
    expect(component['isCropped']()).toBeFalse();
    expect(component['cropperOpen']()).toBeFalse();
    expect(component['lastCrop']()).toBeNull();
  });

  it('displays existingCoverUrl in preview and leaves rawBlob null', () => {
    component.existingCoverUrl = 'https://example.com/cover.png';
    fixture.detectChanges();

    expect(component['preview']()).toBe('https://example.com/cover.png');
    expect(component['rawBlob']()).toBeNull();
    expect(component.existingCoverUrl).toBe('https://example.com/cover.png');
  });

  it('reverts to existing cover and emits undefined when revertToExisting() is called', async () => {
    component.existingCoverUrl = 'https://example.com/cover.png';
    fixture.detectChanges();

    const newBlob = new Blob(['new image'], { type: 'image/png' });
    await component['process'](newBlob, true);

    expect(component['preview']()).not.toBe('https://example.com/cover.png');
    expect(component['rawBlob']()).toBe(newBlob);

    const selectSpy = spyOn(component.selected, 'emit');
    component['revertToExisting']();

    expect(component['preview']()).toBe('https://example.com/cover.png');
    expect(component['rawBlob']()).toBeNull();
    expect(component['isCropped']()).toBeFalse();
    expect(selectSpy).toHaveBeenCalledWith(undefined);
  });

  it('shows loading message and disables buttons while processing image', async () => {
    let resolveProcessing!: (value: any) => void;
    mockProcessor.process.and.returnValue(new Promise((resolve) => {
      resolveProcessing = resolve;
    }));

    const rawBlob = new Blob(['raw image'], { type: 'image/png' });
    const processPromise = component['process'](rawBlob, true);

    fixture.detectChanges();

    expect(component['loading']()).toBeTrue();
    const loadingEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.textContent).toContain('กำลังประมวลผลรูปภาพ...');

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const clipboardBtn = Array.from(buttons).find((b: any) => b.textContent?.includes('Clipboard')) as HTMLButtonElement;
    expect(clipboardBtn?.disabled).toBeTrue();

    resolveProcessing({
      blob: new Blob(['processed image'], { type: 'image/png' }),
      width: 200,
      height: 300,
      filename: 'cover.png'
    });
    await processPromise;
    fixture.detectChanges();

    expect(component['loading']()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(clipboardBtn?.disabled).toBeFalse();
  });

  it('resets loading to false and displays error when processing fails', async () => {
    mockProcessor.process.and.rejectWith(new Error('Process error'));
    const rawBlob = new Blob(['bad image'], { type: 'image/png' });

    await component['process'](rawBlob, true);
    fixture.detectChanges();

    expect(component['loading']()).toBeFalse();
    expect(component['error']()).toBe('Process error');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('ignores paste while loading is true', async () => {
    component['loading'].set(true);
    spyOn(component as any, 'process');

    const fakeItem = {
      type: 'image/png',
      getAsFile: () => new File([''], 'test.png', { type: 'image/png' })
    };
    const fakeEvent = {
      clipboardData: { items: [fakeItem] },
      preventDefault: jasmine.createSpy('preventDefault')
    } as unknown as ClipboardEvent;

    await component['paste'](fakeEvent);

    expect(fakeEvent.preventDefault).not.toHaveBeenCalled();
    expect((component as any).process).not.toHaveBeenCalled();
  });
});
