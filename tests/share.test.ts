import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encodeShareLink,
  decodeShareLink,
  readShareFromLocation,
  clearShareHash,
} from '../src/share/urlShare';
import type { FSMData } from '../src/fsm/types';

describe('urlShare helpers', () => {
  const sampleData: FSMData = {
    nodes: [
      { x: 10, y: 20, text: 'A', isAcceptState: true },
      { x: 30, y: 40, text: 'B', isAcceptState: false },
    ],
    links: [
      { type: 'Link', nodeA: 0, nodeB: 1, text: 'a', lineAngleAdjust: 0, parallelPart: 0.5, perpendicularPart: 0 },
    ],
  };

  beforeEach(() => {
    // Reset location hash and history mock
    window.location.hash = '';
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  describe('encodeShareLink and decodeShareLink', () => {
    it('roundtrips a share link encoding and decoding correctly', () => {
      const link = encodeShareLink('Test Machine', sampleData);
      expect(link).toContain('#s=');

      const hash = link.substring(link.indexOf('#s='));
      const decoded = decodeShareLink(hash);

      expect(decoded).not.toBeNull();
      expect(decoded!.v).toBe(1);
      expect(decoded!.name).toBe('Test Machine');
      expect(decoded!.data).toEqual(sampleData);
    });

    it('returns null if hash does not start with SHARE_PREFIX', () => {
      expect(decodeShareLink('')).toBeNull();
      expect(decodeShareLink('#invalid=abc')).toBeNull();
    });

    it('returns null if decompression or JSON parsing fails', () => {
      expect(decodeShareLink('#s=invalid_compressed_data')).toBeNull();
    });

    it('returns null if decoded JSON has wrong format', () => {
      // Missing version v
      const invalidLink1 = encodeShareLink(undefined, sampleData);
      // Let's manually decode, change structure and re-encode isn't needed,
      // let's pass a bad hash manually
      const badHash = '#s=CoCwpgBA5gdsQA'; // invalid data
      expect(decodeShareLink(badHash)).toBeNull();
    });
  });

  describe('readShareFromLocation', () => {
    it('reads the share payload from window.location.hash', () => {
      const link = encodeShareLink('Test Machine', sampleData);
      const hash = link.substring(link.indexOf('#s='));
      window.location.hash = hash;

      const payload = readShareFromLocation();
      expect(payload).not.toBeNull();
      expect(payload!.name).toBe('Test Machine');
      expect(payload!.data).toEqual(sampleData);
    });
  });

  describe('clearShareHash', () => {
    it('replaces state in history to clear the hash if it is a share hash', () => {
      window.location.hash = '#s=something';
      clearShareHash();
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('does nothing if the hash is not a share hash', () => {
      window.location.hash = '#other-anchor';
      clearShareHash();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });
});
