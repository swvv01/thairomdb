import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { FirestoreDataTransferService } from './firestore-data-transfer.service';
import { PatchCacheService } from './patch-cache.service';
import { FirestoreCacheService } from './firestore-cache.service';

describe('FirestoreDataTransferService - playTime import/export', () => {
  let service: FirestoreDataTransferService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FirestoreDataTransferService,
        { provide: Database, useValue: {} },
        { provide: PatchCacheService, useValue: { requestForceRefresh: () => {} } },
        { provide: FirestoreCacheService, useValue: { clearAll: () => {} } }
      ]
    });
    service = TestBed.inject(FirestoreDataTransferService);
  });

  const createBackupJson = (patchExtra: Record<string, unknown> = {}) => JSON.stringify({
    version: 1,
    exportedAt: '2026-09-30T00:00:00.000Z',
    collections: {
      patches: [
        {
          id: 'test-patch-1',
          gameTitle: 'Dragon Quest',
          translatorId: 'trans-1',
          translatedBy: 'Translator Team',
          system: 'FC',
          patchVersion: '1.0',
          haveUpdateFlag: false,
          ...patchExtra
        }
      ],
      translators: [],
      tags: [],
      systems: [],
      articles: [],
      sidebarLinks: [],
      admins: [],
      redeemCodes: []
    }
  });

  it('parses valid numeric and decimal playTime correctly', () => {
    const raw = createBackupJson({ playTime: 0.5 });
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTime']).toBe(0.5);
  });

  it('handles legacy backup lacking playTime by setting null (backward compatibility)', () => {
    const raw = createBackupJson(); // no playTime
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTime']).toBeNull();
  });

  it('converts numeric string playTime to number', () => {
    const raw = createBackupJson({ playTime: '15.5' });
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTime']).toBe(15.5);
  });

  it('throws error when playTime is negative', () => {
    const raw = createBackupJson({ playTime: -1 });
    expect(() => service.parseBackup(raw)).toThrowError(/test-patch-1\.playTime ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0/);
  });

  it('throws error when playTime is non-numeric string', () => {
    const raw = createBackupJson({ playTime: 'fast' });
    expect(() => service.parseBackup(raw)).toThrowError(/test-patch-1\.playTime ต้องเป็นตัวเลข/);
  });

  it('parses valid numeric and decimal playTimeFull correctly', () => {
    const raw = createBackupJson({ playTimeFull: 25.5 });
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTimeFull']).toBe(25.5);
  });

  it('handles legacy backup lacking playTimeFull by setting null (backward compatibility)', () => {
    const raw = createBackupJson(); // no playTimeFull
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTimeFull']).toBeNull();
  });

  it('converts numeric string playTimeFull to number', () => {
    const raw = createBackupJson({ playTimeFull: '30.5' });
    const backup = service.parseBackup(raw);
    expect(backup.collections.patches[0]['playTimeFull']).toBe(30.5);
  });

  it('throws error when playTimeFull is negative', () => {
    const raw = createBackupJson({ playTimeFull: -2 });
    expect(() => service.parseBackup(raw)).toThrowError(/test-patch-1\.playTimeFull ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0/);
  });

  it('throws error when playTimeFull is non-numeric string', () => {
    const raw = createBackupJson({ playTimeFull: 'slow' });
    expect(() => service.parseBackup(raw)).toThrowError(/test-patch-1\.playTimeFull ต้องเป็นตัวเลข/);
  });
});

