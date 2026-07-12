import { drawArrow, drawText } from '../drawing';
import type { DrawContext, FSMSelfLinkData, Selectable } from '../types';
import { NODE_RADIUS, Node } from './node';

export class SelfLink implements Selectable {
  node: Node;
  anchorAngle = 0;
  mouseOffsetAngle = 0;
  text = '';

  constructor(node: Node, mouse?: { x: number; y: number }) {
    this.node = node;
    if (mouse) this.setAnchorPoint(mouse.x, mouse.y);
  }

  setMouseStart(x: number, y: number): void {
    this.mouseOffsetAngle =
      this.anchorAngle - Math.atan2(y - this.node.y, x - this.node.x);
  }

  setAnchorPoint(x: number, y: number): void {
    this.anchorAngle =
      Math.atan2(y - this.node.y, x - this.node.x) + this.mouseOffsetAngle;
    const snap = Math.round(this.anchorAngle / (Math.PI / 2)) * (Math.PI / 2);
    if (Math.abs(this.anchorAngle - snap) < 0.1) this.anchorAngle = snap;
    if (this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
    if (this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
  }

  getEndPointsAndCircle() {
    const circleX = this.node.x + 1.5 * NODE_RADIUS * Math.cos(this.anchorAngle);
    const circleY = this.node.y + 1.5 * NODE_RADIUS * Math.sin(this.anchorAngle);
    const circleRadius = 0.75 * NODE_RADIUS;
    const startAngle = this.anchorAngle - Math.PI * 0.8;
    const endAngle = this.anchorAngle + Math.PI * 0.8;
    const startX = circleX + circleRadius * Math.cos(startAngle);
    const startY = circleY + circleRadius * Math.sin(startAngle);
    const endX = circleX + circleRadius * Math.cos(endAngle);
    const endY = circleY + circleRadius * Math.sin(endAngle);
    return {
      hasCircle: true as const,
      startX,
      startY,
      endX,
      endY,
      startAngle,
      endAngle,
      circleX,
      circleY,
      circleRadius,
    };
  }

  draw(c: DrawContext, selectedObject: unknown, caretVisible: boolean): void {
    const stuff = this.getEndPointsAndCircle();
    c.beginPath();
    c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, false);
    c.stroke();

    const textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
    const textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
    drawText(c, this.text, textX, textY, this.anchorAngle, selectedObject === this, caretVisible);

    drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);
  }

  containsPoint(x: number, y: number): boolean {
    const stuff = this.getEndPointsAndCircle();
    const dx = x - stuff.circleX;
    const dy = y - stuff.circleY;
    const distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
    return Math.abs(distance) < 6;
  }

  toData(nodes: Node[]): FSMSelfLinkData {
    return {
      type: 'SelfLink',
      node: nodes.indexOf(this.node),
      text: this.text,
      anchorAngle: this.anchorAngle,
    };
  }
}
