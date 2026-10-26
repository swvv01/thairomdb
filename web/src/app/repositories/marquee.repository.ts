import { Injectable, inject } from '@angular/core';
import { Database, get, push, ref, remove, update } from '@angular/fire/database';
import { Observable, Subject, catchError, firstValueFrom, from, map, startWith, switchMap, throwError } from 'rxjs';
import { MarqueeItem } from '../models/marquee.models';
import { RepositoryError } from './repository-error';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

@Injectable({ providedIn: 'root' })
export class MarqueeRepository {
  private readonly database = inject(Database);
  private readonly cache = inject(FirestoreCacheService);
  private readonly edgeData = inject(EdgeDataService);
  private readonly refresh = new Subject<void>();

  watchAll(): Observable<MarqueeItem[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() =>
        this.cache.get('marquees', (isForced, localSavedAt) =>
          from(
            this.edgeData.fetchRows('marquees', isForced, localSavedAt, async () => {
              const s = await get(ref(this.database, 'marquees'));
              return s.val();
            })
          )
        )
      ),
      map((items) =>
        items
          .map((row) => ({
            id: String(row['id']),
            text: normalizeText(String(row['text'] ?? '')),
            isActive: Boolean(row['isActive'] ?? true),
            createdAt: String(row['createdAt'] ?? '')
          }))
          .filter((item) => item.text.length > 0)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      ),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อความ Marquee ได้', 'read')))
    );
  }

  watchActive(): Observable<MarqueeItem[]> {
    return this.watchAll().pipe(
      map((items) => items.filter((item) => item.isActive))
    );
  }

  watchDirectAll(): Observable<MarqueeItem[]> {
    return this.refresh.pipe(
      startWith(undefined),
      switchMap(() => from(this.fetchDirectFromDb())),
      catchError(() => throwError(() => new RepositoryError('ไม่สามารถโหลดข้อความ Marquee ได้', 'read')))
    );
  }

  private async fetchDirectFromDb(): Promise<MarqueeItem[]> {
    const s = await get(ref(this.database, 'marquees'));
    const val = (s.val() ?? {}) as Record<string, unknown>;
    const items = Object.entries(val && typeof val === 'object' ? val : {}).map(([id, data]) => ({
      id,
      text: normalizeText(String((data as Record<string, unknown>)['text'] ?? '')),
      isActive: Boolean((data as Record<string, unknown>)['isActive'] ?? true),
      createdAt: String((data as Record<string, unknown>)['createdAt'] ?? '')
    }));
    return items
      .filter((item) => item.text.length > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(text: string, isActive = true): Promise<{ data: MarqueeItem; edgeSynced: boolean }> {
    const t = normalizeText(text);
    if (!t) throw new RepositoryError('กรุณากรอกข้อความ Marquee', 'create');

    const item: Omit<MarqueeItem, 'id'> = {
      text: t,
      isActive,
      createdAt: new Date().toISOString()
    };

    let marquee: MarqueeItem;
    try {
      const r = push(ref(this.database, 'marquees'));
      await update(r, item);
      marquee = { id: r.key!, ...item };
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถเพิ่มข้อความ Marquee ได้', 'create');
    }
    const edgeSynced = await this.edgeData.syncEdge('marquees');
    this.cache.clear('marquees');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: marquee, edgeSynced };
  }

  async update(id: string, text: string, isActive: boolean): Promise<{ data: MarqueeItem; edgeSynced: boolean }> {
    const t = normalizeText(text);
    if (!t) throw new RepositoryError('กรุณากรอกข้อความ Marquee', 'update');

    let marquee: MarqueeItem;
    try {
      const snapshot = await get(ref(this.database, `marquees/${id}`));
      const existing = snapshot.val() as Record<string, unknown> | null;
      const createdAt = String(existing?.['createdAt'] ?? new Date().toISOString());

      const item: Omit<MarqueeItem, 'id'> = {
        text: t,
        isActive,
        createdAt
      };

      await update(ref(this.database, `marquees/${id}`), item);
      marquee = { id, ...item };
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError('ไม่สามารถแก้ไขข้อความ Marquee ได้', 'update');
    }
    const edgeSynced = await this.edgeData.syncEdge('marquees');
    this.cache.clear('marquees');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { data: marquee, edgeSynced };
  }

  async delete(id: string): Promise<{ edgeSynced: boolean }> {
    try {
      await remove(ref(this.database, `marquees/${id}`));
    } catch {
      throw new RepositoryError('ไม่สามารถลบข้อความ Marquee ได้', 'delete');
    }
    const edgeSynced = await this.edgeData.syncEdge('marquees');
    this.cache.clear('marquees');
    this.refresh.next();
    try { await firstValueFrom(this.watchAll()); } catch { /* ignore watch error */ }
    return { edgeSynced };
  }

  refreshAll(): void {
    this.cache.invalidate('marquees');
    this.refresh.next();
  }
}
