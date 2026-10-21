import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';
import { Observable, Subject, catchError, from, map, startWith, switchMap, throwError } from 'rxjs';
import { Tag } from '../models/patch.models';
import { RepositoryError } from './repository-error';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ');
const normalizeSlug = (value: string): string => normalizeName(value);
const rows = (value: unknown): Record<string, unknown>[] => Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>).map(([id, data]) => ({ id, ...(data as Record<string, unknown>) } as Record<string, unknown>));
@Injectable({ providedIn: 'root' }) export class TagRepository {
  private readonly database = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly edgeData = inject(EdgeDataService);
  private readonly refresh = new Subject<void>();
  watchAll(): Observable<Tag[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.cache.get('tags', (isForced, localSavedAt) =>
        from(this.edgeData.fetchRows('tags', isForced, localSavedAt, async () => {
          const s = await get(ref(this.database, 'tags'));
          return s.val();
        }))
      )),
      map(items => items.map(row => {
        const name = normalizeName(String(row['name'] ?? ''));
        return { id: String(row['id']), name, slug: normalizeSlug(String(row['slug'] ?? '')) || normalizeSlug(name) };
      }).filter(row => row.name).sort((a,b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }))),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลหมวดหมู่ได้', 'read')))
    );
  }

  watchDirectAll(): Observable<Tag[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => from(this.fetchDirectFromDb())),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลหมวดหมู่ได้', 'read')))
    );
  }

  private async fetchDirectFromDb(): Promise<Tag[]> {
    const s = await get(ref(this.database, 'tags'));
    return rows(s.val())
      .map(row => {
        const name = normalizeName(String(row['name'] ?? ''));
        return { id: String(row['id']), name, slug: normalizeSlug(String(row['slug'] ?? '')) || normalizeSlug(name) };
      })
      .filter(row => row.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }));
  }
  async create(name: string, slug = ''): Promise<Tag> { const n = normalizeName(name); const s = normalizeSlug(slug || n); if (!n) throw new RepositoryError('กรุณาระบุชื่อหมวดหมู่', 'create'); if (!s) throw new RepositoryError('กรุณาระบุ slug', 'create'); try { await this.ensureUniqueName(null, n); await this.ensureUniqueSlug(null, s); const r = push(ref(this.database, 'tags')); await update(r, { name: n, slug: s }); this.cache.clear('tags'); this.refresh.next(); return { id: r.key!, name: n, slug: s }; } catch (error) { if (error instanceof RepositoryError) throw error; throw new RepositoryError('ไม่สามารถเพิ่มหมวดหมู่ได้', 'create'); } }
  async update(id: string, name: string, slug: string): Promise<Tag> { const n = normalizeName(name); const s = normalizeSlug(slug); if (!n) throw new RepositoryError('กรุณาระบุชื่อหมวดหมู่', 'update'); if (!s) throw new RepositoryError('กรุณาระบุ slug', 'update'); try { await this.ensureUniqueName(id, n); await this.ensureUniqueSlug(id, s); await update(ref(this.database, `tags/${id}`), { name: n, slug: s }); this.cache.clear('tags'); this.refresh.next(); return { id, name: n, slug: s }; } catch (error) { if (error instanceof RepositoryError) throw error; throw new RepositoryError('ไม่สามารถแก้ไขหมวดหมู่ได้', 'update'); } }
  private async ensureUniqueName(id: string | null, name: string): Promise<void> { const snapshot = await get(ref(this.database, 'tags')); const duplicate = rows(snapshot.val()).some((row) => String(row['id']) !== id && normalizeName(String(row['name'] ?? '')).toLocaleLowerCase('th') === name.toLocaleLowerCase('th')); if (duplicate) throw new RepositoryError('มีชื่อ tag นี้อยู่แล้ว', 'update'); }
  private async ensureUniqueSlug(id: string | null, slug: string): Promise<void> { const snapshot = await get(ref(this.database, 'tags')); const duplicate = rows(snapshot.val()).some((row) => String(row['id']) !== id && normalizeSlug(String(row['slug'] ?? row['name'] ?? '')).toLocaleLowerCase('th') === slug.toLocaleLowerCase('th')); if (duplicate) throw new RepositoryError('มี slug นี้อยู่แล้ว', 'update'); }
  refreshAll(): void { this.cache.invalidate('tags'); this.refresh.next(); }
  async delete(id: string): Promise<void> { try { await remove(ref(this.database, `tags/${id}`)); this.cache.clear('tags'); this.refresh.next(); } catch { throw new RepositoryError('ไม่สามารถลบหมวดหมู่ได้', 'delete'); } }
}
