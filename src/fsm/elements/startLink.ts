import { drawArrow, drawStartStateDot, drawText } from '../drawing';
import type { DrawContext, FSMStartLinkData, Selectable } from '../types';
import { Node } from './node';

export class StartLink implements Selectable {
  node: Node;
  deltaX = 0;
  deltaY = 0;
  text = '';

  constructor(node: Node, start?: { x: number; y: number }) {
    this.node = node;
    if (start) this.setAnchorPoint(start.x, start.y);
  }

  setMouseStart(_x: number, _y: number): void {}

  setAnchorPoint(x: number, y: number): void {
    this.deltaX = x - this.node.x;
    this.deltaY = y - this.node.y;

    if (Math.abs(this.deltaX) < 6) this.deltaX = 0;
    if (Math.abs(this.deltaY) < 6) this.deltaY = 0;
  }

  getEndPoints() {
    const startX = this.node.x + this.deltaX;
    const startY = this.node.y + this.deltaY;
    const end = this.node.closestPointOnCircle(startX, startY);
    return { startX, startY, endX: end.x, endY: end.y };
  }

  draw(c: DrawContext, selectedObject: unknown, caretVisible: boolean): void {
    const stuff = this.getEndPoints();
    drawStartStateDot(c, stuff.startX, stuff.startY);

    c.beginPath();
    c.moveTo(stuff.startX, stuff.startY);
    c.lineTo(stuff.endX, stuff.endY);
    c.stroke();

    const textAngle = Math.atan2(stuff.startY - stuff.endY, stuff.startX - stuff.endX);
    drawText(c, this.text, stuff.startX, stuff.startY, textAngle, selectedObject === this, caretVisible);

    drawArrow(c, stuff.endX, stuff.endY, Math.atan2(-this.deltaY, -this.deltaX));
  }

  containsPoint(x: number, y: number): boolean {
    const stuff = this.getEndPoints();
    const dx = stuff.endX - stuff.startX;
    const dy = stuff.endY - stuff.startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
    const distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
    return percent > 0 && percent < 1 && Math.abs(distance) < 6;
  }

  toData(nodes: Node[]): FSMStartLinkData {
    return {
      type: 'StartLink',
      node: nodes.indexOf(this.node),
      text: this.text,
      deltaX: this.deltaX,
      deltaY: this.deltaY,
    };
  }
}
