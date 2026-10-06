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
    expect(mockProcessor.process).toHaveBeenCalledWith(croppedBlob);
  });

  it('resets to original raw image and clears lastCrop on resetToOriginal()', async () => {
    const originalBlob = new Blob(['original'], { type: 'image/png' });
    component['rawBlob'].set(originalBlob);
    component['isCropped'].set(true);
    component['lastCrop'].set({ x: 10, y: 20, w: 100, h: 150 });

    await component['resetToOriginal']();

    expect(component['isCropped']()).toBeFalse();
    expect(component['lastCrop']()).toBeNull();
    expect(mockProcessor.process).toHaveBeenCalledWith(originalBlob);
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
});
