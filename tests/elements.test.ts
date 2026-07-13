import { describe, it, expect } from 'vitest';
import { Node, applyNodeData, NODE_RADIUS } from '../src/fsm/elements/node';
import { Link } from '../src/fsm/elements/link';
import { SelfLink } from '../src/fsm/elements/selfLink';
import { StartLink } from '../src/fsm/elements/startLink';
import { TemporaryLink } from '../src/fsm/elements/temporaryLink';
import type { DrawContext } from '../src/fsm/types';

function createMockContext() {
  return {
    fillStyle: 'black',
    strokeStyle: 'black',
    lineWidth: 1,
    font: '10px sans-serif',
    calls: [] as { name: string; args: any[] }[],
    beginPath() { this.calls.push({ name: 'beginPath', args: [] }); },
    arc(...args: any[]) { this.calls.push({ name: 'arc', args }); },
    moveTo(...args: any[]) { this.calls.push({ name: 'moveTo', args }); },
    lineTo(...args: any[]) { this.calls.push({ name: 'lineTo', args }); },
    stroke() { this.calls.push({ name: 'stroke', args: [] }); },
    fill() { this.calls.push({ name: 'fill', args: [] }); },
    measureText(text: string) {
      this.calls.push({ name: 'measureText', args: [text] });
      return { width: text.length * 10 } as TextMetrics;
    },
    fillText(...args: any[]) { this.calls.push({ name: 'fillText', args }); },
    translate(...args: any[]) { this.calls.push({ name: 'translate', args }); },
    save() { this.calls.push({ name: 'save', args: [] }); },
    restore() { this.calls.push({ name: 'restore', args: [] }); },
    clearRect(...args: any[]) { this.calls.push({ name: 'clearRect', args }); },
  };
}

describe('FSM Canvas Elements', () => {
  describe('Node', () => {
    it('creates, snaps mouse drag offset, and updates anchor point', () => {
      const node = new Node(100, 200);
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);

      node.setMouseStart(110, 205);
      expect(node.mouseOffsetX).toBe(-10);
      expect(node.mouseOffsetY).toBe(-5);

      node.setAnchorPoint(300, 400);
      expect(node.x).toBe(290);
      expect(node.y).toBe(395);
    });

    it('identifies attributes and converts to data payload', () => {
      const node = new Node(100, 200);
      expect(node.hasAttribute()).toBe(false);
      node.attr2 = 'Even';
      expect(node.hasAttribute()).toBe(true);

      const data = node.toData();
      expect(data).toEqual({
        x: 100,
        y: 200,
        text: '',
        isAcceptState: false,
        attr2: 'Even',
        isStartState: false,
      });
    });

    it('applies node data details', () => {
      const node = new Node(0, 0);
      applyNodeData(node, {
        x: 50,
        y: 60,
        text: 'q0',
        isAcceptState: true,
        attr2: 'Odd',
        isStartState: true,
      });

      expect(node.x).toBe(50);
      expect(node.y).toBe(60);
      expect(node.text).toBe('q0');
      expect(node.isAcceptState).toBe(true);
      expect(node.attr2).toBe('Odd');
      expect(node.isStartState).toBe(true);
    });

    it('containsPoint correctly identifies selection hits', () => {
      const node = new Node(100, 100);
      // NODE_RADIUS = 30. Distance check: (x-100)^2 + (y-100)^2 < 900
      expect(node.containsPoint(100, 100)).toBe(true);
      expect(node.containsPoint(120, 120)).toBe(true); // distance = sqrt(800) < 30
      expect(node.containsPoint(130, 100)).toBe(false); // distance = 30
      expect(node.containsPoint(140, 100)).toBe(false);
    });

    it('calculates the closest point on the node boundary', () => {
      const node = new Node(100, 100);
      const boundary = node.closestPointOnCircle(100, 200);
      expect(boundary.x).toBe(100);
      expect(boundary.y).toBe(130); // 100 + NODE_RADIUS(30)
    });

    it('draws itself onto mock canvas context', () => {
      const c = createMockContext();
      const node = new Node(100, 100);
      node.text = 'q0';
      node.isAcceptState = true;
      node.attr2 = 'Even';

      node.draw(c as unknown as DrawContext, null, false);
      expect(c.calls.some(call => call.name === 'arc')).toBe(true);
      expect(c.calls.some(call => call.name === 'stroke')).toBe(true);
    });
  });

  describe('Link', () => {
    it('sets correct coordinates and updates anchor point', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);

      expect(link.getAnchorPoint()).toEqual({ x: 150, y: 100 });

      // Move anchor point down by 50px
      // dx = 100, dy = 0, scale = 100
      // parallelPart = (100 * 50 + 0 * 50) / 10000 = 0.5
      // perpendicularPart = (100 * 50 - 0 * 50) / 100 = 50
      link.setAnchorPoint(150, 150);
      expect(link.parallelPart).toBe(0.5);
      expect(link.perpendicularPart).toBe(50);

      // Snap logic: if parallelPart is 0..1 and perpendicularPart < snapToPadding (6), snaps perpendicularPart to 0
      link.setAnchorPoint(150, 103); // perp = 3
      expect(link.perpendicularPart).toBe(0);
    });

    it('gets end points for straight links (perpendicularPart = 0)', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);

      const ep = link.getEndPointsAndCircle();
      expect(ep.hasCircle).toBe(false);
      expect(ep.startX).toBe(130); // 100 + NODE_RADIUS
      expect(ep.endX).toBe(170); // 200 - NODE_RADIUS
    });

    it('gets end points for curved links (perpendicularPart != 0)', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);
      link.perpendicularPart = 20;

      const ep = link.getEndPointsAndCircle();
      expect(ep.hasCircle).toBe(true);
      expect(ep.startX).toBeGreaterThan(100);
      expect(ep.endX).toBeLessThan(200);
    });

    it('containsPoint correctly checks straight line and arc hits', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);

      // Straight line from x=130 to x=170 at y=100
      expect(link.containsPoint(150, 100)).toBe(true);
      expect(link.containsPoint(150, 103)).toBe(true); // within padding 6
      expect(link.containsPoint(150, 110)).toBe(false);

      // Curved line check
      link.perpendicularPart = 30;
      // Anchor is at (150, 130) or (150, 70)
      // Let's test checking point near curve path
      const ep = link.getEndPointsAndCircle();
      expect(ep.hasCircle).toBe(true);
      // Test hitting near the center of the arc
      expect(link.containsPoint(ep.circleX, ep.circleY + ep.circleRadius)).toBe(true);
    });

    it('draws itself onto mock context', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);

      const c = createMockContext();
      link.draw(c as unknown as DrawContext, null, false);
      expect(c.calls.some(call => call.name === 'moveTo')).toBe(true);

      // Curved link draw
      link.perpendicularPart = 20;
      const c2 = createMockContext();
      link.draw(c2 as unknown as DrawContext, null, false);
      expect(c2.calls.some(call => call.name === 'arc')).toBe(true);
    });

    it('converts to correct data format', () => {
      const nodeA = new Node(100, 100);
      const nodeB = new Node(200, 100);
      const link = new Link(nodeA, nodeB);
      link.text = 'abc';

      const data = link.toData([nodeA, nodeB]);
      expect(data).toEqual({
        type: 'Link',
        nodeA: 0,
        nodeB: 1,
        text: 'abc',
        lineAngleAdjust: 0,
        parallelPart: 0.5,
        perpendicularPart: 0,
      });
    });
  });

  describe('SelfLink', () => {
    it('sets initial anchor point, handles snapping, and adjusts rotation angles', () => {
      const node = new Node(100, 100);
      const link = new SelfLink(node, { x: 100, y: 50 }); // Above

      expect(link.anchorAngle).toBeCloseTo(-Math.PI / 2);

      // setAnchorPoint adjustments
      link.setAnchorPoint(200, 100); // Right
      expect(link.anchorAngle).toBeCloseTo(0);

      // Boundaries checks
      link.mouseOffsetAngle = Math.PI;
      link.setAnchorPoint(100, 200); // Down => atan2 = PI/2, total = 3*PI/2 => -PI/2
      expect(link.anchorAngle).toBeCloseTo(-Math.PI / 2);
    });

    it('containsPoint correctly calculates circle target distance', () => {
      const node = new Node(100, 100);
      const link = new SelfLink(node, { x: 100, y: 50 }); // Anchor angle -PI/2

      const ep = link.getEndPointsAndCircle();
      // Circle is at x = 100, y = 100 + 1.5 * 30 * sin(-PI/2) = 55
      // Radius is 0.75 * 30 = 22.5
      expect(link.containsPoint(100, 32.5)).toBe(true); // circle border (55 - 22.5)
      expect(link.containsPoint(100, 55)).toBe(false); // circle center
    });

    it('draws itself and converts to data format', () => {
      const node = new Node(100, 100);
      const link = new SelfLink(node);
      link.text = 'a';

      const c = createMockContext();
      link.draw(c as unknown as DrawContext, null, false);
      expect(c.calls.some(call => call.name === 'arc')).toBe(true);

      const data = link.toData([node]);
      expect(data).toEqual({
        type: 'SelfLink',
        node: 0,
        text: 'a',
        anchorAngle: 0,
      });
    });
  });

  describe('StartLink', () => {
    it('handles snaps for delta coordinate drag offsets', () => {
      const node = new Node(100, 100);
      const link = new StartLink(node);

      link.setAnchorPoint(50, 100); // deltaX = -50, deltaY = 0
      expect(link.deltaX).toBe(-50);
      expect(link.deltaY).toBe(0);

      link.setAnchorPoint(97, 103); // deltaX = -3, deltaY = 3
      expect(link.deltaX).toBe(0); // snapped
      expect(link.deltaY).toBe(0); // snapped
    });

    it('returns boundary end coordinates', () => {
      const node = new Node(100, 100);
      const link = new StartLink(node);
      link.deltaX = -50;
      link.deltaY = 0;

      const ep = link.getEndPoints();
      expect(ep.startX).toBe(50);
      expect(ep.startY).toBe(100);
      expect(ep.endX).toBe(70); // closestPointOnCircle: 100 - NODE_RADIUS(30)
      expect(ep.endY).toBe(100);
    });

    it('checks mouse inclusion, draws, and exports storage payload', () => {
      const node = new Node(100, 100);
      const link = new StartLink(node);
      link.deltaX = -50;
      link.text = 'start';

      expect(link.containsPoint(60, 100)).toBe(true);
      expect(link.containsPoint(60, 108)).toBe(false);

      const c = createMockContext();
      link.draw(c as unknown as DrawContext, null, false);
      expect(c.calls.some(call => call.name === 'lineTo')).toBe(true);

      const data = link.toData([node]);
      expect(data).toEqual({
        type: 'StartLink',
        node: 0,
        text: 'start',
        deltaX: -50,
        deltaY: 0,
      });
    });
  });

  describe('TemporaryLink', () => {
    it('initializes and draws connecting segment on canvas', () => {
      const link = new TemporaryLink({ x: 10, y: 20 }, { x: 30, y: 40 });
      expect(link.from).toEqual({ x: 10, y: 20 });
      expect(link.to).toEqual({ x: 30, y: 40 });

      const c = createMockContext();
      link.draw(c as unknown as DrawContext);
      expect(c.calls.some(call => call.name === 'moveTo')).toBe(true);
      expect(c.calls.some(call => call.name === 'lineTo')).toBe(true);
    });
  });
});
