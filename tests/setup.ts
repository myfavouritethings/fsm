import { vi } from 'vitest';

// Mock the Canvas API since JSDOM does not implement it by default
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === '2d') {
    return {
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
      font: '',
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
});
