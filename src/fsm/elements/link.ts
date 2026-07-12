import { drawArrow, drawText } from '../drawing';
import { circleFromThreePoints } from '../math';
import type { DrawContext, FSMRegularLinkData, Selectable } from '../types';
import { NODE_RADIUS, Node } from './node';

export class Link implements Selectable {
  nodeA: Node;
  nodeB: Node;
  text = '';
  lineAngleAdjust = 0;
  parallelPart = 0.5;
  perpendicularPart = 0;

  constructor(a: Node, b: Node) {
    this.nodeA = a;
    this.nodeB = b;
  }

  getAnchorPoint() {
    const dx = this.nodeB.x - this.nodeA.x;
    const dy = this.nodeB.y - this.nodeA.y;
    const scale = Math.sqrt(dx * dx + dy * dy);
    return {
      x: this.nodeA.x + dx * this.parallelPart - (dy * this.perpendicularPart) / scale,
      y: this.nodeA.y + dy * this.parallelPart + (dx * this.perpendicularPart) / scale,
    };
  }

  setMouseStart(_x: number, _y: number): void {}

  setAnchorPoint(x: number, y: number): void {
    const dx = this.nodeB.x - this.nodeA.x;
    const dy = this.nodeB.y - this.nodeA.y;
    const scale = Math.sqrt(dx * dx + dy * dy);
    this.parallelPart =
      (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
    this.perpendicularPart =
      (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
    if (
      this.parallelPart > 0 &&
      this.parallelPart < 1 &&
      Math.abs(this.perpendicularPart) < this.snapToPadding
    ) {
      this.lineAngleAdjust = (this.perpendicularPart < 0 ? 1 : 0) * Math.PI;
      this.perpendicularPart = 0;
    }
  }

  private get snapToPadding() {
    return 6;
  }

  getEndPointsAndCircle() {
    if (this.perpendicularPart === 0) {
      const midX = (this.nodeA.x + this.nodeB.x) / 2;
      const midY = (this.nodeA.y + this.nodeB.y) / 2;
      const start = this.nodeA.closestPointOnCircle(midX, midY);
      const end = this.nodeB.closestPointOnCircle(midX, midY);
      return {
        hasCircle: false as const,
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
      };
    }

    const anchor = this.getAnchorPoint();
    const circle = circleFromThreePoints(
      this.nodeA.x,
      this.nodeA.y,
      this.nodeB.x,
      this.nodeB.y,
      anchor.x,
      anchor.y,
    );
    const isReversed = this.perpendicularPart > 0;
    const reverseScale = isReversed ? 1 : -1;
    const startAngle =
      Math.atan2(this.nodeA.y - circle.y, this.nodeA.x - circle.x) -
      (reverseScale * NODE_RADIUS) / circle.radius;
    const endAngle =
      Math.atan2(this.nodeB.y - circle.y, this.nodeB.x - circle.x) +
      (reverseScale * NODE_RADIUS) / circle.radius;
    const startX = circle.x + circle.radius * Math.cos(startAngle);
    const startY = circle.y + circle.radius * Math.sin(startAngle);
    const endX = circle.x + circle.radius * Math.cos(endAngle);
    const endY = circle.y + circle.radius * Math.sin(endAngle);
    return {
      hasCircle: true as const,
      startX,
      startY,
      endX,
      endY,
      startAngle,
      endAngle,
      circleX: circle.x,
      circleY: circle.y,
      circleRadius: circle.radius,
      reverseScale,
      isReversed,
    };
  }

  draw(c: DrawContext, selectedObject: unknown, caretVisible: boolean): void {
    const stuff = this.getEndPointsAndCircle();
    c.beginPath();
    if (stuff.hasCircle) {
      c.arc(
        stuff.circleX,
        stuff.circleY,
        stuff.circleRadius,
        stuff.startAngle,
        stuff.endAngle,
        stuff.isReversed,
      );
    } else {
      c.moveTo(stuff.startX, stuff.startY);
      c.lineTo(stuff.endX, stuff.endY);
    }
    c.stroke();

    if (stuff.hasCircle) {
      drawArrow(
        c,
        stuff.endX,
        stuff.endY,
        stuff.endAngle - stuff.reverseScale * (Math.PI / 2),
      );
    } else {
      drawArrow(
        c,
        stuff.endX,
        stuff.endY,
        Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX),
      );
    }

    if (stuff.hasCircle) {
      let startAngle = stuff.startAngle;
      let endAngle = stuff.endAngle;
      if (endAngle < startAngle) endAngle += Math.PI * 2;
      const textAngle = (startAngle + endAngle) / 2 + (stuff.isReversed ? Math.PI : 0);
      const textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
      const textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
      drawText(c, this.text, textX, textY, textAngle, selectedObject === this, caretVisible);
    } else {
      const textX = (stuff.startX + stuff.endX) / 2;
      const textY = (stuff.startY + stuff.endY) / 2;
      const textAngle = Math.atan2(stuff.endX - stuff.startX, stuff.startY - stuff.endY);
      drawText(
        c,
        this.text,
        textX,
        textY,
        textAngle + this.lineAngleAdjust,
        selectedObject === this,
        caretVisible,
      );
    }
  }

  containsPoint(x: number, y: number): boolean {
    const stuff = this.getEndPointsAndCircle();
    const hitTargetPadding = 6;

    if (stuff.hasCircle) {
      const dx = x - stuff.circleX;
      const dy = y - stuff.circleY;
      const distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
      if (Math.abs(distance) < hitTargetPadding) {
        let angle = Math.atan2(dy, dx);
        let startAngle = stuff.startAngle;
        let endAngle = stuff.endAngle;
        if (stuff.isReversed) {
          [startAngle, endAngle] = [endAngle, startAngle];
        }
        if (endAngle < startAngle) endAngle += Math.PI * 2;
        if (angle < startAngle) angle += Math.PI * 2;
        else if (angle > endAngle) angle -= Math.PI * 2;
        return angle > startAngle && angle < endAngle;
      }
    } else {
      const dx = stuff.endX - stuff.startX;
      const dy = stuff.endY - stuff.startY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
      const distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
      return percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding;
    }
    return false;
  }

  toData(nodes: Node[]): FSMRegularLinkData {
    return {
      type: 'Link',
      nodeA: nodes.indexOf(this.nodeA),
      nodeB: nodes.indexOf(this.nodeB),
      text: this.text,
      lineAngleAdjust: this.lineAngleAdjust,
      parallelPart: this.parallelPart,
      perpendicularPart: this.perpendicularPart,
    };
  }
}
