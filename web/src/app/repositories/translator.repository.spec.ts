import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { firstValueFrom, of } from 'rxjs';
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

  it('defaults autoPatchTool to true when omitted and preserves false', async () => {
    mockCache.get.and.returnValue(
      of([
        { id: 't1', shortName: 'A', name: 'Team A', modTool: 'ToolA' },
        { id: 't2', shortName: 'B', name: 'Team B', modTool: 'ToolB', autoPatchTool: false }
      ])
    );

    const items = await firstValueFrom(repository.watchAll());
    expect(items.find((item) => item.id === 't1')?.autoPatchTool).toBeTrue();
    expect(items.find((item) => item.id === 't2')?.autoPatchTool).toBeFalse();
  });
});
