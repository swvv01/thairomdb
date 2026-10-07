export interface Translator {
  id: string;
  shortName: string;
  name: string;
  modTool?: string;
  link?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface SystemMaster {
  id: string;
  shortName: string;
  name: string;
}

export interface Patch {
  id: string;
  updateDate: string;
  haveUpdateFlag: boolean;
  patchVersion: string;
  playTime?: number | null;
  playTimeFull?: number | null;
  gameTitle: string;
  system: string;
  translatorId: string;
  translatedBy: string;
  patchTool: string;
  tags: string[];
  coverUrl: string;
  patchFileUrl: string;
  patchedRomUrl: string;
  referenceText: string;
  referenceUrl: string;
  walkthroughUrl: string;
}

export interface AdminProfile {
  uid: string;
  email: string;
}

export type PatchDraft = Omit<Patch, 'id' | 'translatedBy' | 'coverUrl'>;

export interface ProcessedCover {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

export type GameListSortField = 'gameTitle' | 'translatedBy' | 'system' | 'updateDate' | 'playTime';
export type SortDirection = 'asc' | 'desc';

export interface GameListFilters {
  keyword: string;
  tag: string | null;
  translatorId: string | null;
  system: string | null;
  sortBy: GameListSortField;
  sortDirection: SortDirection;
}
