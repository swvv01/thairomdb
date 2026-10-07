import { Patch } from '../models/patch.models';

export const MOCK_PATCHES: readonly Patch[] = [
  {
    id: 'mock-ocarina-3ds',
    updateDate: '2024-03-15T00:00:00.000Z',
    haveUpdateFlag: false,
    patchVersion: 'v1.0',
    gameTitle: 'The Legend of Zelda: Ocarina of Time 3D',
    system: '3DS',
    translatorId: 'mock-siam-quest',
    translatedBy: 'Siam Quest Team',
    patchTool: 'xDelta UI',
    tags: ['RPG', 'Adventure'],
    coverUrl: '',
    patchFileUrl: '#mock-download-ocarina',
    playTime: 30,
    playTimeFull: 45,
    patchedRomUrl: '', referenceText: '', referenceUrl: '', walkthroughUrl: ''
  },
  {
    id: 'mock-mother-gba',
    updateDate: '2024-02-15T00:00:00.000Z',
    haveUpdateFlag: false,
    patchVersion: 'v0.9',
    gameTitle: 'Mother 3',
    system: 'GBA',
    translatorId: 'mock-pixel-thai',
    translatedBy: 'Pixel Thai',
    patchTool: 'FLIPS',
    tags: ['RPG', 'Story'],
    coverUrl: '',
    patchFileUrl: '#mock-download-mother',
    playTime: 25.5,
    playTimeFull: null,
    patchedRomUrl: '', referenceText: '', referenceUrl: '', walkthroughUrl: ''
  },
  {
    id: 'mock-patapon-psp',
    updateDate: '2024-01-15T00:00:00.000Z',
    haveUpdateFlag: false,
    patchVersion: 'v1.2',
    gameTitle: 'Patapon',
    system: 'PSP',
    translatorId: 'mock-rhythm-lab',
    translatedBy: 'Rhythm Lab TH',
    patchTool: 'PPF-O-Matic',
    tags: ['Rhythm', 'Action'],
    coverUrl: '',
    patchFileUrl: '#mock-download-patapon',
    playTime: null,
    playTimeFull: null,
    patchedRomUrl: '', referenceText: '', referenceUrl: '', walkthroughUrl: ''
  }
];
