import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DonatePageComponent } from './donate-page.component';
import { ServerCostRepository } from '../repositories/server-cost.repository';

describe('DonatePageComponent', () => {
  let fixture: ComponentFixture<DonatePageComponent>;
  let component: DonatePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonatePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ServerCostRepository,
          useValue: {
            read: () => Promise.resolve(null),
            getCached: () => null
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DonatePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create donate page component', () => {
    expect(component).toBeTruthy();
  });

  it('should not display server cost when serverCost is 0', () => {
    (component as any).serverCost.set(0);
    fixture.detectChanges();

    const costEl = fixture.nativeElement.querySelector('.server-cost');
    expect(costEl).toBeNull();
  });

  it('should not display server cost when serverCost is null', () => {
    (component as any).serverCost.set(null);
    fixture.detectChanges();

    const costEl = fixture.nativeElement.querySelector('.server-cost');
    expect(costEl).toBeNull();
  });

  it('should display server cost when serverCost is greater than 0', () => {
    (component as any).serverCost.set(1250);
    fixture.detectChanges();

    const costEl = fixture.nativeElement.querySelector('.server-cost');
    expect(costEl).toBeTruthy();
    expect(costEl.textContent).toContain('1,250฿');
  });
});
