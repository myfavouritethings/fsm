import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FSMEditor } from '../src/fsm/editor';
import { Node } from '../src/fsm/elements/node';
import { Link } from '../src/fsm/elements/link';
import { StartLink } from '../src/fsm/elements/startLink';
import { SelfLink } from '../src/fsm/elements/selfLink';
import type { FSMData } from '../src/fsm/types';

describe('FSMEditor', () => {
  let canvas: HTMLCanvasElement;
  let onChangeSpy: any;
  let onSelectionChangeSpy: any;
  let editor: FSMEditor;

  beforeEach(() => {
    // Setup DOM canvas with fake bounds
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    onChangeSpy = vi.fn();
    onSelectionChangeSpy = vi.fn();

    // Mock caret blinking interval
    vi.useFakeTimers();

    editor = new FSMEditor(canvas, onChangeSpy, onSelectionChangeSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Data import and export', () => {
    it('initializes with empty structures', () => {
      expect(editor.nodes).toEqual([]);
      expect(editor.links).toEqual([]);
    });

    it('loads and exports FSM data structures correctly', () => {
      const data: FSMData = {
        nodes: [
          { x: 100, y: 100, text: 'q0', isAcceptState: false, attr2: '', isStartState: true },
          { x: 200, y: 100, text: 'q1', isAcceptState: true, attr2: 'Even', isStartState: false },
        ],
        links: [
          { type: 'StartLink', node: 0, deltaX: -90, deltaY: 0, text: 'start' },
          { type: 'Link', nodeA: 0, nodeB: 1, text: 'a', lineAngleAdjust: 0, parallelPart: 0.5, perpendicularPart: 0 },
          { type: 'SelfLink', node: 1, text: 'b', anchorAngle: Math.PI / 2 },
        ],
      };

      editor.loadData(data);

      expect(editor.nodes).toHaveLength(2);
      expect(editor.links).toHaveLength(3);

      expect(editor.nodes[0].isStartState).toBe(true);
      expect(editor.nodes[1].isAcceptState).toBe(true);

      const exported = editor.getData();
      // start state link types and fields should match
      expect(exported.nodes[1].attr2).toBe('Even');
      expect(exported.links[1].type).toBe('Link');
    });

    it('clears editor data correctly', () => {
      editor.loadData({
        nodes: [{ x: 100, y: 100, text: 'q', isAcceptState: false }],
        links: [],
      });
      expect(editor.nodes).toHaveLength(1);

      editor.clear();
      expect(editor.nodes).toHaveLength(0);
    });
  });

  describe('Selection and modifications', () => {
    it('returns selected node or null', () => {
      const node = new Node(100, 100);
      editor.nodes.push(node);

      expect(editor.getSelectedNode()).toBeNull();

      editor.selectedObject = node;
      expect(editor.getSelectedNode()).toBe(node);

      const link = new Link(node, node);
      editor.selectedObject = link;
      expect(editor.getSelectedNode()).toBeNull(); // Link is not a Node
    });

    it('updates selected node properties and redraws', () => {
      const node = new Node(100, 100);
      editor.nodes.push(node);
      editor.selectedObject = node;

      editor.updateSelectedNode({
        text: 'newText',
        attr2: 'Odd',
        isAcceptState: true,
        isStartState: true,
      });

      expect(node.text).toBe('newText');
      expect(node.attr2).toBe('Odd');
      expect(node.isAcceptState).toBe(true);
      expect(node.isStartState).toBe(true);
      expect(onChangeSpy).toHaveBeenCalled();
    });

    it('manages setStartState constraints and links', () => {
      const node1 = new Node(100, 100);
      const node2 = new Node(200, 200);
      editor.nodes = [node1, node2];

      // Enable start state for node1
      editor.setStartState(node1, true);
      expect(node1.isStartState).toBe(true);
      expect(node2.isStartState).toBe(false);
      // Automatically creates a StartLink
      expect(editor.links.some(l => l instanceof StartLink && l.node === node1)).toBe(true);

      // Shift start state to node2
      editor.setStartState(node2, true);
      expect(node1.isStartState).toBe(false);
      expect(node2.isStartState).toBe(true);
      expect(editor.links.some(l => l instanceof StartLink && l.node === node2)).toBe(true);
      expect(editor.links.some(l => l instanceof StartLink && l.node === node1)).toBe(false);

      // Disable start state altogether
      editor.setStartState(node2, false);
      expect(node2.isStartState).toBe(false);
      expect(editor.links.some(l => l instanceof StartLink)).toBe(false);
    });
  });

  describe('Canvas snap calculations', () => {
    it('snaps coordinates to neighboring nodes', () => {
      const node1 = new Node(100, 100);
      const node2 = new Node(200, 104); // Y diff is 4px (< snapToPadding=6)
      editor.nodes = [node1, node2];

      // Snap node2 to node1
      // @ts-ignore calling private method
      editor.snapNode(node2);
      expect(node2.y).toBe(100); // Snapped
    });
  });

  describe('Mouse gestures and user flows', () => {
    it('double click creates state nodes and toggles accept state', () => {
      // Dbl click empty space
      const dblClickEmpty = new MouseEvent('dblclick', { clientX: 150, clientY: 150 });
      canvas.dispatchEvent(dblClickEmpty);

      expect(editor.nodes).toHaveLength(1);
      expect(editor.nodes[0].x).toBe(150);
      expect(editor.nodes[0].y).toBe(150);

      // Dbl click node to toggle accept state
      const dblClickNode = new MouseEvent('dblclick', { clientX: 150, clientY: 150 });
      canvas.dispatchEvent(dblClickNode);
      expect(editor.nodes[0].isAcceptState).toBe(true);

      canvas.dispatchEvent(dblClickNode);
      expect(editor.nodes[0].isAcceptState).toBe(false);
    });

    it('mousedown, mousemove, mouseup drag-creates regular links between nodes', () => {
      const node1 = new Node(100, 100);
      const node2 = new Node(200, 100);
      editor.nodes = [node1, node2];

      // Enable shift key inside editor
      editor.shift = true;

      // Mouse down on node 1
      const md = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      canvas.dispatchEvent(md);
      expect(editor.selectedObject).toBe(node1);

      // Drag to node 2
      const mm = new MouseEvent('mousemove', { clientX: 200, clientY: 100 });
      canvas.dispatchEvent(mm);
      expect(editor.currentLink).toBeInstanceOf(Link);

      // Mouse up on node 2
      const mu = new MouseEvent('mouseup', { clientX: 200, clientY: 100 });
      canvas.dispatchEvent(mu);

      expect(editor.links).toHaveLength(1);
      expect(editor.links[0]).toBeInstanceOf(Link);
      expect((editor.links[0] as Link).nodeA).toBe(node1);
      expect((editor.links[0] as Link).nodeB).toBe(node2);
    });

    it('mousedown, mousemove, mouseup shift-drag creates start links from empty space', () => {
      const node1 = new Node(100, 100);
      editor.nodes = [node1];

      editor.shift = true;

      // Mouse down empty space
      const md = new MouseEvent('mousedown', { clientX: 30, clientY: 100 });
      canvas.dispatchEvent(md);

      // Mouse move onto node1
      const mm = new MouseEvent('mousemove', { clientX: 100, clientY: 100 });
      canvas.dispatchEvent(mm);
      expect(editor.currentLink).toBeInstanceOf(StartLink);

      // Mouse up
      const mu = new MouseEvent('mouseup', { clientX: 100, clientY: 100 });
      canvas.dispatchEvent(mu);

      expect(editor.links).toHaveLength(1);
      expect(editor.links[0]).toBeInstanceOf(StartLink);
    });

    it('mousedown, mousemove, mouseup shift-drag on same node creates self links', () => {
      const node1 = new Node(100, 100);
      editor.nodes = [node1];

      editor.shift = true;

      const md = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      canvas.dispatchEvent(md);

      const mm = new MouseEvent('mousemove', { clientX: 100, clientY: 70 });
      canvas.dispatchEvent(mm);
      expect(editor.currentLink).toBeInstanceOf(SelfLink);

      const mu = new MouseEvent('mouseup', { clientX: 100, clientY: 70 });
      canvas.dispatchEvent(mu);

      expect(editor.links).toHaveLength(1);
      expect(editor.links[0]).toBeInstanceOf(SelfLink);
    });

    it('standard dragging moves state coordinates', () => {
      const node1 = new Node(100, 100);
      editor.nodes = [node1];

      // Mouse down on node
      const md = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      canvas.dispatchEvent(md);
      expect(editor.movingObject).toBe(true);

      // Drag
      const mm = new MouseEvent('mousemove', { clientX: 150, clientY: 180 });
      canvas.dispatchEvent(mm);
      expect(node1.x).toBe(150);
      expect(node1.y).toBe(180);

      // Mouse up
      const mu = new MouseEvent('mouseup');
      canvas.dispatchEvent(mu);
      expect(editor.movingObject).toBe(false);
    });
  });

  describe('Keyboard hotkeys', () => {
    it('sets shift state on shift key press', () => {
      const kd = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(kd);
      expect(editor.shift).toBe(true);

      const ku = new KeyboardEvent('keyup', { key: 'Shift' });
      document.dispatchEvent(ku);
      expect(editor.shift).toBe(false);
    });

    it('deletes selected nodes and associated links on Delete', () => {
      const node1 = new Node(100, 100);
      const node2 = new Node(200, 100);
      const link = new Link(node1, node2);
      editor.nodes = [node1, node2];
      editor.links = [link];

      editor.selectedObject = node1;

      const kd = new KeyboardEvent('keydown', { key: 'Delete' });
      document.dispatchEvent(kd);

      expect(editor.nodes).toEqual([node2]);
      expect(editor.links).toEqual([]); // Associated link deleted
      expect(editor.selectedObject).toBeNull();
    });

    it('modifies selected element text on keypress/backspace', () => {
      const node = new Node(100, 100);
      editor.nodes = [node];
      editor.selectedObject = node;

      // Mock canvasHasFocus
      Object.defineProperty(document, 'activeElement', { value: document.body, configurable: true });

      // Keypress 'a'
      const kp = new KeyboardEvent('keypress', { key: 'a', keyCode: 97, which: 97 });
      document.dispatchEvent(kp);
      expect(node.text).toBe('a');

      // Keypress 'b'
      const kp2 = new KeyboardEvent('keypress', { key: 'b', keyCode: 98, which: 98 });
      document.dispatchEvent(kp2);
      expect(node.text).toBe('ab');

      // Backspace
      const kd = new KeyboardEvent('keydown', { key: 'Backspace' });
      document.dispatchEvent(kd);
      expect(node.text).toBe('a');
    });

    it('handles Enter key without errors', () => {
      const node = new Node(100, 100);
      editor.nodes = [node];
      editor.selectedObject = node;

      const kd = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(() => document.dispatchEvent(kd)).not.toThrow();
    });
  });

  describe('Exports and size triggers', () => {
    it('exports SVG, LaTeX, and trigger PNG download', async () => {
      editor.loadData({
        nodes: [{ x: 10, y: 10, text: 'q', isAcceptState: false }],
        links: [],
      });

      const svg = editor.exportSvg();
      expect(svg).toContain('<svg');

      const latex = editor.exportLatex();
      expect(latex).toContain('tikzpicture');

      // exportPng
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob-url'),
        revokeObjectURL: vi.fn(),
      });
      const canvasMock = editor.canvas;
      canvasMock.toBlob = vi.fn((cb) => cb(new Blob(['png'])));

      await expect(editor.exportPng('fsm.png')).resolves.not.toThrow();
      vi.unstubAllGlobals();
    });

    it('updates canvas size and redraws', () => {
      editor.setCanvasSize(1200, 800);
      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(800);
      expect(onChangeSpy).toHaveBeenCalled();
    });
  });
});
