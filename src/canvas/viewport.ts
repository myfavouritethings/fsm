export interface CanvasSize {
  width: number;
  height: number;
}

const STORAGE_KEY = 'fsm-canvas-size';
export const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 800, height: 600 };
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 4000;

export function clampCanvasSize(width: number, height: number): CanvasSize {
  return {
    width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width))),
    height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height))),
  };
}

export function loadCanvasSize(): CanvasSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CANVAS_SIZE };
    const parsed = JSON.parse(raw) as CanvasSize;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return { ...DEFAULT_CANVAS_SIZE };
    }
    return clampCanvasSize(parsed.width, parsed.height);
  } catch {
    return { ...DEFAULT_CANVAS_SIZE };
  }
}

export function saveCanvasSize(size: CanvasSize): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clampCanvasSize(size.width, size.height)));
}

export class CanvasViewport {
  private savedSize: CanvasSize;
  private isFullscreen = false;
  private resizeObserver: ResizeObserver | null = null;
  private dragStart: { x: number; y: number; width: number; height: number } | null = null;
  private shell: HTMLElement;
  private canvas: HTMLCanvasElement;
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private sizeLabel: HTMLElement;
  private fullscreenBtn: HTMLButtonElement;
  private applyBtn: HTMLButtonElement;
  private onResize: (size: CanvasSize) => void;

  constructor(
    shell: HTMLElement,
    canvas: HTMLCanvasElement,
    widthInput: HTMLInputElement,
    heightInput: HTMLInputElement,
    sizeLabel: HTMLElement,
    fullscreenBtn: HTMLButtonElement,
    applyBtn: HTMLButtonElement,
    onResize: (size: CanvasSize) => void,
  ) {
    this.shell = shell;
    this.canvas = canvas;
    this.widthInput = widthInput;
    this.heightInput = heightInput;
    this.sizeLabel = sizeLabel;
    this.fullscreenBtn = fullscreenBtn;
    this.applyBtn = applyBtn;
    this.onResize = onResize;
    this.savedSize = loadCanvasSize();
  }

  init(): void {
    this.applySize(this.savedSize, false);
    this.syncInputs(this.savedSize);

    this.applyBtn.addEventListener('click', () => this.applyFromInputs());
    this.widthInput.addEventListener('change', () => this.applyFromInputs());
    this.heightInput.addEventListener('change', () => this.applyFromInputs());
    this.fullscreenBtn.addEventListener('click', () => void this.toggleFullscreen());

    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());

    const handle = this.shell.querySelector<HTMLElement>('.canvas-resize-handle');
    handle?.addEventListener('pointerdown', (e) => this.startDrag(e));

    this.resizeObserver = new ResizeObserver(() => {
      if (this.isFullscreen) this.fitCanvasToShell();
    });
    this.resizeObserver.observe(this.shell);
  }

  private applyFromInputs(): void {
    const width = Number(this.widthInput.value);
    const height = Number(this.heightInput.value);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    this.applySize(clampCanvasSize(width, height), true);
  }

  private applySize(size: CanvasSize, persist: boolean): void {
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.canvas.style.width = `${size.width}px`;
    this.canvas.style.height = `${size.height}px`;
    this.syncInputs(size);
    if (persist && !this.isFullscreen) {
      this.savedSize = size;
      saveCanvasSize(size);
    }
    this.onResize(size);
  }

  private syncInputs(size: CanvasSize): void {
    this.widthInput.value = String(size.width);
    this.heightInput.value = String(size.height);
    this.sizeLabel.textContent = `${size.width} × ${size.height}`;
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement === this.shell) {
      await document.exitFullscreen();
      return;
    }
    await this.shell.requestFullscreen();
  }

  private handleFullscreenChange(): void {
    this.isFullscreen = document.fullscreenElement === this.shell;
    this.shell.classList.toggle('is-fullscreen', this.isFullscreen);
    this.fullscreenBtn.textContent = this.isFullscreen ? 'Exit fullscreen' : 'Fullscreen';

    if (this.isFullscreen) {
      this.fitCanvasToShell();
    } else {
      this.applySize(this.savedSize, false);
    }
  }

  private fitCanvasToShell(): void {
    const style = getComputedStyle(this.shell);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const toolbar = this.shell.querySelector<HTMLElement>('.canvas-shell-toolbar');
    const toolbarHeight = toolbar?.offsetHeight ?? 0;
    const width = Math.max(MIN_WIDTH, this.shell.clientWidth - paddingX);
    const height = Math.max(MIN_HEIGHT, this.shell.clientHeight - paddingY - toolbarHeight - 8);

    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.syncInputs({ width, height });
    this.onResize({ width, height });
  }

  private startDrag(e: PointerEvent): void {
    if (this.isFullscreen) return;
    e.preventDefault();
    this.dragStart = {
      x: e.clientX,
      y: e.clientY,
      width: this.canvas.width,
      height: this.canvas.height,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!this.dragStart) return;
      const deltaX = moveEvent.clientX - this.dragStart.x;
      const deltaY = moveEvent.clientY - this.dragStart.y;
      this.applySize(
        clampCanvasSize(this.dragStart.width + deltaX, this.dragStart.height + deltaY),
        true,
      );
    };

    const onUp = () => {
      this.dragStart = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
}
