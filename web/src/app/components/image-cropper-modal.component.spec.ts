import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageCropperModalComponent } from './image-cropper-modal.component';

describe('ImageCropperModalComponent', () => {
  let component: ImageCropperModalComponent;
  let fixture: ComponentFixture<ImageCropperModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageCropperModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageCropperModalComponent);
    component = fixture.componentInstance;
    component.imageBlob = new Blob(['fake image data'], { type: 'image/png' });
    fixture.detectChanges();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('emits cancelled when escape key is pressed', () => {
    const cancelSpy = spyOn(component.cancelled, 'emit');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('emits cancelled when close button is clicked', () => {
    const cancelSpy = spyOn(component.cancelled, 'emit');
    const closeBtn = fixture.nativeElement.querySelector('.cropper-header button') as HTMLButtonElement;
    closeBtn.click();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('resets selection to full image on resetSelection', () => {
    component['stageImgRef'] = {
      nativeElement: {
        clientWidth: 300,
        clientHeight: 200,
        naturalWidth: 600,
        naturalHeight: 400
      } as unknown as HTMLImageElement
    };
    component['resetSelection']();
    expect(component['box']()).toEqual({ x: 0, y: 0, w: 300, h: 200 });
    expect(component['cropWidthPx']()).toBe(600);
    expect(component['cropHeightPx']()).toBe(400);
  });

  it('resizes box via edge handle when dragged', () => {
    component['stageImgRef'] = {
      nativeElement: {
        clientWidth: 300,
        clientHeight: 200,
        naturalWidth: 600,
        naturalHeight: 400
      } as unknown as HTMLImageElement
    };
    component['stageRef'] = {
      nativeElement: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 } as DOMRect)
      } as unknown as HTMLElement
    };
    component['resetSelection']();

    // Start dragging right edge 'e' inward by -50px
    const fakeEventDown = { stopPropagation: () => {}, preventDefault: () => {}, clientX: 300, clientY: 100 } as unknown as PointerEvent;
    component['onPointerDown'](fakeEventDown, 'e');

    const fakeEventMove = { clientX: 250, clientY: 100 } as unknown as PointerEvent;
    component['onWindowPointerMove'](fakeEventMove);

    expect(component['box']().w).toBe(250);
    expect(component['box']().h).toBe(200);
  });

  it('moves box when dragged inside box', () => {
    component['stageImgRef'] = {
      nativeElement: {
        clientWidth: 300,
        clientHeight: 200,
        naturalWidth: 600,
        naturalHeight: 400
      } as unknown as HTMLImageElement
    };
    component['stageRef'] = {
      nativeElement: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 } as DOMRect)
      } as unknown as HTMLElement
    };
    // Set a smaller box (100x100 at 0,0)
    component['updateBox']({ x: 0, y: 0, w: 100, h: 100 });

    const fakeEventDown = { stopPropagation: () => {}, preventDefault: () => {}, clientX: 50, clientY: 50 } as unknown as PointerEvent;
    component['onPointerDown'](fakeEventDown, 'move');

    const fakeEventMove = { clientX: 80, clientY: 70 } as unknown as PointerEvent;
    component['onWindowPointerMove'](fakeEventMove);

    expect(component['box']().x).toBe(30);
    expect(component['box']().y).toBe(20);
  });
});
