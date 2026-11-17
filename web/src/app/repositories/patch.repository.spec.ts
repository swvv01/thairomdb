import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { of } from 'rxjs';
import { PatchRepository } from './patch.repository';
import { PatchCacheService } from '../services/patch-cache.service';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';
import { Patch } from '../models/patch.models';

describe('PatchRepository', () => {
  let repository: PatchRepository;
  let mockEdgeData: jasmine.SpyObj<EdgeDataService>;
  let mockCache: jasmine.SpyObj<FirestoreCacheService>;
  let mockPatchCache: jasmine.SpyObj<PatchCacheService>;

  beforeEach(() => {
    mockEdgeData = jasmine.createSpyObj<EdgeDataService>('EdgeDataService', ['syncEdge', 'fetchRaw', 'fetchRows']);
    mockCache = jasmine.createSpyObj<FirestoreCacheService>('FirestoreCacheService', ['get', 'clear', 'setSavedAt']);
    mockPatchCache = jasmine.createSpyObj<PatchCacheService>('PatchCacheService', ['get', 'clear', 'requestForceRefresh']);

    TestBed.configureTestingModule({
      providers: [
        PatchRepository,
        { provide: Database, useValue: {} },
        { provide: EdgeDataService, useValue: mockEdgeData },
        { provide: FirestoreCacheService, useValue: mockCache },
        { provide: PatchCacheService, useValue: mockPatchCache }
      ]
    });

    repository = TestBed.inject(PatchRepository);
  });

  describe('batchUpdatePatchToolByTranslator', () => {
    it('returns count: 0 and edgeSynced: true when no matching patches exist', async () => {
      spyOn(repository, 'watchAll').and.returnValue(
        of([
          { id: 'p1', translatorId: 'other-translator', patchTool: 'tool1' } as Patch
        ])
      );

      const result = await repository.batchUpdatePatchToolByTranslator('target-translator', 'https://new-tool.com');

      expect(result).toEqual({ count: 0, edgeSynced: true });
      expect(mockPatchCache.clear).not.toHaveBeenCalled();
    });
  });
});
