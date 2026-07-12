import type { DrawContext } from './types';
import { convertLatexShortcuts } from './text';

export function drawStartStateDot(c: DrawContext, x: number, y: number): void {
  c.beginPath();
  c.arc(x, y, 5, 0, 2 * Math.PI, false);
  const fillStyle = c.fillStyle;
  c.fillStyle = c.strokeStyle;
  c.fill();
  c.fillStyle = fillStyle;
}

export function drawArrow(c: DrawContext, x: number, y: number, angle: number): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
  c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
  c.fill();
}

export function canvasHasFocus(): boolean {
  return (document.activeElement || document.body) === document.body;
}

export function drawCenteredText(
  c: DrawContext,
  originalText: string,
  x: number,
  y: number,
  font: string,
): void {
  const text = convertLatexShortcuts(originalText);
  c.font = font;
  const width = c.measureText(text).width;
  c.fillText(text, Math.round(x - width / 2), Math.round(y));
}

export function drawText(
  c: DrawContext,
  originalText: string,
  x: number,
  y: number,
  angleOrNull: number | null,
  isSelected: boolean,
  caretVisible: boolean,
): void {
  const text = convertLatexShortcuts(originalText);
  c.font = '20px "Times New Roman", serif';
  const width = c.measureText(text).width;

  x -= width / 2;

  if (angleOrNull != null) {
    const cos = Math.cos(angleOrNull);
    const sin = Math.sin(angleOrNull);
    const cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
    const cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
    const slide =
      sin * Math.pow(Math.abs(sin), 40) * cornerPointX -
      cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
    x += cornerPointX - sin * slide;
    y += cornerPointY + cos * slide;
  }

  if ('advancedFillText' in c && c.advancedFillText) {
    c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
  } else {
    x = Math.round(x);
    y = Math.round(y);
    c.fillText(text, x, y + 6);
    if (isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
      const caretX = x + width;
      c.beginPath();
      c.moveTo(caretX, y - 10);
      c.lineTo(caretX, y + 10);
      c.stroke();
    }
  }
}
