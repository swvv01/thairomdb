export type BrowseRouteKind = 'system' | 'translator' | 'tag' | 'rom' | 'today' | 'week' | 'walkthrough' | 'port' | 'library';

export function normalizeBrowseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function browseSlug(value: string): string {
  return encodeURIComponent(normalizeBrowseName(value));
}

export function browseRoute(kind: BrowseRouteKind, value = ''): string {
  if (kind === 'system') return `/system?system=${encodeURIComponent(normalizeBrowseName(value))}`;
  if (kind === 'translator') return `/translator?translator=${encodeURIComponent(normalizeBrowseName(value))}`;
  if (kind === 'rom') return '/rom';
  if (kind === 'walkthrough') return '/walkthrough';
  if (kind === 'port') return '/port';
  if (kind === 'library') return '/library';
  return `/${kind}/${browseSlug(value)}`;
}

export function isPortMasterSystem(system: string | null | undefined): boolean {
  const s = (system ?? '').trim().toLowerCase();
  return s === 'port' || s === 'portmaster' || s === 'port master';
}
