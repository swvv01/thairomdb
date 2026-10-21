import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';
import { Observable, Subject, catchError, from, map, startWith, switchMap, throwError } from 'rxjs';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';
import { RepositoryError } from './repository-error';
import { SidebarLink, SidebarLinkSection, SidebarLinkType } from '../models/sidebar-link.models';

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');
const sections: SidebarLinkSection[] = ['systems', 'translators', 'tags', 'other'];
const types: SidebarLinkType[] = ['article', 'external'];
const rows = (value: unknown): Record<string, unknown>[] => Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>).map(([id, data]) => ({ id, ...(data as Record<string, unknown>) }));

@Injectable({ providedIn: 'root' })
export class SidebarLinkRepository {
  private readonly database = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly edgeData = inject(EdgeDataService);
  private readonly refresh = new Subject<void>();
  watchAll(): Observable<SidebarLink[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.cache.get('sidebarLinks', (isForced, localSavedAt) =>
        from(this.edgeData.fetchRows('sidebarLinks', isForced, localSavedAt, async () => {
          const s = await get(ref(this.database, 'sidebarLinks'));
          return s.val();
        }))
      )),
      map(items => items.map(row => {
        const type = String(row['type'] ?? 'article') as SidebarLinkType;
        return { id: String(row['id']), label: normalize(String(row['label'] ?? '')), type, articleSlug: normalize(String(row['articleSlug'] ?? '')), url: normalize(String(row['url'] ?? '')), section: String(row['section'] ?? '') as SidebarLinkSection };
      }).filter(item => item.label && sections.includes(item.section) && types.includes(item.type) && (item.type === 'article' ? !!item.articleSlug : isExternalUrl(item.url))).sort((a, b) => a.label.localeCompare(b.label, 'th', { sensitivity: 'base' }))),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดลิงก์ sidebar ได้', 'read')))
    );
  }

  watchDirectAll(): Observable<SidebarLink[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => from(this.fetchDirectFromDb())),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดลิงก์ sidebar ได้', 'read')))
    );
  }

  private async fetchDirectFromDb(): Promise<SidebarLink[]> {
    const s = await get(ref(this.database, 'sidebarLinks'));
    return rows(s.val())
      .map(row => {
        const type = String(row['type'] ?? 'article') as SidebarLinkType;
        return {
          id: String(row['id']),
          label: normalize(String(row['label'] ?? '')),
          type,
          articleSlug: normalize(String(row['articleSlug'] ?? '')),
          url: normalize(String(row['url'] ?? '')),
          section: String(row['section'] ?? '') as SidebarLinkSection
        };
      })
      .filter(item => item.label && sections.includes(item.section) && types.includes(item.type) && (item.type === 'article' ? !!item.articleSlug : isExternalUrl(item.url)))
      .sort((a, b) => a.label.localeCompare(b.label, 'th', { sensitivity: 'base' }));
  }
  async create(label: string, type: SidebarLinkType, articleSlug: string, url: string, section: SidebarLinkSection): Promise<SidebarLink> { const item = this.normalizeItem(label, type, articleSlug, url, section, 'create'); try { const r = push(ref(this.database, 'sidebarLinks')); await update(r, this.databaseItem(item)); this.cache.clear('sidebarLinks'); this.refresh.next(); return { id: r.key!, ...item }; } catch { throw new RepositoryError('ไม่สามารถเพิ่มลิงก์ sidebar ได้', 'create'); } }
  async update(id: string, label: string, type: SidebarLinkType, articleSlug: string, url: string, section: SidebarLinkSection): Promise<SidebarLink> { const item = this.normalizeItem(label, type, articleSlug, url, section, 'update'); try { await update(ref(this.database, `sidebarLinks/${id}`), this.databaseItem(item)); this.cache.clear('sidebarLinks'); this.refresh.next(); return { id, ...item }; } catch { throw new RepositoryError('ไม่สามารถแก้ไขลิงก์ sidebar ได้', 'update'); } }
  async delete(id: string): Promise<void> { try { await remove(ref(this.database, `sidebarLinks/${id}`)); this.cache.clear('sidebarLinks'); this.refresh.next(); } catch { throw new RepositoryError('ไม่สามารถลบลิงก์ sidebar ได้', 'delete'); } }
  refreshAll(): void { this.cache.invalidate('sidebarLinks'); this.refresh.next(); }
  private databaseItem(item: Omit<SidebarLink, 'id'>): Record<string, string | null> { return { ...item, articleSlug: item.type === 'article' ? item.articleSlug : null, url: item.type === 'external' ? item.url : null }; }
  private normalizeItem(label: string, type: SidebarLinkType, articleSlug: string, url: string, section: SidebarLinkSection, operation: 'create' | 'update'): Omit<SidebarLink, 'id'> { const item = { label: normalize(label), type, articleSlug: type === 'article' ? normalize(articleSlug) : '', url: type === 'external' ? normalize(url) : '', section }; if (!item.label || !types.includes(item.type) || !sections.includes(item.section) || (item.type === 'article' ? !item.articleSlug : !isExternalUrl(item.url))) throw new RepositoryError('กรุณากรอกข้อมูลลิงก์ให้ครบถ้วน', operation); return item; }
}

const isExternalUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value);
