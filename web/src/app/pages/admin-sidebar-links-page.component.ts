import { AsyncPipe, NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Article } from '../models/article.models';
import { SidebarLink, SidebarLinkSection, SidebarLinkType } from '../models/sidebar-link.models';
import { ArticleRepository } from '../repositories/article.repository';
import { SidebarLinkRepository } from '../repositories/sidebar-link.repository';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { AdminMasterPageComponent } from './admin-master-page.component';

@Component({ selector: 'app-admin-sidebar-links-page', standalone: true, imports: [AsyncPipe, FormsModule, NgFor, AdminMasterPageComponent], templateUrl: './admin-sidebar-links-page.component.html' })
export class AdminSidebarLinksPageComponent {
  private readonly repo = inject(SidebarLinkRepository); private readonly articles = inject(ArticleRepository); private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly status = inject(StatusMessageService);
  protected readonly items = this.repo.watchDirectAll(); protected readonly articleItems = this.loadArticles(); protected open = false; protected id: string | null = null; protected label = ''; protected type: SidebarLinkType = 'article'; protected articleSlug = ''; protected url = ''; protected section: SidebarLinkSection = 'other'; protected saving = false;
  protected readonly typeOptions: Array<{ value: SidebarLinkType; label: string }> = [{ value: 'article', label: 'บทความภายใน' }, { value: 'external', label: 'ลิงก์ภายนอก' }];
  protected readonly sectionOptions: Array<{ value: SidebarLinkSection; label: string }> = [{ value: 'systems', label: 'ระบบเกม' }, { value: 'translators', label: 'ทีมแปล' }, { value: 'tags', label: 'Tags' }, { value: 'other', label: 'อื่นๆ' }];
  private async loadArticles(): Promise<Article[]> { return (await this.articles.all(true)).filter((article) => article.status !== 'published'); }
  protected add(): void { this.id = null; this.label = ''; this.type = 'article'; this.articleSlug = ''; this.url = ''; this.section = 'other'; this.open = true; }
  protected edit(item: SidebarLink): void { this.id = item.id; this.label = item.label; this.type = item.type; this.articleSlug = item.articleSlug; this.url = item.url; this.section = item.section; this.open = true; }
  protected close(): void { if (!this.saving) this.open = false; }
  protected async save(): Promise<void> { if (this.saving) return; this.saving = true; this.status.show('กำลังบันทึกลิงก์ sidebar...'); try { const editing = !!this.id; if (this.id) await this.repo.update(this.id, this.label, this.type, this.articleSlug, this.url, this.section); else await this.repo.create(this.label, this.type, this.articleSlug, this.url, this.section); this.open = false; this.status.show(editing ? 'แก้ไขลิงก์ sidebar สำเร็จ' : 'เพิ่มลิงก์ sidebar สำเร็จ', 'success'); } catch (error) { this.status.show(error instanceof Error ? error.message : 'ไม่สามารถบันทึกลิงก์ sidebar ได้', 'error'); } finally { this.saving = false; } }
  protected async remove(item: SidebarLink): Promise<void> { if (this.saving || !window.confirm(`ยืนยันการลบลิงก์ ${item.label} หรือไม่?`)) return; this.saving = true; this.status.show('กำลังลบลิงก์ sidebar...'); try { await this.repo.delete(item.id); this.status.show('ลบลิงก์ sidebar สำเร็จ', 'success'); } catch (error) { this.status.show(error instanceof Error ? error.message : 'ไม่สามารถลบลิงก์ sidebar ได้', 'error'); } finally { this.saving = false; } }
  protected articleTitle(slug: string): string { return this.articleItemsValue.find((article) => article.slug === slug)?.title ?? slug; }
  protected sectionLabel(section: SidebarLinkSection): string { return this.sectionOptions.find((item) => item.value === section)?.label ?? section; }
  protected async signOut(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/', { replaceUrl: true }); }
  private articleItemsValue: Article[] = [];
  constructor() { this.articleItems.then((items) => this.articleItemsValue = items); }
}
