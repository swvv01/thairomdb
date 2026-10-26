import { TestBed } from '@angular/core/testing';
import { CertificateGeneratorService } from './certificate-generator.service';
import { Donation } from '../models/donation.models';

describe('CertificateGeneratorService', () => {
  let service: CertificateGeneratorService;

  const mockDonation: Donation = {
    id: 'don_test_100',
    amount: 1500,
    donatedAt: '2026-10-26T10:00:00Z',
    donorName: 'คุณผู้ทดสอบ',
    isCustomized: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CertificateGeneratorService]
    });
    service = TestBed.inject(CertificateGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should format Thai date correctly', () => {
    const formatted = service.formatThaiDate('2026-10-26T10:00:00Z');
    expect(formatted).toContain('26');
    expect(formatted).toContain('ตุลาคม');
    expect(formatted).toContain('2569');
  });

  it('should generate a PNG blob for donation', async () => {
    // Generate blob (uses HTML5 canvas)
    const blob = await service.generateCertificateBlob(mockDonation);
    expect(blob).toBeTruthy();
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should trigger browser download link', () => {
    const fakeBlob = new Blob(['test'], { type: 'image/png' });
    const appendSpy = spyOn(document.body, 'appendChild').and.callThrough();
    const removeSpy = spyOn(document.body, 'removeChild').and.callThrough();

    service.downloadBlob(fakeBlob, 'test-cert.png');

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
