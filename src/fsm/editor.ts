import { canvasHasFocus } from './drawing';
import { Link } from './elements/link';
import { applyNodeData, Node } from './elements/node';
import { SelfLink } from './elements/selfLink';
import { StartLink } from './elements/startLink';
import { TemporaryLink } from './elements/temporaryLink';
import { ExportAsLaTeX } from './export/latex';
import { downloadPngFromCanvas, downloadSvg } from './export/download';
import { ExportAsSVG } from './export/svg';
import type { DrawContext, FSMData } from './types';

type AnyLink = Link | SelfLink | StartLink;
type FSMObject = Node | AnyLink;

export class FSMEditor {
  canvas: HTMLCanvasElement;
  nodes: Node[] = [];
  links: AnyLink[] = [];
  selectedObject: FSMObject | null = null;
  currentLink: TemporaryLink | AnyLink | null = null;
  movingObject = false;
  shift = false;
  caretVisible = true;

  private caretTimer: ReturnType<typeof setInterval> | null = null;
  private originalClick = { x: 0, y: 0 };
  private onChange: () => void;
  private onSelectionChange: () => void;

  constructor(canvas: HTMLCanvasElement, onChange: () => void, onSelectionChange: () => void) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.onSelectionChange = onSelectionChange;
    this.bindEvents();
  }

  getData(): FSMData {
    return {
      nodes: this.nodes.map((n) => n.toData()),
      links: this.links.map((l) => l.toData(this.nodes)),
    };
  }

  loadData(data: FSMData): void {
    this.nodes = [];
    this.links = [];
    this.selectedObject = null;
    this.currentLink = null;

    for (const nodeData of data.nodes) {
      const node = new Node(nodeData.x, nodeData.y);
      applyNodeData(node, nodeData);
      this.nodes.push(node);
    }

    for (const linkData of data.links) {
      let link: AnyLink | null = null;
      if (linkData.type === 'SelfLink') {
        link = new SelfLink(this.nodes[linkData.node]);
        link.anchorAngle = linkData.anchorAngle;
        link.text = linkData.text;
      } else if (linkData.type === 'StartLink') {
        link = new StartLink(this.nodes[linkData.node]);
        link.deltaX = linkData.deltaX;
        link.deltaY = linkData.deltaY;
        link.text = linkData.text;
      } else if (linkData.type === 'Link') {
        link = new Link(this.nodes[linkData.nodeA], this.nodes[linkData.nodeB]);
        link.parallelPart = linkData.parallelPart;
        link.perpendicularPart = linkData.perpendicularPart;
        link.text = linkData.text;
        link.lineAngleAdjust = linkData.lineAngleAdjust;
      }
      if (link) this.links.push(link);
    }

    this.syncStartStateFromLinks();
    this.ensureStartLinksForMarkedNodes();
    this.draw();
  }

  getSelectedNode(): Node | null {
    return this.selectedObject instanceof Node ? this.selectedObject : null;
  }

  updateSelectedNode(updates: {
    text?: string;
    attr2?: string;
    isAcceptState?: boolean;
    isStartState?: boolean;
  }): void {
    const node = this.getSelectedNode();
    if (!node) return;

    if (updates.text !== undefined) node.text = updates.text;
    if (updates.attr2 !== undefined) node.attr2 = updates.attr2;
    if (updates.isAcceptState !== undefined) node.isAcceptState = updates.isAcceptState;
    if (updates.isStartState !== undefined) this.setStartState(node, updates.isStartState);

    this.draw();
  }

  setStartState(node: Node, enabled: boolean): void {
    if (enabled) {
      for (const other of this.nodes) {
        other.isStartState = other === node;
      }
      this.ensureStartLink(node);
    } else {
      node.isStartState = false;
      this.links = this.links.filter((link) => !(link instanceof StartLink && link.node === node));
    }
    this.draw();
  }

  private syncStartStateFromLinks(): void {
    const startLinks = this.links.filter((link): link is StartLink => link instanceof StartLink);
    if (startLinks.length === 0) return;

    for (const node of this.nodes) node.isStartState = false;
    startLinks[0].node.isStartState = true;
  }

  private ensureStartLinksForMarkedNodes(): void {
    const startNode = this.nodes.find((node) => node.isStartState);
    if (startNode) this.ensureStartLink(startNode);
  }

  private ensureStartLink(node: Node): void {
    this.links = this.links.filter((link) => !(link instanceof StartLink && link.node !== node));

    let startLink = this.links.find(
      (link): link is StartLink => link instanceof StartLink && link.node === node,
    );

    if (!startLink) {
      startLink = new StartLink(node);
      startLink.deltaX = -90;
      startLink.deltaY = 0;
      this.links.push(startLink);
    }
  }

  private notifySelectionChange(): void {
    this.onSelectionChange();
  }

  private notifyTextChange(): void {
    this.onSelectionChange();
  }

  clear(): void {
    this.loadData({ nodes: [], links: [] });
  }

  draw(): void {
    this.drawUsing(this.canvas.getContext('2d')! as unknown as DrawContext);
    this.onChange();
  }

  drawUsing(c: DrawContext): void {
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.save();
    c.translate(0.5, 0.5);

    for (const node of this.nodes) {
      c.lineWidth = 1;
      c.fillStyle = c.strokeStyle = node === this.selectedObject ? 'blue' : 'black';
      node.draw(c, this.selectedObject, this.caretVisible);
    }

    for (const link of this.links) {
      c.lineWidth = 1;
      c.fillStyle = c.strokeStyle = link === this.selectedObject ? 'blue' : 'black';
      link.draw(c, this.selectedObject, this.caretVisible);
    }

    if (this.currentLink instanceof TemporaryLink) {
      c.lineWidth = 1;
      c.fillStyle = c.strokeStyle = 'black';
      this.currentLink.draw(c);
    } else if (this.currentLink) {
      c.lineWidth = 1;
      c.fillStyle = c.strokeStyle = 'black';
      this.currentLink.draw(c, this.selectedObject, this.caretVisible);
    }

    c.restore();
  }

  exportSvg(): string {
    const exporter = new ExportAsSVG();
    const oldSelected = this.selectedObject;
    this.selectedObject = null;
    this.drawUsing(exporter);
    this.selectedObject = oldSelected;
    return exporter.toSVG(this.canvas.width, this.canvas.height);
  }

  exportLatex(): string {
    const exporter = new ExportAsLaTeX();
    const oldSelected = this.selectedObject;
    this.selectedObject = null;
    this.drawUsing(exporter);
    this.selectedObject = oldSelected;
    return exporter.toLaTeX();
  }

  async exportPng(filename: string): Promise<void> {
    const oldSelected = this.selectedObject;
    this.selectedObject = null;
    this.drawUsing(this.canvas.getContext('2d')! as unknown as DrawContext);
    this.selectedObject = oldSelected;
    const svg = this.exportSvg();
    await downloadPngFromCanvas(this.canvas, filename, svg);
    this.draw();
  }

  exportSvgFile(filename: string): void {
    downloadSvg(this.exportSvg(), filename);
  }

  setCanvasSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.draw();
  }

  private resetCaret(): void {
    if (this.caretTimer) clearInterval(this.caretTimer);
    this.caretTimer = setInterval(() => {
      this.caretVisible = !this.caretVisible;
      this.drawUsing(this.canvas.getContext('2d')! as unknown as DrawContext);
    }, 500);
    this.caretVisible = true;
  }

  private selectObject(x: number, y: number): FSMObject | null {
    for (const node of this.nodes) {
      if (node.containsPoint(x, y)) return node;
    }
    for (const link of this.links) {
      if (link.containsPoint(x, y)) return link;
    }
    return null;
  }

  private snapNode(node: Node): void {
    const snapToPadding = 6;
    for (const other of this.nodes) {
      if (other === node) continue;
      if (Math.abs(node.x - other.x) < snapToPadding) node.x = other.x;
      if (Math.abs(node.y - other.y) < snapToPadding) node.y = other.y;
    }
  }

  private relativeMousePos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      const mouse = this.relativeMousePos(e);
      this.selectedObject = this.selectObject(mouse.x, mouse.y);
      this.movingObject = false;
      this.originalClick = mouse;

      if (this.selectedObject) {
        if (this.shift && this.selectedObject instanceof Node) {
          this.currentLink = new SelfLink(this.selectedObject, mouse);
        } else {
          this.movingObject = true;
          this.selectedObject.setMouseStart?.(mouse.x, mouse.y);
        }
        this.resetCaret();
      } else if (this.shift) {
        this.currentLink = new TemporaryLink(mouse, mouse);
      }

      this.notifySelectionChange();
      this.draw();

      if (canvasHasFocus()) {
        e.preventDefault();
      } else {
        this.resetCaret();
      }
    });

    this.canvas.addEventListener('dblclick', (e) => {
      const mouse = this.relativeMousePos(e);
      this.selectedObject = this.selectObject(mouse.x, mouse.y);

      if (!this.selectedObject) {
        this.selectedObject = new Node(mouse.x, mouse.y);
        this.nodes.push(this.selectedObject);
        this.resetCaret();
        this.notifySelectionChange();
        this.draw();
      } else if (this.selectedObject instanceof Node) {
        this.selectedObject.isAcceptState = !this.selectedObject.isAcceptState;
        this.notifySelectionChange();
        this.draw();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const mouse = this.relativeMousePos(e);

      if (this.currentLink) {
        const targetNode = this.selectObject(mouse.x, mouse.y);
        const target = targetNode instanceof Node ? targetNode : null;

        if (!this.selectedObject) {
          this.currentLink = target
            ? new StartLink(target, this.originalClick)
            : new TemporaryLink(this.originalClick, mouse);
        } else if (this.selectedObject instanceof Node) {
          if (target === this.selectedObject) {
            this.currentLink = new SelfLink(this.selectedObject, mouse);
          } else if (target) {
            this.currentLink = new Link(this.selectedObject, target);
          } else {
            this.currentLink = new TemporaryLink(
              this.selectedObject.closestPointOnCircle(mouse.x, mouse.y),
              mouse,
            );
          }
        }
        this.draw();
      }

      if (this.movingObject && this.selectedObject) {
        this.selectedObject.setAnchorPoint(mouse.x, mouse.y);
        if (this.selectedObject instanceof Node) this.snapNode(this.selectedObject);
        this.draw();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.movingObject = false;

      if (this.currentLink && !(this.currentLink instanceof TemporaryLink)) {
        this.selectedObject = this.currentLink;
        this.links.push(this.currentLink);
        if (this.currentLink instanceof StartLink) {
          for (const node of this.nodes) {
            node.isStartState = node === this.currentLink.node;
          }
          this.ensureStartLink(this.currentLink.node);
        }
        this.resetCaret();
      }
      this.currentLink = null;
      this.notifySelectionChange();
      this.draw();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.shift = true;
      else if (!canvasHasFocus()) return;
      else if (e.key === 'Backspace') {
        if (this.selectedObject) {
          this.selectedObject.text = this.selectedObject.text.slice(0, -1);
          this.resetCaret();
          this.notifyTextChange();
          this.draw();
        }
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (this.selectedObject instanceof Node) {
          this.notifyTextChange();
        }
        e.preventDefault();
      } else if (e.key === 'Delete') {
        if (this.selectedObject) {
          this.nodes = this.nodes.filter((n) => n !== this.selectedObject);
          this.links = this.links.filter(
            (l) =>
              l !== this.selectedObject &&
              !('node' in l && l.node === this.selectedObject) &&
              !('nodeA' in l &&
                (l.nodeA === this.selectedObject || l.nodeB === this.selectedObject)),
          );
          this.selectedObject = null;
          this.notifySelectionChange();
          this.draw();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.shift = false;
    });

    document.addEventListener('keypress', (e) => {
      if (!canvasHasFocus()) return;
      const key = e.keyCode || e.which;
      if (
        key >= 0x20 &&
        key <= 0x7e &&
        !e.metaKey &&
        !e.altKey &&
        !e.ctrlKey &&
        this.selectedObject
      ) {
        this.selectedObject.text += String.fromCharCode(key);
        this.resetCaret();
        this.notifyTextChange();
        this.draw();
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
      }
    });
  }
}
