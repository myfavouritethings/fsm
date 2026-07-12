import { drawArrow } from '../drawing';
import type { DrawContext } from '../types';

export class TemporaryLink {
  from: { x: number; y: number };
  to: { x: number; y: number };

  constructor(from: { x: number; y: number }, to: { x: number; y: number }) {
    this.from = from;
    this.to = to;
  }

  draw(c: DrawContext): void {
    c.beginPath();
    c.moveTo(this.to.x, this.to.y);
    c.lineTo(this.from.x, this.from.y);
    c.stroke();
    drawArrow(c, this.to.x, this.to.y, Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x));
  }
}
