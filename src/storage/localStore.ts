import type { FSMData, StorageSchema, StoredFSM } from '../fsm/types';

const STORAGE_KEY = 'fsm-designer-v1';

function emptyStorage(): StorageSchema {
  return { version: 1, machines: [], activeId: null };
}

export function loadStorage(): StorageSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStorage();
    const parsed = JSON.parse(raw) as StorageSchema;
    if (parsed.version !== 1 || !Array.isArray(parsed.machines)) return emptyStorage();
    return parsed;
  } catch {
    return emptyStorage();
  }
}

export function saveStorage(schema: StorageSchema): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
}

export function createMachine(name: string, data: FSMData = { nodes: [], links: [] }): StoredFSM {
  return {
    id: crypto.randomUUID(),
    name,
    updatedAt: Date.now(),
    data,
  };
}

export function upsertMachine(schema: StorageSchema, machine: StoredFSM): StorageSchema {
  const index = schema.machines.findIndex((m) => m.id === machine.id);
  const machines = [...schema.machines];
  if (index >= 0) machines[index] = machine;
  else machines.push(machine);
  return { ...schema, machines, activeId: machine.id };
}

export function deleteMachine(schema: StorageSchema, id: string): StorageSchema {
  const machines = schema.machines.filter((m) => m.id !== id);
  const activeId =
    schema.activeId === id ? (machines[machines.length - 1]?.id ?? null) : schema.activeId;
  return { ...schema, machines, activeId };
}

export function getMachine(schema: StorageSchema, id: string): StoredFSM | undefined {
  return schema.machines.find((m) => m.id === id);
}

export function migrateLegacyStorage(schema: StorageSchema): StorageSchema {
  try {
    const legacy = localStorage.getItem('fsm');
    if (!legacy || schema.machines.length > 0) return schema;
    const data = JSON.parse(legacy) as FSMData;
    if (!data.nodes) return schema;
    const machine = createMachine('Imported FSM', data);
    localStorage.removeItem('fsm');
    return upsertMachine(schema, machine);
  } catch {
    return schema;
  }
}
