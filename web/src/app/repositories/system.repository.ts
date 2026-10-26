import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';
import { Observable, Subject, catchError, firstValueFrom, from, map, startWith, switchMap, throwError } from 'rxjs';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';
import { RepositoryError } from './repository-error';
export interface SystemMaster { id: string; shortName: string; name: string; }
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ');
const rows = (value: unknown): Record<string, unknown>[] => Object.entries((value && typeof value === 'object' ? value : {}) as Record<string, unknown>).map(([id, data]) => ({ id, ...(data as Record<string, unknown>) }));
@Injectable({ providedIn: 'root' }) export class SystemRepository {
  private readonly database = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly edgeData = inject(EdgeDataService);
  private readonly refresh = new Subject<void>();
  watchAll(): Observable<SystemMaster[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => this.cache.get('systems', (isForced, localSavedAt) =>
        from(this.edgeData.fetchRows('systems', isForced, localSavedAt, async () => {
          const s = await get(ref(this.database, 'systems'));
          return s.val();
        }))
      )),
      map(items => items.map(row => ({ id: String(row['id']), shortName: normalizeName(String(row['shortName'] ?? '')), name: normalizeName(String(row['name'] ?? '')) })).filter(row => row.shortName && row.name).sort((a,b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }))),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลเครื่องเกมได้', 'read')))
    );
  }

  watchDirectAll(): Observable<SystemMaster[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => from(this.fetchDirectFromDb())),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อมูลเครื่องเกมได้', 'read')))
    );
  }

  private async fetchDirectFromDb(): Promise<SystemMaster[]> {
    const s = await get(ref(this.database, 'systems'));
    return rows(s.val())
      .map(row => ({ id: String(row['id']), shortName: normalizeName(String(row['shortName'] ?? '')), name: normalizeName(String(row['name'] ?? '')) }))
      .filter(row => row.shortName && row.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'th', { sensitivity: 'base' }));
  }
  async create(shortName: string, name: string): Promise<{ data: SystemMaster; edgeSynced: boolean }> {
    const s = normalizeName(shortName), n = normalizeName(name);
    if (!s || !n) throw new RepositoryError('กรุณาระบุชื่อย่อและชื่อเต็มของเครื่องเกม', 'create');
    let system: SystemMaster;
    try {
      const r = push(ref(this.database, 'systems'));
      await update(r, { shortName: s, name: n });
      system = { id: r.key!, shortName: s, name: n };
    } catch {
      throw new RepositoryError('ไม่สามารถเพิ่มเครื่องเกมได้', 'create');
    }
    const edgeSynced = await this.edgeData.syncEdge('systems');
    this.cache.clear('systems');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: system, edgeSynced };
  }

  async update(id: string, shortName: string, name: string): Promise<{ data: SystemMaster; edgeSynced: boolean }> {
    const s = normalizeName(shortName), n = normalizeName(name);
    if (!s || !n) throw new RepositoryError('กรุณาระบุชื่อย่อและชื่อเต็มของเครื่องเกม', 'update');
    let system: SystemMaster;
    try {
      await update(ref(this.database, `systems/${id}`), { shortName: s, name: n });
      system = { id, shortName: s, name: n };
    } catch {
      throw new RepositoryError('ไม่สามารถแก้ไขเครื่องเกมได้', 'update');
    }
    const edgeSynced = await this.edgeData.syncEdge('systems');
    this.cache.clear('systems');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: system, edgeSynced };
  }

  refreshAll(): void { this.cache.invalidate('systems'); this.refresh.next(); }

  async delete(id: string): Promise<{ edgeSynced: boolean }> {
    try {
      await remove(ref(this.database, `systems/${id}`));
    } catch {
      throw new RepositoryError('ไม่สามารถลบเครื่องเกมได้', 'delete');
    }
    const edgeSynced = await this.edgeData.syncEdge('systems');
    this.cache.clear('systems');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { edgeSynced };
  }
}
