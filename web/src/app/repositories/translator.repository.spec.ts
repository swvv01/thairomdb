import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { TranslatorRepository } from './translator.repository';
import { FirestoreCacheService } from '../services/firestore-cache.service';
import { EdgeDataService } from '../services/edge-data.service';

describe('TranslatorRepository', () => {
  let repository: TranslatorRepository;
  let mockEdgeData: jasmine.SpyObj<EdgeDataService>;
  let mockCache: jasmine.SpyObj<FirestoreCacheService>;

  beforeEach(() => {
    mockEdgeData = jasmine.createSpyObj<EdgeDataService>('EdgeDataService', ['syncEdge', 'fetchRows', 'fetchRaw']);
    mockCache = jasmine.createSpyObj<FirestoreCacheService>('FirestoreCacheService', ['get', 'clear', 'invalidate']);

    TestBed.configureTestingModule({
      providers: [
        TranslatorRepository,
        { provide: Database, useValue: {} },
        { provide: EdgeDataService, useValue: mockEdgeData },
        { provide: FirestoreCacheService, useValue: mockCache }
      ]
    });

    repository = TestBed.inject(TranslatorRepository);
  });

  it('throws error when shortName or name is empty on create', async () => {
    await expectAsync(repository.create('', 'Name')).toBeRejectedWithError();
    await expectAsync(repository.create('Short', '')).toBeRejectedWithError();
  });

  it('throws error when shortName or name is empty on update', async () => {
    await expectAsync(repository.update('id', '', 'Name')).toBeRejectedWithError();
    await expectAsync(repository.update('id', 'Short', '')).toBeRejectedWithError();
  });
});
