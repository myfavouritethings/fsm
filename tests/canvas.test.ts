import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clampCanvasSize,
  loadCanvasSize,
  saveCanvasSize,
  CanvasViewport,
  DEFAULT_CANVAS_SIZE,
} from '../src/canvas/viewport';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.PointerEvent = class extends MouseEvent {} as any;

describe('CanvasViewport', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Canvas Size Constraints', () => {
    it('clamps size within MIN/MAX bounds', () => {
      expect(clampCanvasSize(100, 100)).toEqual({ width: 400, height: 300 });
      expect(clampCanvasSize(5000, 5000)).toEqual({ width: 4000, height: 4000 });
      expect(clampCanvasSize(1200.4, 800.7)).toEqual({ width: 1200, height: 801 });
    });

    it('loads and saves size from localStorage', () => {
      expect(loadCanvasSize()).toEqual(DEFAULT_CANVAS_SIZE);

      saveCanvasSize({ width: 1000, height: 800 });
      expect(loadCanvasSize()).toEqual({ width: 1000, height: 800 });

      // Corrupt save data fallback
      localStorage.setItem('fsm-canvas-size', 'corrupt');
      expect(loadCanvasSize()).toEqual(DEFAULT_CANVAS_SIZE);

      localStorage.setItem('fsm-canvas-size', JSON.stringify({ width: 'bad' }));
      expect(loadCanvasSize()).toEqual(DEFAULT_CANVAS_SIZE);
    });
  });

  describe('CanvasViewport Class UI controls', () => {
    let shell: HTMLElement;
    let canvas: HTMLCanvasElement;
    let widthInput: HTMLInputElement;
    let heightInput: HTMLInputElement;
    let sizeLabel: HTMLElement;
    let fullscreenBtn: HTMLButtonElement;
    let applyBtn: HTMLButtonElement;
    let onResizeSpy: any;
    let viewport: CanvasViewport;

    beforeEach(() => {
      // Create DOM elements
      shell = document.createElement('div');
      shell.style.paddingLeft = '10px';
      shell.style.paddingRight = '10px';
      shell.style.paddingTop = '10px';
      shell.style.paddingBottom = '10px';

      // Mock Client dimensions
      Object.defineProperty(shell, 'clientWidth', { value: 900, writable: true });
      Object.defineProperty(shell, 'clientHeight', { value: 700, writable: true });

      // Create toolbar mock element inside shell
      const toolbar = document.createElement('div');
      toolbar.className = 'canvas-shell-toolbar';
      Object.defineProperty(toolbar, 'offsetHeight', { value: 40 });
      shell.appendChild(toolbar);

      // Create resize handle inside shell
      const handle = document.createElement('div');
      handle.className = 'canvas-resize-handle';
      shell.appendChild(handle);

      canvas = document.createElement('canvas');
      widthInput = document.createElement('input');
      widthInput.type = 'number';
      heightInput = document.createElement('input');
      heightInput.type = 'number';
      sizeLabel = document.createElement('span');
      fullscreenBtn = document.createElement('button');
      applyBtn = document.createElement('button');
      onResizeSpy = vi.fn();

      viewport = new CanvasViewport(
        shell,
        canvas,
        widthInput,
        heightInput,
        sizeLabel,
        fullscreenBtn,
        applyBtn,
        onResizeSpy
      );
    });

    it('initializes layout and syncs inputs on start', () => {
      viewport.init();

      expect(canvas.width).toBe(DEFAULT_CANVAS_SIZE.width);
      expect(canvas.height).toBe(DEFAULT_CANVAS_SIZE.height);
      expect(widthInput.value).toBe(String(DEFAULT_CANVAS_SIZE.width));
      expect(heightInput.value).toBe(String(DEFAULT_CANVAS_SIZE.height));
      expect(sizeLabel.textContent).toBe(`${DEFAULT_CANVAS_SIZE.width} × ${DEFAULT_CANVAS_SIZE.height}`);
      expect(onResizeSpy).toHaveBeenCalledWith(DEFAULT_CANVAS_SIZE);
    });

    it('applies custom size when click on apply button', () => {
      viewport.init();

      widthInput.value = '1200';
      heightInput.value = '900';

      applyBtn.click();

      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(900);
      expect(onResizeSpy).toHaveBeenLastCalledWith({ width: 1200, height: 900 });
      expect(loadCanvasSize()).toEqual({ width: 1200, height: 900 });
    });

    it('ignores non-finite apply size inputs', () => {
      viewport.init();

      widthInput.value = 'invalid';
      heightInput.value = '900';

      applyBtn.click();
      // Should clamp 0 to MIN_WIDTH (400)
      expect(canvas.width).toBe(400);
    });

    it('toggles fullscreen state when clicked', async () => {
      shell.requestFullscreen = vi.fn(() => Promise.resolve());
      document.exitFullscreen = vi.fn(() => Promise.resolve());

      viewport.init();

      // Fullscreen enter
      await fullscreenBtn.click();
      expect(shell.requestFullscreen).toHaveBeenCalled();

      // Mock entering fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: shell,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));

      expect(fullscreenBtn.textContent).toBe('Exit fullscreen');

      // Fullscreen exit
      await fullscreenBtn.click();
      expect(document.exitFullscreen).toHaveBeenCalled();

      // Mock exiting fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      expect(fullscreenBtn.textContent).toBe('Fullscreen');
    });

    it('fits canvas size to shell boundaries in fullscreen mode', () => {
      viewport.init();

      // Trigger fullscreen fit
      Object.defineProperty(document, 'fullscreenElement', {
        value: shell,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));

      // shell clientWidth = 900. paddingX = 20 => width = 880
      // shell clientHeight = 700. paddingY = 20, toolbar = 40, extra 8 => height = 632
      expect(canvas.width).toBe(880);
      expect(canvas.height).toBe(632);
    });

    it('resizes canvas on PointerEvent drag resize handle', () => {
      viewport.init();

      const handle = shell.querySelector('.canvas-resize-handle')!;
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 200,
      });
      handle.dispatchEvent(downEvent);

      // Drag 50px right, 30px down
      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 230,
      });
      window.dispatchEvent(moveEvent);

      expect(canvas.width).toBe(DEFAULT_CANVAS_SIZE.width + 50);
      expect(canvas.height).toBe(DEFAULT_CANVAS_SIZE.height + 30);

      const upEvent = new PointerEvent('pointerup');
      window.dispatchEvent(upEvent);

      // Further moves should do nothing
      const moveEvent2 = new PointerEvent('pointermove', {
        clientX: 200,
        clientY: 300,
      });
      window.dispatchEvent(moveEvent2);
      expect(canvas.width).toBe(DEFAULT_CANVAS_SIZE.width + 50); // Untouched
    });
  });
});
