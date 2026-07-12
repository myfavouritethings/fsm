import type { FSMData, FSMLinkData, FSMNodeData } from '../fsm/types';

export interface FSMExportDocument {
  version: 1;
  name: string;
  exportedAt: string;
  data: FSMData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeData(value: unknown): value is FSMNodeData {
  if (!isRecord(value)) return false;
  if (
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.text !== 'string' ||
    typeof value.isAcceptState !== 'boolean'
  ) {
    return false;
  }
  if (value.attr2 !== undefined && typeof value.attr2 !== 'string') return false;
  if (value.isStartState !== undefined && typeof value.isStartState !== 'boolean') return false;
  return true;
}

function isLinkData(value: unknown): value is FSMLinkData {
  if (!isRecord(value) || typeof value.text !== 'string' || typeof value.type !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'SelfLink':
      return typeof value.node === 'number' && typeof value.anchorAngle === 'number';
    case 'StartLink':
      return (
        typeof value.node === 'number' &&
        typeof value.deltaX === 'number' &&
        typeof value.deltaY === 'number'
      );
    case 'Link':
      return (
        typeof value.nodeA === 'number' &&
        typeof value.nodeB === 'number' &&
        typeof value.lineAngleAdjust === 'number' &&
        typeof value.parallelPart === 'number' &&
        typeof value.perpendicularPart === 'number'
      );
    default:
      return false;
  }
}

function isFSMData(value: unknown): value is FSMData {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) {
    return false;
  }
  return value.nodes.every(isNodeData) && value.links.every(isLinkData);
}

export function validateFSMData(data: FSMData): string | null {
  for (const link of data.links) {
    const nodeCount = data.nodes.length;
    if (link.type === 'SelfLink' || link.type === 'StartLink') {
      if (link.node < 0 || link.node >= nodeCount) {
        return `Invalid link: node index ${link.node} is out of range.`;
      }
    } else if (link.type === 'Link') {
      if (link.nodeA < 0 || link.nodeA >= nodeCount || link.nodeB < 0 || link.nodeB >= nodeCount) {
        return `Invalid link: node indices ${link.nodeA}, ${link.nodeB} are out of range.`;
      }
    }
  }
  return null;
}

export interface ParsedImport {
  name: string;
  data: FSMData;
}

export function parseImportJson(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (!isRecord(parsed)) {
    throw new Error('JSON must be an object.');
  }

  let name = 'Imported FSM';
  let data: FSMData | null = null;

  if (parsed.version === 1 && isFSMData(parsed.data)) {
    if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim();
    data = parsed.data;
  } else if (parsed.v === 1 && isFSMData(parsed.data)) {
    if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim();
    data = parsed.data;
  } else if (isFSMData(parsed)) {
    data = parsed;
  } else if (isFSMData(parsed.data)) {
    if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim();
    data = parsed.data;
  } else {
    throw new Error('Unrecognized FSM JSON format.');
  }

  const validationError = validateFSMData(data);
  if (validationError) throw new Error(validationError);

  return { name, data };
}

export function createExportDocument(name: string, data: FSMData): FSMExportDocument {
  return {
    version: 1,
    name,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function serializeExportDocument(doc: FSMExportDocument): string {
  return JSON.stringify(doc, null, 2);
}
