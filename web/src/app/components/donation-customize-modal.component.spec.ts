import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DonationCustomizeModalComponent } from './donation-customize-modal.component';
import { DonationRepository } from '../repositories/donation.repository';
import { CoverStorageService } from '../services/cover-storage.service';
import { ImageProcessorService } from '../services/image-processor.service';
import { AuthService } from '../services/auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { Donation } from '../models/donation.models';

describe('DonationCustomizeModalComponent', () => {
  let fixture: ComponentFixture<DonationCustomizeModalComponent>;
  let component: DonationCustomizeModalComponent;

  const mockDonation: Donation = {
    id: 'don_test_1',
    amount: 1000,
    donatedAt: new Date().toISOString()
  };

  const mockDonationRepo = {
    updateDonorProfile: jasmine.createSpy('updateDonorProfile').and.returnValue(Promise.resolve())
  };

  const mockCoverStorage = {
    upload: jasmine.createSpy('upload').and.returnValue(Promise.resolve('https://r2.example.com/don_test_1.webp'))
  };

  const mockImageProcessor = {
    process: jasmine.createSpy('process').and.returnValue(
      Promise.resolve({
        blob: new Blob(['fake-image'], { type: 'image/webp' }),
        width: 600,
        height: 450,
        filename: 'cover_max600px_12345.webp',
        cleanRawBlob: new Blob()
      })
    )
  };

  const mockAuthService = {
    user: signal<{ uid: string; email: string } | null>({ uid: 'user_456', email: 'donor@example.com' }),
    isAdmin: signal(false)
  };

  const mockStatusMessage = {
    show: jasmine.createSpy('show')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DonationCustomizeModalComponent],
      providers: [
        { provide: DonationRepository, useValue: mockDonationRepo },
        { provide: CoverStorageService, useValue: mockCoverStorage },
        { provide: ImageProcessorService, useValue: mockImageProcessor },
        { provide: AuthService, useValue: mockAuthService },
        { provide: StatusMessageService, useValue: mockStatusMessage }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DonationCustomizeModalComponent);
    component = fixture.componentInstance;
    component.donation = mockDonation;
    fixture.detectChanges();
  });

  it('should create customization modal component', () => {
    expect(component).toBeTruthy();
  });

  it('should reject submission when donor name is empty', async () => {
    (component as any).donorName.set('');
    await (component as any).submit();
    expect((component as any).errorMessage()).toContain('กรุณาระบุชื่อผู้บริจาค');
    expect(mockDonationRepo.updateDonorProfile).not.toHaveBeenCalled();
  });

  it('should reject submission when donor name exceeds 400 characters', async () => {
    (component as any).donorName.set('A'.repeat(401));
    await (component as any).submit();
    expect((component as any).errorMessage()).toContain('ไม่เกิน 400 ตัวอักษร');
    expect(mockDonationRepo.updateDonorProfile).not.toHaveBeenCalled();
  });

  it('should process image and submit with uploaded image URL', async () => {
    (component as any).donorName.set('คุณใจดี มีสุข');
    
    // Simulate file selection
    const mockFile = new File(['dummy'], 'photo.png', { type: 'image/png' });
    const event = { target: { files: [mockFile] } } as unknown as Event;
    await (component as any).onFileSelected(event);

    expect(mockImageProcessor.process).toHaveBeenCalledWith(mockFile, 0.9, 600);
    expect((component as any).previewUrl()).toBeTruthy();

    // Spy on saved event
    spyOn(component.saved, 'emit');

    await (component as any).submit();

    expect(mockCoverStorage.upload).toHaveBeenCalledWith(
      'don_test_1',
      jasmine.any(Blob),
      'cover_max600px_12345.webp'
    );
    expect(mockDonationRepo.updateDonorProfile).toHaveBeenCalledWith(
      'don_test_1',
      'คุณใจดี มีสุข',
      'https://r2.example.com/don_test_1.webp',
      'user_456',
      false
    );
    expect(component.saved.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 'don_test_1',
      donorName: 'คุณใจดี มีสุข',
      imageUrl: 'https://r2.example.com/don_test_1.webp',
      isCustomized: true
    }));
  });

  it('should emit closed when close is called', () => {
    spyOn(component.closed, 'emit');
    (component as any).close();
    expect(component.closed.emit).toHaveBeenCalled();
  });
});
