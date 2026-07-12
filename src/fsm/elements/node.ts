import { drawCenteredText, drawText } from '../drawing';
import type { DrawContext, FSMNodeData } from '../types';

export const NODE_RADIUS = 30;

export class Node {
  x: number;
  y: number;
  mouseOffsetX = 0;
  mouseOffsetY = 0;
  isAcceptState = false;
  isStartState = false;
  text = '';
  attr2 = '';

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setMouseStart(x: number, y: number): void {
    this.mouseOffsetX = this.x - x;
    this.mouseOffsetY = this.y - y;
  }

  setAnchorPoint(x: number, y: number): void {
    this.x = x + this.mouseOffsetX;
    this.y = y + this.mouseOffsetY;
  }

  hasAttribute(): boolean {
    return this.attr2.trim().length > 0;
  }

  draw(c: DrawContext, selectedObject: unknown, caretVisible: boolean): void {
    c.beginPath();
    c.arc(this.x, this.y, NODE_RADIUS, 0, 2 * Math.PI, false);
    c.stroke();

    const labelY = this.hasAttribute() ? this.y - 8 : this.y;
    drawText(c, this.text, this.x, labelY, null, selectedObject === this, caretVisible);

    if (this.hasAttribute()) {
      drawCenteredText(
        c,
        this.attr2.trim(),
        this.x,
        this.y + 18,
        '14px "Times New Roman", serif',
      );
    }

    if (this.isAcceptState) {
      c.beginPath();
      c.arc(this.x, this.y, NODE_RADIUS - 6, 0, 2 * Math.PI, false);
      c.stroke();
    }
  }

  closestPointOnCircle(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    const scale = Math.sqrt(dx * dx + dy * dy);
    return {
      x: this.x + (dx * NODE_RADIUS) / scale,
      y: this.y + (dy * NODE_RADIUS) / scale,
    };
  }

  containsPoint(x: number, y: number): boolean {
    return (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y) < NODE_RADIUS * NODE_RADIUS;
  }

  toData(): FSMNodeData {
    return {
      x: this.x,
      y: this.y,
      text: this.text,
      isAcceptState: this.isAcceptState,
      attr2: this.attr2,
      isStartState: this.isStartState,
    };
  }
}

export function applyNodeData(node: Node, data: FSMNodeData): void {
  node.x = data.x;
  node.y = data.y;
  node.text = data.text;
  node.isAcceptState = data.isAcceptState;
  node.attr2 = data.attr2 ?? '';
  node.isStartState = data.isStartState ?? false;
}
