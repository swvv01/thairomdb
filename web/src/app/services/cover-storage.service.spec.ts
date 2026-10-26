import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Auth } from '@angular/fire/auth';
import { CoverStorageService } from './cover-storage.service';
import { RepositoryError } from '../repositories/repository-error';
import { environment } from '../../environments/environment';

describe('CoverStorageService', () => {
  let service: CoverStorageService;
  let httpMock: HttpTestingController;
  let mockAuth: any;

  beforeEach(() => {
    mockAuth = {
      currentUser: {
        getIdToken: jasmine.createSpy('getIdToken').and.resolveTo('fake-token')
      }
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CoverStorageService,
        { provide: Auth, useValue: mockAuth }
      ]
    });

    service = TestBed.inject(CoverStorageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('rejects upload when patchId is empty', async () => {
    const blob = new Blob(['img'], { type: 'image/webp' });
    await expectAsync(service.upload('', blob, 'cover_max250px_123456.webp'))
      .toBeRejectedWith(jasmine.any(RepositoryError));
  });

  it('rejects upload when mime type is not webp or png', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await expectAsync(service.upload('patch-1', blob, 'cover_max250px_123456.jpg'))
      .toBeRejectedWith(jasmine.any(RepositoryError));
  });

  it('rejects upload when filename pattern does not match', async () => {
    const blob = new Blob(['img'], { type: 'image/webp' });
    await expectAsync(service.upload('patch-1', blob, 'invalid-name.webp'))
      .toBeRejectedWith(jasmine.any(RepositoryError));
  });

  it('accepts webp upload and posts to workerUrl', async () => {
    const blob = new Blob(['img'], { type: 'image/webp' });
    const filename = 'cover_max250px_123456.webp';

    const uploadPromise = service.upload('patch-1', blob, filename);

    const req = httpMock.expectOne(`${environment.r2?.workerUrl}/upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({ url: 'https://r2.dev/covers/patch-1.webp' });

    const url = await uploadPromise;
    expect(url).toBe('https://r2.dev/covers/patch-1.webp');
  });

  it('accepts png upload for backwards compatibility', async () => {
    const blob = new Blob(['img'], { type: 'image/png' });
    const filename = 'cover_max250px_123456.png';

    const uploadPromise = service.upload('patch-1', blob, filename);

    const req = httpMock.expectOne(`${environment.r2?.workerUrl}/upload`);
    expect(req.request.method).toBe('POST');
    req.flush({ url: 'https://r2.dev/covers/patch-1.png' });

    const url = await uploadPromise;
    expect(url).toBe('https://r2.dev/covers/patch-1.png');
  });
});
