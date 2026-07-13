import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadStorage,
  saveStorage,
  createMachine,
  upsertMachine,
  deleteMachine,
  getMachine,
  migrateLegacyStorage,
} from '../src/storage/localStore';
import type { StorageSchema } from '../src/fsm/types';

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
    });
  });

  describe('loadStorage and saveStorage', () => {
    it('returns empty storage if nothing is saved', () => {
      const storage = loadStorage();
      expect(storage).toEqual({ version: 1, machines: [], activeId: null });
    });

    it('saves and loads storage schema correctly', () => {
      const schema: StorageSchema = {
        version: 1,
        machines: [
          {
            id: 'm1',
            name: 'Machine 1',
            updatedAt: 12345,
            data: { nodes: [], links: [] },
          },
        ],
        activeId: 'm1',
      };
      saveStorage(schema);

      const loaded = loadStorage();
      expect(loaded).toEqual(schema);
    });

    it('returns empty storage if storage contains corrupted JSON', () => {
      localStorage.setItem('fsm-designer-v1', '{corrupt json');
      const loaded = loadStorage();
      expect(loaded).toEqual({ version: 1, machines: [], activeId: null });
    });

    it('returns empty storage if version is incorrect or machines is not an array', () => {
      localStorage.setItem(
        'fsm-designer-v1',
        JSON.stringify({ version: 2, machines: [], activeId: null })
      );
      expect(loadStorage()).toEqual({ version: 1, machines: [], activeId: null });

      localStorage.setItem(
        'fsm-designer-v1',
        JSON.stringify({ version: 1, machines: 'not-an-array', activeId: null })
      );
      expect(loadStorage()).toEqual({ version: 1, machines: [], activeId: null });
    });
  });

  describe('createMachine', () => {
    it('creates a new machine with a UUID, name, and default data', () => {
      const m = createMachine('My Machine');
      expect(m.id).toBe('test-uuid-1234');
      expect(m.name).toBe('My Machine');
      expect(m.updatedAt).toBeLessThanOrEqual(Date.now());
      expect(m.data).toEqual({ nodes: [], links: [] });
    });
  });

  describe('upsertMachine', () => {
    it('inserts a new machine if it does not exist', () => {
      const schema: StorageSchema = { version: 1, machines: [], activeId: null };
      const machine = createMachine('New FSM');
      const newSchema = upsertMachine(schema, machine);

      expect(newSchema.machines).toHaveLength(1);
      expect(newSchema.machines[0]).toEqual(machine);
      expect(newSchema.activeId).toBe(machine.id);
    });

    it('updates an existing machine if ID matches', () => {
      const machine1 = {
        id: 'test-uuid-1234',
        name: 'Old Name',
        updatedAt: 100,
        data: { nodes: [], links: [] },
      };
      const schema: StorageSchema = { version: 1, machines: [machine1], activeId: 'test-uuid-1234' };

      const updatedMachine = { ...machine1, name: 'New Name', updatedAt: 200 };
      const newSchema = upsertMachine(schema, updatedMachine);

      expect(newSchema.machines).toHaveLength(1);
      expect(newSchema.machines[0].name).toBe('New Name');
      expect(newSchema.machines[0].updatedAt).toBe(200);
      expect(newSchema.activeId).toBe('test-uuid-1234');
    });
  });

  describe('deleteMachine', () => {
    it('deletes a machine by ID and clears activeId if it was the deleted machine', () => {
      const machine1 = { id: 'm1', name: 'M1', updatedAt: 100, data: { nodes: [], links: [] } };
      const machine2 = { id: 'm2', name: 'M2', updatedAt: 200, data: { nodes: [], links: [] } };
      const schema: StorageSchema = { version: 1, machines: [machine1, machine2], activeId: 'm1' };

      const newSchema = deleteMachine(schema, 'm1');
      expect(newSchema.machines).toEqual([machine2]);
      // Active ID should shift to the last machine in the list
      expect(newSchema.activeId).toBe('m2');
    });

    it('deletes a machine by ID and keeps activeId if a non-active machine was deleted', () => {
      const machine1 = { id: 'm1', name: 'M1', updatedAt: 100, data: { nodes: [], links: [] } };
      const machine2 = { id: 'm2', name: 'M2', updatedAt: 200, data: { nodes: [], links: [] } };
      const schema: StorageSchema = { version: 1, machines: [machine1, machine2], activeId: 'm2' };

      const newSchema = deleteMachine(schema, 'm1');
      expect(newSchema.machines).toEqual([machine2]);
      expect(newSchema.activeId).toBe('m2');
    });

    it('handles activeId resetting to null if all machines are deleted', () => {
      const machine1 = { id: 'm1', name: 'M1', updatedAt: 100, data: { nodes: [], links: [] } };
      const schema: StorageSchema = { version: 1, machines: [machine1], activeId: 'm1' };

      const newSchema = deleteMachine(schema, 'm1');
      expect(newSchema.machines).toEqual([]);
      expect(newSchema.activeId).toBeNull();
    });
  });

  describe('getMachine', () => {
    it('returns the machine matching the ID or undefined', () => {
      const machine1 = { id: 'm1', name: 'M1', updatedAt: 100, data: { nodes: [], links: [] } };
      const schema: StorageSchema = { version: 1, machines: [machine1], activeId: 'm1' };

      expect(getMachine(schema, 'm1')).toEqual(machine1);
      expect(getMachine(schema, 'm2')).toBeUndefined();
    });
  });

  describe('migrateLegacyStorage', () => {
    it('does nothing if legacy storage is empty', () => {
      const schema: StorageSchema = { version: 1, machines: [], activeId: null };
      const migrated = migrateLegacyStorage(schema);
      expect(migrated).toEqual(schema);
    });

    it('does nothing if machines list already has items', () => {
      const machine1 = { id: 'm1', name: 'M1', updatedAt: 100, data: { nodes: [], links: [] } };
      const schema: StorageSchema = { version: 1, machines: [machine1], activeId: 'm1' };
      localStorage.setItem('fsm', JSON.stringify({ nodes: [{ x: 1, y: 2, text: 'q0', isAcceptState: false }] }));

      const migrated = migrateLegacyStorage(schema);
      expect(migrated).toEqual(schema); // No migration happens
      expect(localStorage.getItem('fsm')).not.toBeNull(); // Legacy storage not deleted
    });

    it('migrates legacy fsm structure to schema and deletes legacy key', () => {
      const schema: StorageSchema = { version: 1, machines: [], activeId: null };
      const legacyData = {
        nodes: [{ x: 10, y: 20, text: 'A', isAcceptState: true }],
        links: [],
      };
      localStorage.setItem('fsm', JSON.stringify(legacyData));

      const migrated = migrateLegacyStorage(schema);

      expect(migrated.machines).toHaveLength(1);
      expect(migrated.machines[0].name).toBe('Imported FSM');
      expect(migrated.machines[0].data).toEqual(legacyData);
      expect(migrated.activeId).toBe('test-uuid-1234');
      expect(localStorage.getItem('fsm')).toBeNull(); // Cleaned up
    });

    it('handles legacy JSON parse errors gracefully', () => {
      const schema: StorageSchema = { version: 1, machines: [], activeId: null };
      localStorage.setItem('fsm', '{invalid json');

      const migrated = migrateLegacyStorage(schema);
      expect(migrated).toEqual(schema);
    });

    it('handles corrupt legacy schema where nodes is missing', () => {
      const schema: StorageSchema = { version: 1, machines: [], activeId: null };
      localStorage.setItem('fsm', JSON.stringify({ notNodes: [] }));

      const migrated = migrateLegacyStorage(schema);
      expect(migrated).toEqual(schema);
    });
  });
});
