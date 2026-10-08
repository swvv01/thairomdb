import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VipPerksCardComponent } from './vip-perks-card.component';

describe('VipPerksCardComponent', () => {
  let component: VipPerksCardComponent;
  let fixture: ComponentFixture<VipPerksCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VipPerksCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(VipPerksCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render VIP perks heading and 3 perks items', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const heading = compiled.querySelector('.perks-heading');
    expect(heading?.textContent).toContain('สิทธิพิเศษสำหรับสมาชิก VIP');

    const items = compiled.querySelectorAll('ul li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('บันทึกคลังเกมข้ามเครื่อง');
    expect(items[1].textContent).toContain('ดึงข้อมูลล่าสุดได้ทันที');
    expect(items[2].textContent).toContain('เข้าใช้งานช่วงปิดปรับปรุง');
  });
});
