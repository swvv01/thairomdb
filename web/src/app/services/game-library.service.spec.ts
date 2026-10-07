import { TestBed } from '@angular/core/testing';
import { GameLibraryService } from './game-library.service';
import { Database } from '@angular/fire/database';
import { AuthService } from './auth.service';
import { StatusMessageService } from '../shared/status-message.service';
import { signal } from '@angular/core';

describe('GameLibraryService', () => {
  let service: GameLibraryService;
  const mockUserSignal = signal<any>(null);
  const mockVipSignal = signal<boolean>(false);

  const mockDatabase = {};
  const mockAuthService = {
    user: mockUserSignal,
    isVip: mockVipSignal
  };
  const mockStatusMessageService = {
    show: jasmine.createSpy('show')
  };

  beforeEach(() => {
    window.localStorage.clear();
    mockUserSignal.set(null);
    mockVipSignal.set(false);

    TestBed.configureTestingModule({
      providers: [
        GameLibraryService,
        { provide: Database, useValue: mockDatabase },
        { provide: AuthService, useValue: mockAuthService },
        { provide: StatusMessageService, useValue: mockStatusMessageService }
      ]
    });

    service = TestBed.inject(GameLibraryService);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('should initialize with empty library', () => {
    expect(service.libraryCount()).toBe(0);
    expect(service.isInLibrary('patch-1')).toBeFalse();
  });

  it('should add game to guest localStorage when guest', async () => {
    await service.addToLibrary('patch-1', 'Dragon Quest');

    expect(service.isInLibrary('patch-1')).toBeTrue();
    expect(service.libraryCount()).toBe(1);

    const stored = window.localStorage.getItem('thairomdb_guest_library');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toContain('patch-1');
  });

  it('should remove game from guest localStorage', async () => {
    await service.addToLibrary('patch-1', 'Dragon Quest');
    expect(service.isInLibrary('patch-1')).toBeTrue();

    await service.removeFromLibrary('patch-1', 'Dragon Quest');
    expect(service.isInLibrary('patch-1')).toBeFalse();
    expect(service.libraryCount()).toBe(0);

    const stored = window.localStorage.getItem('thairomdb_guest_library');
    expect(JSON.parse(stored!)).not.toContain('patch-1');
  });

  it('should toggle game status in library', async () => {
    const added = await service.toggleLibrary('patch-1', 'Chrono Trigger');
    expect(added).toBeTrue();
    expect(service.isInLibrary('patch-1')).toBeTrue();

    const removed = await service.toggleLibrary('patch-1', 'Chrono Trigger');
    expect(removed).toBeFalse();
    expect(service.isInLibrary('patch-1')).toBeFalse();
  });
});
