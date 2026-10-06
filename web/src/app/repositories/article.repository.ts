import { Injectable, inject } from '@angular/core';
import { Database, get, ref, remove, set, query, orderByChild, equalTo } from '@angular/fire/database';
import { from, map, Observable, startWith, Subject, switchMap } from 'rxjs';
import { Article, ArticleDraft } from '../models/article.models';
import { FirestoreCacheService } from '../services/firestore-cache.service';

@Injectable({ providedIn: 'root' })
export class ArticleRepository {
  private readonly db = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly path = 'articles';
  private readonly refresh = new Subject<void>();

  watchAll(includeDrafts = false): Observable<Article[]> {
    if (includeDrafts) {
      return this.refresh.pipe(startWith(undefined), switchMap(() => from(this.fetchFromDb(true))));
    }
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.cache.get('articles', () => from(this.fetchFromDb(false))))
    );
  }

  refreshAll(): void {
    this.cache.invalidate('articles');
    this.refresh.next();
  }

  async all(includeDrafts = false): Promise<Article[]> {
    if (includeDrafts) return this.fetchFromDb(true);
    return new Promise((resolve, reject) => {
      this.watchAll(false).subscribe({ next: resolve, error: reject });
    });
  }

  private async fetchFromDb(includeDrafts: boolean): Promise<Article[]> {
    const source = includeDrafts ? ref(this.db, this.path) : query(ref(this.db, this.path), orderByChild('status'), equalTo('published'));
    const value = (await get(source)).val() ?? {};
    return Object.entries(value as Record<string, Partial<Article>>).map(([id, article]) => ({ ...article, id } as Article))
      .filter(article => includeDrafts || String(article.status).toLowerCase() === 'published')
      .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
  }

  async bySlug(slug: string, includeDrafts = false): Promise<Article | null> {
    try {
      const articles = await this.all(includeDrafts);
      return articles.find(x => x.slug === slug) ?? null;
    } catch {
      return null;
    }
  }

  async byId(id: string): Promise<Article | null> {
    try {
      const value = (await get(ref(this.db, `${this.path}/${id}`))).val();
      return value ? { ...(value as Omit<Article, 'id'>), id } : null;
    } catch {
      const articles = await this.all(false);
      return articles.find(x => x.id === id) ?? null;
    }
  }

  async save(draft: ArticleDraft, id?: string): Promise<string> {
    const now = new Date().toISOString(); const existing = id ? await this.byId(id) : null;
    const article: Omit<Article, 'id'> = { ...draft, createdAt: existing?.createdAt ?? now, updatedAt: now, publishedAt: draft.status === 'published' ? (existing?.publishedAt ?? now) : null };
    const articleId = id ?? crypto.randomUUID(); await set(ref(this.db, `${this.path}/${articleId}`), article);
    this.cache.clear('articles');
    this.refresh.next();
    return articleId;
  }

  async delete(id: string): Promise<void> {
    await remove(ref(this.db, `${this.path}/${id}`));
    this.cache.clear('articles');
    this.refresh.next();
  }
}
