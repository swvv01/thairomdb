import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServerCostRepository } from '../repositories/server-cost.repository';
import { VipPerksCardComponent } from '../components/vip-perks-card.component';

@Component({
  selector: 'app-donate-page',
  standalone: true,
  imports: [RouterLink, DecimalPipe, VipPerksCardComponent],
  templateUrl: './donate-page.component.html',
  styleUrl: './donate-page.component.css'
})
export class DonatePageComponent {
  private readonly serverCostRepository = inject(ServerCostRepository);
  protected readonly selectedMethod = signal<'promptpay' | 'truemoney'>('promptpay');
  protected readonly serverCost = signal<number | null>(this.serverCostRepository.getCached());

  constructor() { void this.loadServerCost(); }

  protected selectMethod(method: 'promptpay' | 'truemoney'): void {
    this.selectedMethod.set(method);
  }

  private async loadServerCost(): Promise<void> {
    try { this.serverCost.set(await this.serverCostRepository.read()); } catch { /* Keep Donate usable if settings are unavailable. */ }
  }
}
