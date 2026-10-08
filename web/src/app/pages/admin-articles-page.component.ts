import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ArticlePreviewComponent } from '../components/article-preview.component';
import { ArticleRepository } from '../repositories/article.repository';
import { Article, ArticleDraft } from '../models/article.models';
import { StatusMessageService } from '../shared/status-message.service';

@Component({ selector: 'app-admin-articles-page', standalone: true, imports: [CommonModule, FormsModule, ArticlePreviewComponent], templateUrl: './admin-articles-page.component.html', styleUrl: './admin-articles-page.component.css' })
export class AdminArticlesPageComponent {
  private readonly repo = inject(ArticleRepository); private readonly status = inject(StatusMessageService); private readonly router = inject(Router); private readonly route = inject(ActivatedRoute);
  protected items: Article[] = []; protected editing: string | null = null; protected busy = false; protected isEdit = false; protected isPreview = false; protected form: ArticleDraft = this.blank(); private loadedRouteKey: string | null = null;
  protected searchText = '';

  protected get filteredItems(): Article[] {
    const query = this.searchText.trim().toLowerCase();
    if (!query) return this.items;
    return this.items.filter(item =>
      (item.title && item.title.toLowerCase().includes(query)) ||
      (item.slug && item.slug.toLowerCase().includes(query)) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query))
    );
  }

  constructor() { void this.loadItems(); combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => void this.syncRoute(params.get('id'), query.get('preview') === 'true')); }
  private blank(): ArticleDraft { return { title: '', slug: '', excerpt: '', content: '', coverUrl: '', category: 'ความรู้', tags: [], status: 'draft', author: 'admin' }; }
  private async loadItems() { this.items = await this.repo.all(true); }
  private async syncRoute(id: string | null, preview: boolean) { this.isEdit = this.route.snapshot.url.some(segment => segment.path === 'edit'); this.isPreview = this.isEdit && preview; if (!this.isEdit) { this.loadedRouteKey = null; return; } const routeKey = id ?? 'new'; if (this.loadedRouteKey === routeKey) return; this.loadedRouteKey = routeKey; if (id === 'new') { this.editing = null; this.form = this.blank(); return; } if (!id) return; const item = await this.repo.byId(id); if (!item) { this.status.show('ไม่พบบทความที่ต้องการแก้ไข', 'error'); await this.router.navigate(['/admin/articles']); return; } this.editing = item.id; this.form = { ...this.blank(), ...item, tags: [...(item.tags ?? [])] }; }
  protected start(item?: Article) { void this.router.navigate(['/admin/articles/edit', item?.id ?? 'new']); }
  protected openPreview(item: Article) { void this.router.navigate(['/admin/articles/edit', item.id], { queryParams: { preview: 'true' } }); }
  protected backToList() { void this.router.navigate(['/admin/articles']); }
  protected togglePreview(preview: boolean) { void this.router.navigate([], { relativeTo: this.route, queryParams: preview ? { preview: 'true' } : {}, queryParamsHandling: preview ? 'merge' : '' }); }
  protected slugify() { this.form.slug = this.form.slug || this.form.title.toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-|-$/g, ''); }
  protected async publish(item: Article) { this.editing = item.id; this.form = { ...item, tags: [...(item.tags ?? [])], status: 'published' }; await this.save('กำลังเผยแพร่บทความ…', 'เผยแพร่บทความสำเร็จ'); }
  protected async unpublish(item: Article) { this.editing = item.id; this.form = { ...item, tags: [...(item.tags ?? [])], status: 'draft' }; await this.save('กำลังยกเลิกการเผยแพร่บทความ…', 'ยกเลิกการเผยแพร่บทความสำเร็จ'); }
  protected async save(progressMessage = 'กำลังบันทึกบทความ…', successMessage = 'บันทึกบทความสำเร็จ') { if (this.busy) return; if (!this.form.title.trim() || !this.form.content.trim() || !this.form.slug.trim()) { this.status.show('กรุณากรอกชื่อเรื่อง, slug และเนื้อหา', 'error'); return; } this.busy = true; this.status.show(progressMessage); try { await this.repo.save({ ...this.form, tags: this.form.tags }, this.editing ?? undefined); this.status.show(successMessage, 'success'); this.form = this.blank(); this.editing = null; await this.loadItems(); await this.router.navigate(['/admin/articles']); } catch (e) { this.status.show(e instanceof Error ? e.message : 'ไม่สามารถบันทึกบทความได้', 'error'); } finally { this.busy = false; } }
  protected async remove(item: Article) { if (this.busy || !confirm(`ยืนยันการลบ ${item.title} หรือไม่?`)) return; this.busy = true; this.status.show('กำลังลบบทความ…'); try { await this.repo.delete(item.id); this.status.show('ลบบทความสำเร็จ', 'success'); await this.loadItems(); } catch (e) { this.status.show(e instanceof Error ? e.message : 'ไม่สามารถลบบทความได้', 'error'); } finally { this.busy = false; } }
}
