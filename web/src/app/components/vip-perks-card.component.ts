import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-vip-perks-card',
  standalone: true,
  templateUrl: './vip-perks-card.component.html',
  styleUrl: './vip-perks-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VipPerksCardComponent {}
