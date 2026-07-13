import { describe, it, expect } from 'vitest';
import { convertLatexShortcuts, textToXML } from '../src/fsm/text';

describe('text helpers', () => {
  describe('convertLatexShortcuts', () => {
    it('converts LaTeX greek letter names to unicode characters', () => {
      // Test some uppercase greek letters
      expect(convertLatexShortcuts('\\Alpha')).toBe('Α');
      expect(convertLatexShortcuts('\\Beta')).toBe('Β');
      expect(convertLatexShortcuts('\\Gamma')).toBe('Γ');
      expect(convertLatexShortcuts('\\Omega')).toBe('Ω');

      // Test some lowercase greek letters
      expect(convertLatexShortcuts('\\alpha')).toBe('α');
      expect(convertLatexShortcuts('\\beta')).toBe('β');
      expect(convertLatexShortcuts('\\gamma')).toBe('γ');
      expect(convertLatexShortcuts('\\omega')).toBe('ω');
    });

    it('converts underscores followed by numbers to subscript unicode characters', () => {
      expect(convertLatexShortcuts('q_0')).toBe('q₀');
      expect(convertLatexShortcuts('S_1_2')).toBe('S₁₂');
      expect(convertLatexShortcuts('q_9')).toBe('q₉');
    });

    it('handles mixed content correctly', () => {
      expect(convertLatexShortcuts('q_0 \\cup \\Sigma_1')).toBe('q₀ \\cup Σ₁');
    });
  });

  describe('textToXML', () => {
    it('escapes standard XML special characters', () => {
      expect(textToXML('a & b')).toBe('a &amp; b');
      expect(textToXML('a < b')).toBe('a &lt; b');
      expect(textToXML('a > b')).toBe('a &gt; b');
      expect(textToXML('a <&> b')).toBe('a &lt;&amp;&gt; b');
    });

    it('replaces non-ASCII/special characters with numeric character references', () => {
      expect(textToXML('α')).toBe('&#945;');
      expect(textToXML('q₀')).toBe('q&#8320;');
    });

    it('leaves safe printable ASCII characters alone', () => {
      const safe = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890 -_+=/\\?';
      expect(textToXML(safe)).toBe(safe);
    });
  });
});
