import { Injectable, inject } from '@angular/core';
import { Database, get, ref, update } from '@angular/fire/database';
import { PatchCacheService } from './patch-cache.service';
import { FirestoreCacheService } from './firestore-cache.service';
export const FIRESTORE_BACKUP_COLLECTIONS = ['patches', 'translators', 'tags', 'systems', 'articles', 'sidebarLinks', 'admins', 'redeemCodes'] as const;
export type FirestoreBackupCollection = typeof FIRESTORE_BACKUP_COLLECTIONS[number];
export type BackupDocument = { id: string; [key: string]: unknown };
export type FirestoreBackup = { version: 1; exportedAt: string; collections: Record<FirestoreBackupCollection, BackupDocument[]> };
export type ImportResult = { written: number; failed: Array<{ collection: string; id: string; reason: string }> };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalizePatchRow = (row: BackupDocument): BackupDocument => {
  const { fileName: _legacyFileName, ...data } = row;
  if (data['patchVersion'] === undefined) data['patchVersion'] = '';
  if (typeof data['patchVersion'] !== 'string') throw new Error(`${row.id}.patchVersion ต้องเป็นข้อความ`);
  if (data['haveUpdateFlag'] === undefined) data['haveUpdateFlag'] = false;
  if (typeof data['haveUpdateFlag'] !== 'boolean') throw new Error(`${row.id}.haveUpdateFlag ต้องเป็น boolean`);
  const rawPlayTime = data['playTime'];
  if (rawPlayTime === undefined || rawPlayTime === null || rawPlayTime === '') {
    data['playTime'] = null;
  } else if (typeof rawPlayTime === 'number') {
    if (Number.isNaN(rawPlayTime) || rawPlayTime < 0) throw new Error(`${row.id}.playTime ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0`);
  } else if (typeof rawPlayTime === 'string' && !Number.isNaN(Number(rawPlayTime))) {
    const parsed = Number(rawPlayTime);
    if (parsed < 0) throw new Error(`${row.id}.playTime ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0`);
    data['playTime'] = parsed;
  } else {
    throw new Error(`${row.id}.playTime ต้องเป็นตัวเลข`);
  }
  const rawPlayTimeFull = data['playTimeFull'];
  if (rawPlayTimeFull === undefined || rawPlayTimeFull === null || rawPlayTimeFull === '') {
    data['playTimeFull'] = null;
  } else if (typeof rawPlayTimeFull === 'number') {
    if (Number.isNaN(rawPlayTimeFull) || rawPlayTimeFull < 0) throw new Error(`${row.id}.playTimeFull ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0`);
  } else if (typeof rawPlayTimeFull === 'string' && !Number.isNaN(Number(rawPlayTimeFull))) {
    const parsedFull = Number(rawPlayTimeFull);
    if (parsedFull < 0) throw new Error(`${row.id}.playTimeFull ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0`);
    data['playTimeFull'] = parsedFull;
  } else {
    throw new Error(`${row.id}.playTimeFull ต้องเป็นตัวเลข`);
  }
  return data;
};
@Injectable({ providedIn: 'root' }) export class FirestoreDataTransferService {
  private readonly database = inject(Database); private readonly patchCache = inject(PatchCacheService); private readonly cache = inject(FirestoreCacheService);
  async exportBackup(): Promise<FirestoreBackup> { const collections = {} as FirestoreBackup['collections']; const snapshot = await get(ref(this.database)); const root = (snapshot.val() ?? {}) as Record<string, unknown>; for (const name of FIRESTORE_BACKUP_COLLECTIONS) { const value = isRecord(root[name]) ? root[name] as Record<string, unknown> : {}; collections[name] = Object.entries(value).map(([id, data]) => { const row = { id, ...(isRecord(data) ? data : {}) }; return name === 'patches' ? normalizePatchRow(row) : row; }); } return { version: 1, exportedAt: new Date().toISOString(), collections }; }
  parseBackup(raw: string): FirestoreBackup { let value: unknown; try { value=JSON.parse(raw); } catch { throw new Error('ไฟล์ JSON ไม่ถูกต้องหรืออ่านไม่ได้'); } if (!isRecord(value) || value['version'] !== 1 || !isRecord(value['collections'])) throw new Error('รูปแบบไฟล์ backup ไม่รองรับ'); const collections={} as FirestoreBackup['collections']; for (const name of FIRESTORE_BACKUP_COLLECTIONS) { const rows=value['collections'][name]; if (rows === undefined && (name === 'admins' || name === 'articles' || name === 'sidebarLinks')) { collections[name]=[]; continue; } if (!Array.isArray(rows)) throw new Error(`ไม่พบข้อมูล collection ${name} ในไฟล์ backup`); const ids=new Set<string>(); collections[name]=rows.map((row,index)=>{ if (!isRecord(row)||typeof row['id']!=='string'||!row['id'].trim()) throw new Error(`${name}[${index}] ต้องมี id เป็นข้อความ`); if(ids.has(row['id'])) throw new Error(`พบ ID ซ้ำใน ${name}: ${row['id']}`); ids.add(row['id']); const doc = row as BackupDocument; return name === 'patches' ? normalizePatchRow(doc) : doc; }); } return { version:1, exportedAt:typeof value['exportedAt']==='string'?value['exportedAt']:'', collections }; }
  async importBackup(backup: FirestoreBackup): Promise<ImportResult> { const result: ImportResult={written:0, failed:[]}; for (const name of FIRESTORE_BACKUP_COLLECTIONS) { if (name === 'admins') continue; const node: Record<string, unknown>={}; try { for (const row of backup.collections[name]) { const {id, haveRom: _legacyHaveRom, ...rawData}=row; const data = name === 'patches' ? normalizePatchRow({ id, ...rawData }) : rawData; node[id]=data; } await update(ref(this.database, name), node); result.written += backup.collections[name].length; } catch (error) { result.failed.push({ collection:name, id:'*', reason: error instanceof Error ? error.message : 'ไม่สามารถเขียนข้อมูลได้' }); } } if (result.written) { this.cache.clearAll(); this.patchCache.requestForceRefresh(); } return result; }
}
