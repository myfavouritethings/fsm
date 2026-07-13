export interface FSMNodeData {
  x: number;
  y: number;
  text: string;
  isAcceptState: boolean;
  attr2?: string;
  isStartState?: boolean;
}

export interface FSMLinkDataBase {
  text: string;
}

export interface FSMSelfLinkData extends FSMLinkDataBase {
  type: 'SelfLink';
  node: number;
  anchorAngle: number;
}

export interface FSMStartLinkData extends FSMLinkDataBase {
  type: 'StartLink';
  node: number;
  deltaX: number;
  deltaY: number;
}

export interface FSMRegularLinkData extends FSMLinkDataBase {
  type: 'Link';
  nodeA: number;
  nodeB: number;
  lineAngleAdjust: number;
  parallelPart: number;
  perpendicularPart: number;
}

export type FSMLinkData = FSMSelfLinkData | FSMStartLinkData | FSMRegularLinkData;

export interface FSMData {
  nodes: FSMNodeData[];
  links: FSMLinkData[];
}

export interface StoredFSM {
  id: string;
  name: string;
  updatedAt: number;
  data: FSMData;
}

export interface StorageSchema {
  version: 1;
  machines: StoredFSM[];
  activeId: string | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  beginPath(): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    isReversed?: boolean,
  ): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fill(): void;
  measureText(text: string): TextMetrics;
  fillText(text: string, x: number, y: number): void;
  translate(x: number, y: number): void;
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  advancedFillText?(
    text: string,
    originalText: string,
    x: number,
    y: number,
    angleOrNull: number | null,
  ): void;
}

export interface Selectable {
  text: string;
  containsPoint(x: number, y: number): boolean;
  setMouseStart?(x: number, y: number): void;
  setAnchorPoint(x: number, y: number): void;
}
