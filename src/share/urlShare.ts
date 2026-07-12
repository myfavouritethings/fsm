import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { FSMData } from '../fsm/types';

export interface SharePayload {
  v: 1;
  name?: string;
  data: FSMData;
}

const SHARE_PREFIX = '#s=';

export function encodeShareLink(name: string | undefined, data: FSMData): string {
  const payload: SharePayload = { v: 1, name, data };
  const compressed = compressToEncodedURIComponent(JSON.stringify(payload));
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}${SHARE_PREFIX}${compressed}`;
}

export function decodeShareLink(hash: string): SharePayload | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  try {
    const compressed = hash.slice(SHARE_PREFIX.length);
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    const payload = JSON.parse(json) as SharePayload;
    if (payload.v !== 1 || !payload.data?.nodes) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readShareFromLocation(): SharePayload | null {
  return decodeShareLink(window.location.hash);
}

export function clearShareHash(): void {
  if (window.location.hash.startsWith(SHARE_PREFIX)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
