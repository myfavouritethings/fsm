import { describe, it, expect } from 'vitest';
import {
  validateFSMData,
  parseImportJson,
  createExportDocument,
  serializeExportDocument,
} from '../src/io/json';
import type { FSMData } from '../src/fsm/types';

describe('io/json helpers', () => {
  const validFSMData: FSMData = {
    nodes: [
      { x: 10, y: 20, text: 'A', isAcceptState: false },
      { x: 30, y: 40, text: 'B', isAcceptState: true, attr2: 'Even' },
    ],
    links: [
      { type: 'Link', nodeA: 0, nodeB: 1, text: 'a', lineAngleAdjust: 0, parallelPart: 0.5, perpendicularPart: 0 },
      { type: 'SelfLink', node: 0, text: 'b', anchorAngle: 1.5 },
      { type: 'StartLink', node: 1, text: 'start', deltaX: -50, deltaY: 0 },
    ],
  };

  describe('validateFSMData', () => {
    it('returns null for valid data structure', () => {
      expect(validateFSMData(validFSMData)).toBeNull();
    });

    it('returns error if SelfLink node index is out of bounds', () => {
      const invalidData: FSMData = {
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'SelfLink', node: 1, text: 'a', anchorAngle: 0 }],
      };
      expect(validateFSMData(invalidData)).toBe('Invalid link: node index 1 is out of range.');
    });

    it('returns error if StartLink node index is out of bounds', () => {
      const invalidData: FSMData = {
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'StartLink', node: -1, text: 'a', deltaX: 0, deltaY: 0 }],
      };
      expect(validateFSMData(invalidData)).toBe('Invalid link: node index -1 is out of range.');
    });

    it('returns error if RegularLink nodeA or nodeB index is out of bounds', () => {
      const invalidDataA: FSMData = {
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'Link', nodeA: 2, nodeB: 0, text: 'a', lineAngleAdjust: 0, parallelPart: 0, perpendicularPart: 0 }],
      };
      expect(validateFSMData(invalidDataA)).toBe('Invalid link: node indices 2, 0 are out of range.');

      const invalidDataB: FSMData = {
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'Link', nodeA: 0, nodeB: -5, text: 'a', lineAngleAdjust: 0, parallelPart: 0, perpendicularPart: 0 }],
      };
      expect(validateFSMData(invalidDataB)).toBe('Invalid link: node indices 0, -5 are out of range.');
    });
  });

  describe('parseImportJson', () => {
    it('parses valid ExportDocument (version 1) format', () => {
      const doc = createExportDocument('My FSM', validFSMData);
      const text = serializeExportDocument(doc);
      const result = parseImportJson(text);

      expect(result.name).toBe('My FSM');
      expect(result.data).toEqual(validFSMData);
    });

    it('parses valid version format with alternative "v" key', () => {
      const text = JSON.stringify({
        v: 1,
        name: 'Alt Name',
        data: validFSMData,
      });
      const result = parseImportJson(text);
      expect(result.name).toBe('Alt Name');
      expect(result.data).toEqual(validFSMData);
    });

    it('parses raw FSMData format (no outer document wrapper)', () => {
      const text = JSON.stringify(validFSMData);
      const result = parseImportJson(text);
      expect(result.name).toBe('Imported FSM'); // Default name
      expect(result.data).toEqual(validFSMData);
    });

    it('parses format containing just a data field without version', () => {
      const text = JSON.stringify({
        name: 'Direct Data',
        data: validFSMData,
      });
      const result = parseImportJson(text);
      expect(result.name).toBe('Direct Data');
      expect(result.data).toEqual(validFSMData);
    });

    it('throws error for invalid JSON text', () => {
      expect(() => parseImportJson('invalid-json')).toThrow('Invalid JSON file.');
    });

    it('throws error if JSON is not an object', () => {
      expect(() => parseImportJson('"string"')).toThrow('JSON must be an object.');
      expect(() => parseImportJson('null')).toThrow('JSON must be an object.');
    });

    it('throws error for unrecognized structures', () => {
      expect(() => parseImportJson('{"unknown_key": 123}')).toThrow('Unrecognized FSM JSON format.');
    });

    it('throws error if data has validation issues', () => {
      const text = JSON.stringify({
        version: 1,
        data: {
          nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
          links: [{ type: 'SelfLink', node: 5, text: 'a', anchorAngle: 0 }],
        },
      });
      expect(() => parseImportJson(text)).toThrow('Invalid link: node index 5 is out of range.');
    });

    // Types guards check
    it('strictly validates Node types in structure', () => {
      const text = JSON.stringify({
        nodes: [{ x: 'not-a-number', y: 0, text: 'q', isAcceptState: false }],
        links: [],
      });
      expect(() => parseImportJson(text)).toThrow('Unrecognized FSM JSON format.');

      const text2 = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: 'not-a-boolean' }],
        links: [],
      });
      expect(() => parseImportJson(text2)).toThrow('Unrecognized FSM JSON format.');

      const text3 = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false, attr2: 123 }], // attr2 must be string
        links: [],
      });
      expect(() => parseImportJson(text3)).toThrow('Unrecognized FSM JSON format.');

      const text4 = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false, isStartState: 123 }], // isStartState must be boolean
        links: [],
      });
      expect(() => parseImportJson(text4)).toThrow('Unrecognized FSM JSON format.');
    });

    it('strictly validates Link types in structure', () => {
      // Bad link type
      const text = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'UnknownLinkType', text: 'a' }],
      });
      expect(() => parseImportJson(text)).toThrow('Unrecognized FSM JSON format.');

      // Bad Link properties
      const textLink = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'Link', nodeA: '0', nodeB: 0, text: 'a' }],
      });
      expect(() => parseImportJson(textLink)).toThrow('Unrecognized FSM JSON format.');

      // Bad SelfLink properties
      const textSelfLink = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'SelfLink', node: 0, text: 'a', anchorAngle: '0' }],
      });
      expect(() => parseImportJson(textSelfLink)).toThrow('Unrecognized FSM JSON format.');

      // Bad StartLink properties
      const textStartLink = JSON.stringify({
        nodes: [{ x: 0, y: 0, text: 'q', isAcceptState: false }],
        links: [{ type: 'StartLink', node: 0, text: 'a', deltaX: '0', deltaY: 0 }],
      });
      expect(() => parseImportJson(textStartLink)).toThrow('Unrecognized FSM JSON format.');
    });
  });
});
