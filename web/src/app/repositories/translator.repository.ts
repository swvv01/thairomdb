import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';
import { Observable, Subject, catchError, firstValueFrom, from, map, startWith, switchMap, throwError } from 'rxjs';
import { Translator } from '../models/patch.models';
import { RepositoryError } from './repository-error';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';
export type TranslatorDocument = { shortName: string; name: string; modTool?: string; link?: string };
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ');
const rows = (value: unknown): Record<string, unknown>[] => Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>).map(([id, data]) => ({ id, ...(data as Record<string, unknown>) } as Record<string, unknown>));
@Injectable({ providedIn: 'root' }) export class TranslatorRepository {
  private readonly database = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly edgeData = inject(EdgeDataService);
  private readonly refresh = new Subject<void>();
  watchAll(): Observable<Translator[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.cache.get('translators', (isForced, localSavedAt) =>
        from(this.edgeData.fetchRows('translators', isForced, localSavedAt, async () => {
          const s = await get(ref(this.database, 'translators'));
          return s.val();
        }))
      )),
      map(items => items.map(row => ({ id: String(row['id']), shortName: normalizeName(String(row['shortName'] ?? '')), name: normalizeName(String(row['name'] ?? '')), modTool: row['modTool'] ? normalizeName(String(row['modTool'])) : undefined, link: row['link'] ? String(row['link']).trim() : undefined })).filter(row => row.shortName && row.name).sort((a,b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }))),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลทีมแปลได้', 'read')))
    );
  }

  watchDirectAll(): Observable<Translator[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => from(this.fetchDirectFromDb())),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลทีมแปลได้', 'read')))
    );
  }

  private async fetchDirectFromDb(): Promise<Translator[]> {
    const s = await get(ref(this.database, 'translators'));
    return rows(s.val())
      .map(row => ({
        id: String(row['id']),
        shortName: normalizeName(String(row['shortName'] ?? '')),
        name: normalizeName(String(row['name'] ?? '')),
        modTool: row['modTool'] ? normalizeName(String(row['modTool'])) : undefined,
        link: row['link'] ? String(row['link']).trim() : undefined
      }))
      .filter(row => row.shortName && row.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }));
  }
  async create(shortName: string, name: string, link?: string, modTool?: string): Promise<{ data: Translator; edgeSynced: boolean }> {
    const s = normalizeName(shortName), n = normalizeName(name), l = link?.trim(), m = modTool?.trim();
    if (!s || !n) throw new RepositoryError('กรุณาระบุชื่อย่อและชื่อเต็มของทีมแปล', 'create');
    const data = { shortName: s, name: n, ...(m ? { modTool: m } : {}), ...(l ? { link: l } : {}) };
    let translator: Translator;
    try {
      const r = push(ref(this.database, 'translators'));
      await update(r, data);
      translator = { id: r.key!, ...data };
    } catch {
      throw new RepositoryError('ไม่สามารถเพิ่มทีมแปลได้', 'create');
    }
    const edgeSynced = await this.edgeData.syncEdge('translators');
    this.cache.clear('translators');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: translator, edgeSynced };
  }

  async update(id: string, shortName: string, name: string, link?: string, modTool?: string): Promise<{ data: Translator; edgeSynced: boolean }> {
    const s = normalizeName(shortName), n = normalizeName(name), l = link?.trim(), m = modTool?.trim();
    if (!s || !n) throw new RepositoryError('กรุณาระบุชื่อย่อและชื่อเต็มของทีมแปล', 'update');
    const data = { shortName: s, name: n, modTool: m || null, link: l || null };
    let translator: Translator;
    try {
      await update(ref(this.database, `translators/${id}`), data);
      translator = { id, shortName: s, name: n, ...(m ? { modTool: m } : {}), ...(l ? { link: l } : {}) };
    } catch {
      throw new RepositoryError('ไม่สามารถแก้ไขทีมแปลได้', 'update');
    }
    const edgeSynced = await this.edgeData.syncEdge('translators');
    this.cache.clear('translators');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: translator, edgeSynced };
  }

  refreshAll(): void { this.cache.invalidate('translators'); this.refresh.next(); }

  async delete(id: string): Promise<{ edgeSynced: boolean }> {
    try {
      await remove(ref(this.database, `translators/${id}`));
    } catch {
      throw new RepositoryError('ไม่สามารถลบทีมแปลได้', 'delete');
    }
    const edgeSynced = await this.edgeData.syncEdge('translators');
    this.cache.clear('translators');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { edgeSynced };
  }
}
