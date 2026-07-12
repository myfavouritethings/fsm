import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('App Shell Controller', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('crypto', {
      randomUUID: () => 'app-test-uuid',
    });
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob-url'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });

    root = document.createElement('div');
    root.id = 'app-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Bootstrap options', () => {
    it('initializes layout and creates default machine if storage is empty', () => {
      app = new App(root);

      expect(root.querySelector('h1')?.textContent).toBe('Finite State Machine Designer');
      const machineItems = root.querySelectorAll('.machine-item');
      expect(machineItems).toHaveLength(1);
      expect(machineItems[0].querySelector('.machine-item-name')?.textContent).toBe('Untitled FSM');
    });

    it('loads shared machine from URL hash parameter on load', () => {
      // LZ-string compressed payload: {"v":1,"name":"URL Shared","data":{"nodes":[],"links":[]}}
      // Compress value: `#s=CoCwpgBA5gdsQA` or similar. Let's encode a real one
      // We can use urlShare helper, or manually build:
      // Let's set hash manually
      window.location.hash = '#s=CoCwpgBAhgLglgYwDYHMBOBnEA'; // represents empty FSM with name
      app = new App(root);

      const items = root.querySelectorAll('.machine-item');
      expect(items).toHaveLength(1);
      expect(root.querySelector('#status')?.textContent).toBe('Loaded shared FSM from link.');
      window.location.hash = '';
    });
  });

  describe('Sidebar and Machine management', () => {
    it('creates new machines and switches between them', () => {
      app = new App(root);

      const newBtn = root.querySelector<HTMLButtonElement>('#new-machine')!;
      newBtn.click();

      // Should now have 2 machines in sidebar
      let items = root.querySelectorAll('.machine-item');
      expect(items).toHaveLength(2);
      expect(root.querySelector('#status')?.textContent).toBe('Created new machine.');

      // Click first machine in list to switch back
      const firstMachineId = (items[1] as HTMLButtonElement).dataset.machineId!;
      (items[1] as HTMLButtonElement).click();

      // Active class should toggle
      items = root.querySelectorAll('.machine-item');
      expect(items[1].classList.contains('active')).toBe(true);
    });

    it('prevents deleting the last machine in storage list', () => {
      app = new App(root);

      const deleteBtn = root.querySelector<HTMLButtonElement>('#delete-machine')!;
      deleteBtn.click();

      expect(root.querySelector('#status')?.textContent).toBe('Cannot delete the last machine.');
      expect(root.querySelectorAll('.machine-item')).toHaveLength(1);
    });

    it('deletes active machine if multiple machines exist and user confirms', () => {
      app = new App(root);

      // Create a second machine
      root.querySelector<HTMLButtonElement>('#new-machine')!.click();
      expect(root.querySelectorAll('.machine-item')).toHaveLength(2);

      const deleteBtn = root.querySelector<HTMLButtonElement>('#delete-machine')!;
      deleteBtn.click();

      expect(window.confirm).toHaveBeenCalled();
      expect(root.querySelector('#status')?.textContent).toBe('Machine deleted.');
      expect(root.querySelectorAll('.machine-item')).toHaveLength(1);
    });

    it('updates active machine name when renaming name input', () => {
      app = new App(root);

      const nameInput = root.querySelector<HTMLInputElement>('#machine-name')!;
      nameInput.value = 'Renamed FSM';
      nameInput.dispatchEvent(new Event('change'));

      const sidebarName = root.querySelector('.machine-item-name')?.textContent;
      expect(sidebarName).toBe('Renamed FSM');
    });
  });

  describe('Properties panel interactions', () => {
    it('updates selected state properties and presets', () => {
      app = new App(root);

      // Dbl click canvas to create a node and select it
      const canvas = root.querySelector<HTMLCanvasElement>('#canvas')!;
      canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 100, clientY: 100 }));

      // Properties panel should now be visible
      const propsPanel = root.querySelector('#state-properties')!;
      expect(propsPanel.classList.contains('hidden')).toBe(false);

      const labelInput = root.querySelector<HTMLInputElement>('#state-text')!;
      labelInput.value = 'S1';
      labelInput.dispatchEvent(new Event('input'));

      // Test presets dropdown
      const presetSelect = root.querySelector<HTMLSelectElement>('#state-attr2-preset')!;
      const customInput = root.querySelector<HTMLInputElement>('#state-attr2-custom')!;

      // Change preset to custom
      presetSelect.value = 'custom';
      presetSelect.dispatchEvent(new Event('change'));
      expect(customInput.classList.contains('hidden')).toBe(false);

      customInput.value = 'MyCustomAttr';
      customInput.dispatchEvent(new Event('input'));

      // Checkboxes
      const acceptCheck = root.querySelector<HTMLInputElement>('#state-accept')!;
      acceptCheck.checked = true;
      acceptCheck.dispatchEvent(new Event('change'));

      const startCheck = root.querySelector<HTMLInputElement>('#state-start')!;
      startCheck.checked = true;
      startCheck.dispatchEvent(new Event('change'));

      // Deselect object by clicking empty space
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 400 }));
      expect(propsPanel.classList.contains('hidden')).toBe(true);
    });

    it('blurs label input when pressing Enter', () => {
      app = new App(root);

      // Create a node
      const canvas = root.querySelector<HTMLCanvasElement>('#canvas')!;
      canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 100, clientY: 100 }));

      const labelInput = root.querySelector<HTMLInputElement>('#state-text')!;
      labelInput.focus();

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      labelInput.dispatchEvent(enterEvent);

      expect(document.activeElement).not.toBe(labelInput);
    });
  });

  describe('Exports and Share actions', () => {
    it('updates text area with SVG code on export SVG click', () => {
      app = new App(root);

      const exportSvgBtn = root.querySelector<HTMLButtonElement>('#export-svg')!;
      exportSvgBtn.click();

      const output = root.querySelector<HTMLTextAreaElement>('#output')!;
      expect(output.value).toContain('<svg');
      expect(root.querySelector('#status')?.textContent).toBe('SVG downloaded and shown below.');
    });

    it('updates text area with LaTeX code on export LaTeX click', () => {
      app = new App(root);

      const exportLatexBtn = root.querySelector<HTMLButtonElement>('#export-latex')!;
      exportLatexBtn.click();

      const output = root.querySelector<HTMLTextAreaElement>('#output')!;
      expect(output.value).toContain('\\begin{tikzpicture}');
    });

    it('downloads JSON format and shows in text area on export JSON click', () => {
      app = new App(root);

      const exportJsonBtn = root.querySelector<HTMLButtonElement>('#export-json')!;
      exportJsonBtn.click();

      const output = root.querySelector<HTMLTextAreaElement>('#output')!;
      expect(output.value).toContain('"version": 1');
      expect(root.querySelector('#status')?.textContent).toBe('JSON downloaded.');
    });

    it('copies URL share link when copy share link button is clicked', async () => {
      app = new App(root);

      const copyBtn = root.querySelector<HTMLButtonElement>('#copy-share')!;
      copyBtn.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(root.querySelector('#status')?.textContent).toBe('Share link copied to clipboard.');
    });

    it('triggers PNG export without throwing', async () => {
      app = new App(root);
      const canvas = root.querySelector<HTMLCanvasElement>('#canvas')!;
      canvas.toBlob = vi.fn((cb) => cb(new Blob(['png-blob'])));

      const exportPngBtn = root.querySelector<HTMLButtonElement>('#export-png')!;
      exportPngBtn.click();

      // Wait a tick for async export to resolve
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(root.querySelector('#status')?.textContent).toBe('PNG downloaded.');
    });
  });

  describe('JSON Import workflow', () => {
    it('imports correct JSON configurations', async () => {
      app = new App(root);

      const importInput = root.querySelector<HTMLInputElement>('#import-json-input')!;
      const importBtn = root.querySelector<HTMLButtonElement>('#import-json')!;

      // Click triggers input click
      let clicked = false;
      importInput.click = () => { clicked = true; };
      importBtn.click();
      expect(clicked).toBe(true);

      // Create a mock imported file
      const validImportJson = JSON.stringify({
        version: 1,
        name: 'Imported Success',
        data: {
          nodes: [{ x: 100, y: 100, text: 'qi', isAcceptState: false }],
          links: [],
        },
      });
      const file = new File([validImportJson], 'fsm.json', { type: 'application/json' });

      // Mock HTMLInputElement files property
      Object.defineProperty(importInput, 'files', {
        value: [file],
        writable: true,
      });

      // Dispatch change event to trigger reading
      importInput.dispatchEvent(new Event('change'));

      // Wait for file read promise resolution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(root.querySelector('#status')?.textContent).toBe('Imported "Imported Success" as a new machine.');
      expect(root.querySelector('#machine-name')?.getAttribute('value')).toBe('Imported Success');
    });

    it('handles corrupted JSON import errors gracefully', async () => {
      app = new App(root);

      const importInput = root.querySelector<HTMLInputElement>('#import-json-input')!;
      const file = new File(['{corrupt'], 'corrupt.json', { type: 'application/json' });

      Object.defineProperty(importInput, 'files', {
        value: [file],
        writable: true,
      });

      importInput.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(root.querySelector('#status')?.textContent).toBe('Invalid JSON file.');
    });
  });
});
