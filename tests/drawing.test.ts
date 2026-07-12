import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawStartStateDot, drawArrow, canvasHasFocus, drawCenteredText, drawText } from '../src/fsm/drawing';
import type { DrawContext } from '../src/fsm/types';

function createMockContext() {
  return {
    fillStyle: 'black',
    strokeStyle: 'black',
    lineWidth: 1,
    font: '10px sans-serif',
    calls: [] as { name: string; args: any[] }[],
    beginPath() {
      this.calls.push({ name: 'beginPath', args: [] });
    },
    arc(x: number, y: number, r: number, sa: number, ea: number, rev?: boolean) {
      this.calls.push({ name: 'arc', args: [x, y, r, sa, ea, rev] });
    },
    moveTo(x: number, y: number) {
      this.calls.push({ name: 'moveTo', args: [x, y] });
    },
    lineTo(x: number, y: number) {
      this.calls.push({ name: 'lineTo', args: [x, y] });
    },
    stroke() {
      this.calls.push({ name: 'stroke', args: [] });
    },
    fill() {
      this.calls.push({ name: 'fill', args: [] });
    },
    measureText(text: string) {
      this.calls.push({ name: 'measureText', args: [text] });
      return { width: text.length * 10 } as TextMetrics;
    },
    fillText(text: string, x: number, y: number) {
      this.calls.push({ name: 'fillText', args: [text, x, y] });
    },
    translate(x: number, y: number) {
      this.calls.push({ name: 'translate', args: [x, y] });
    },
    save() {
      this.calls.push({ name: 'save', args: [] });
    },
    restore() {
      this.calls.push({ name: 'restore', args: [] });
    },
    clearRect(x: number, y: number, w: number, h: number) {
      this.calls.push({ name: 'clearRect', args: [x, y, w, h] });
    },
  };
}

describe('drawing helpers', () => {
  describe('drawStartStateDot', () => {
    it('draws a filled circle using stroke color', () => {
      const c = createMockContext();
      c.strokeStyle = 'red';
      c.fillStyle = 'blue';

      drawStartStateDot(c as unknown as DrawContext, 10, 20);

      expect(c.calls[0]).toEqual({ name: 'beginPath', args: [] });
      expect(c.calls[1].name).toBe('arc');
      expect(c.calls[1].args[0]).toBe(10);
      expect(c.calls[1].args[1]).toBe(20);
      expect(c.calls[1].args[2]).toBe(5);
      expect(c.calls[2]).toEqual({ name: 'fill', args: [] });
      expect(c.fillStyle).toBe('blue'); // Restored original fillStyle
    });
  });

  describe('drawArrow', () => {
    it('draws a filled arrow pointing in a specific angle', () => {
      const c = createMockContext();
      drawArrow(c as unknown as DrawContext, 50, 60, Math.PI / 2); // pointing down

      expect(c.calls[0]).toEqual({ name: 'beginPath', args: [] });
      expect(c.calls[1]).toEqual({ name: 'moveTo', args: [50, 60] });
      // Math.cos(PI/2) = 0, Math.sin(PI/2) = 1
      // lineTo(50 - 8*0 + 5*1, 60 - 8*1 - 5*0) -> lineTo(55, 52)
      // lineTo(50 - 8*0 - 5*1, 60 - 8*1 + 5*0) -> lineTo(45, 52)
      expect(c.calls[2].name).toBe('lineTo');
      expect(c.calls[2].args[0]).toBeCloseTo(55);
      expect(c.calls[2].args[1]).toBeCloseTo(52);
      expect(c.calls[3].name).toBe('lineTo');
      expect(c.calls[3].args[0]).toBeCloseTo(45);
      expect(c.calls[3].args[1]).toBeCloseTo(52);
      expect(c.calls[4]).toEqual({ name: 'fill', args: [] });
    });
  });

  describe('canvasHasFocus', () => {
    it('returns true when body has focus', () => {
      // By default in jsdom activeElement is body
      expect(canvasHasFocus()).toBe(true);
    });

    it('returns false when another element is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      expect(canvasHasFocus()).toBe(false);

      input.blur();
      document.body.removeChild(input);
    });
  });

  describe('drawCenteredText', () => {
    it('sets the font and draws centered text', () => {
      const c = createMockContext();
      drawCenteredText(c as unknown as DrawContext, 'hello', 100, 200, '20px Arial');

      expect(c.font).toBe('20px Arial');
      expect(c.calls[0]).toEqual({ name: 'measureText', args: ['hello'] });
      // width of 'hello' is 5 * 10 = 50 in our mock
      // Math.round(100 - 50/2) = 75
      expect(c.calls[1]).toEqual({ name: 'fillText', args: ['hello', 75, 200] });
    });
  });

  describe('drawText', () => {
    it('renders text with local caret checking and default styling', () => {
      const c = createMockContext();
      drawText(
        c as unknown as DrawContext,
        'S_0',
        100,
        200,
        null,
        false,
        false
      );

      expect(c.font).toBe('20px "Times New Roman", serif');
      expect(c.calls[0]).toEqual({ name: 'measureText', args: ['S₀'] }); // 'S_0' replaced with 'S₀'
      // width of 'S₀' is 2 * 10 = 20 in our mock
      // x = 100 - 20/2 = 90
      // y + 6 = 206
      expect(c.calls[1]).toEqual({ name: 'fillText', args: ['S₀', 90, 206] });
    });

    it('handles angle adjustments for arrows/links', () => {
      const c = createMockContext();
      // Test drawing with an angle
      drawText(
        c as unknown as DrawContext,
        'q',
        100,
        200,
        0, // angle 0 (cos=1, sin=0)
        false,
        false
      );

      expect(c.calls[0]).toEqual({ name: 'measureText', args: ['q'] });
      // width of 'q' is 10. x -= 5 => 95.
      // angleOrNull != null: cos=1, sin=0.
      // cornerPointX = (10/2 + 5) * 1 = 10. cornerPointY = (10+5)*-1 = -15
      // slide = 0*cornerPointX - 1*1*-15 = 15
      // x += 10 - 0*15 = 10 => x = 95 + 10 = 105
      // y += -15 + 1*15 = 0 => y = 200
      expect(c.calls[1].name).toBe('fillText');
      expect(c.calls[1].args[0]).toBe('q');
      expect(c.calls[1].args[1]).toBe(105);
      expect(c.calls[1].args[2]).toBe(206);
    });

    it('renders caret when object is selected, caret is visible, and document/canvas has focus', () => {
      const c = createMockContext();
      // Mock document focus
      const origHasFocus = document.hasFocus;
      document.hasFocus = () => true;

      // Ensure activeElement is body
      expect(document.activeElement).toBe(document.body);

      drawText(
        c as unknown as DrawContext,
        'text',
        100,
        200,
        null,
        true, // isSelected
        true  // caretVisible
      );

      // calls should have fillText and then beginPath, moveTo, lineTo, stroke for caret
      expect(c.calls.some(call => call.name === 'beginPath')).toBe(true);
      expect(c.calls.some(call => call.name === 'stroke')).toBe(true);

      document.hasFocus = origHasFocus;
    });

    it('delegates to advancedFillText if present', () => {
      const c = createMockContext() as any;
      c.advancedFillText = vi.fn();

      drawText(
        c as unknown as DrawContext,
        'adv',
        100,
        200,
        null,
        false,
        false
      );

      expect(c.advancedFillText).toHaveBeenCalledWith('adv', 'adv', 100, 200, null);
      // It should not call fillText
      expect(c.calls.some(call => call.name === 'fillText')).toBe(false);
    });
  });
});
