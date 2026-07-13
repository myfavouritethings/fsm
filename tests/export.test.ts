import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportAsLaTeX } from '../src/fsm/export/latex';
import { ExportAsSVG } from '../src/fsm/export/svg';
import {
  downloadPngFromCanvas,
  downloadTextFile,
  downloadSvg,
  copyToClipboard,
} from '../src/fsm/export/download';

describe('Export utilities', () => {
  describe('ExportAsLaTeX', () => {
    it('generates a valid LaTeX document with correct boilerplate', () => {
      const latex = new ExportAsLaTeX();
      const output = latex.toLaTeX();
      expect(output).toContain('\\documentclass[12pt]{article}');
      expect(output).toContain('\\usepackage{tikz}');
      expect(output).toContain('\\begin{tikzpicture}[scale=0.2]');
    });

    it('draws a circle for a full 360-degree arc', () => {
      const latex = new ExportAsLaTeX();
      latex.beginPath();
      latex.arc(100, 200, 30, 0, Math.PI * 2);
      const output = latex.toLaTeX();
      expect(output).toContain('\\draw [black] (10,-20) circle (3);\n');
    });

    it('draws a partial arc under different angle parameters', () => {
      const latex = new ExportAsLaTeX();
      // Test drawing regular arc
      latex.arc(100, 200, 30, 0, Math.PI);
      let output = latex.toLaTeX();
      expect(output).toContain('arc');

      // Test reversed arc
      const latexRev = new ExportAsLaTeX();
      latexRev.arc(100, 200, 30, Math.PI, 0, true);
      expect(latexRev.toLaTeX()).toContain('arc');

      // Test angle boundary shifting (large positive / large negative)
      const latexShift = new ExportAsLaTeX();
      latexShift.arc(100, 200, 30, Math.PI * 3, Math.PI * 4);
      expect(latexShift.toLaTeX()).toContain('arc');

      const latexShiftNeg = new ExportAsLaTeX();
      latexShiftNeg.arc(100, 200, 30, -Math.PI * 3, -Math.PI * 4);
      expect(latexShiftNeg.toLaTeX()).toContain('arc');
    });

    it('creates draw or fill paths from lines', () => {
      const latex = new ExportAsLaTeX();
      latex.beginPath();
      latex.moveTo(10, 20);
      latex.lineTo(30, 40);
      latex.stroke();

      expect(latex.toLaTeX()).toContain('\\draw [black] (1,-2) -- (3,-4);\n');

      const latexFill = new ExportAsLaTeX();
      latexFill.beginPath();
      latexFill.moveTo(10, 20);
      latexFill.lineTo(30, 40);
      latexFill.fill();

      expect(latexFill.toLaTeX()).toContain('\\fill [black] (1,-2) -- (3,-4);\n');
    });

    it('ignores stroke and fill calls when points are empty', () => {
      const latex = new ExportAsLaTeX();
      latex.beginPath();
      latex.stroke();
      latex.fill();
      expect(latex.toLaTeX()).not.toContain('\\draw');
      expect(latex.toLaTeX()).not.toContain('\\fill');
    });

    it('measures text width and throws when canvas is missing', () => {
      const latex = new ExportAsLaTeX();
      expect(() => latex.measureText('hello')).toThrow('Canvas required for text measurement');

      const canvas = document.createElement('canvas');
      const metrics = latex.measureText('hello', canvas);
      expect(metrics).toBeDefined();
    });

    it('draws node text and positions text labels according to angle', () => {
      const latex = new ExportAsLaTeX();
      const canvas = document.createElement('canvas');
      // Mock measureText
      latex.measureText = () => ({ width: 40 } as TextMetrics);

      // Empty text shouldn't output anything
      latex.advancedFillText('', '', 100, 200, null);
      expect(latex.toLaTeX()).not.toContain('\\draw');

      // Normal text, no angle
      latex.advancedFillText('q0', 'q0', 100, 200, null);
      expect(latex.toLaTeX()).toContain('\\draw (10,-20) node {$q0$};');

      // Right-aligned (dx > 0)
      latex.advancedFillText('q1', 'q1', 100, 200, 0); // cos=1, sin=0
      expect(latex.toLaTeX()).toContain('\\draw (8,-20) node [right] {$q1$};');

      // Left-aligned (dx < 0)
      latex.advancedFillText('q2', 'q2', 100, 200, Math.PI); // cos=-1, sin=0
      expect(latex.toLaTeX()).toContain('\\draw (12,-20) node [left] {$q2$};');

      // Below (dy > 0)
      latex.advancedFillText('q3', 'q3', 100, 200, Math.PI / 2); // cos=0, sin=1
      expect(latex.toLaTeX()).toContain('\\draw (10,-19) node [below] {$q3$};');

      // Above (dy < 0)
      latex.advancedFillText('q4', 'q4', 100, 200, -Math.PI / 2); // cos=0, sin=-1
      expect(latex.toLaTeX()).toContain('\\draw (10,-19) node [above] {$q4$};');
    });

    it('implements stub context operations without errors', () => {
      const latex = new ExportAsLaTeX();
      expect(() => {
        latex.fillText();
        latex.translate();
        latex.save();
        latex.restore();
        latex.clearRect();
      }).not.toThrow();
    });
  });

  describe('ExportAsSVG', () => {
    it('generates a valid SVG document with correct boilerplate', () => {
      const svg = new ExportAsSVG();
      const output = svg.toSVG(400, 300);
      expect(output).toContain('<?xml version="1.0" standalone="no"?>');
      expect(output).toContain('<svg width="400" height="300"');
      expect(output).toContain('<rect width="400" height="300" fill="white"/>');
    });

    it('draws a circle for a full 360-degree arc', () => {
      const svg = new ExportAsSVG();
      svg.beginPath();
      svg.arc(100, 200, 30, 0, Math.PI * 2);
      const output = svg.toSVG(800, 600);
      expect(output).toContain('<ellipse stroke="black" stroke-width="1" fill="none" cx="100" cy="200" rx="30" ry="30"/>');
    });

    it('draws a partial arc with appropriate path parameters', () => {
      const svg = new ExportAsSVG();
      svg.arc(100, 200, 30, 0, Math.PI); // Angle delta PI (180deg)
      let output = svg.toSVG(800, 600);
      expect(output).toContain('<path stroke="black" stroke-width="1" fill="none" d="M 130,200 A 30,30 0 0 1 70,200"/>'); // useGreaterThan180 is 0

      // Large arc (angle delta > PI)
      const svgLarge = new ExportAsSVG();
      svgLarge.arc(100, 200, 30, 0, Math.PI * 1.5);
      expect(svgLarge.toSVG(800, 600)).toContain('A 30,30 0 1 1'); // useGreaterThan180 is 1

      // Reversed arc
      const svgRev = new ExportAsSVG();
      svgRev.arc(100, 200, 30, Math.PI, 0, true);
      expect(svgRev.toSVG(800, 600)).toContain('<path');
    });

    it('creates polygon tags for stroke and fill line paths', () => {
      const svg = new ExportAsSVG();
      svg.beginPath();
      svg.moveTo(10, 20);
      svg.lineTo(30, 40);
      svg.stroke();
      expect(svg.toSVG(800, 600)).toContain('<polygon stroke="black" stroke-width="1" fill="none" points="10,20 30,40"/>');

      const svgFill = new ExportAsSVG();
      svgFill.beginPath();
      svgFill.moveTo(10, 20);
      svgFill.lineTo(30, 40);
      svgFill.fill();
      expect(svgFill.toSVG(800, 600)).toContain('<polygon fill="black" stroke-width="1" points="10,20 30,40"/>');
    });

    it('ignores empty polygon paths', () => {
      const svg = new ExportAsSVG();
      svg.beginPath();
      svg.stroke();
      svg.fill();
      expect(svg.toSVG(800, 600)).not.toContain('<polygon');
    });

    it('measures text and appends text XML element', () => {
      const svg = new ExportAsSVG();
      const canvas = document.createElement('canvas');
      expect(svg.measureText('a', canvas)).toBeDefined();

      svg.fillText('q_0', 100, 200);
      expect(svg.toSVG(800, 600)).toContain('<text x="100" y="200" font-family="Times New Roman" font-size="20">q_0</text>');

      // Empty text is ignored
      const svgEmpty = new ExportAsSVG();
      svgEmpty.fillText('', 100, 200);
      expect(svgEmpty.toSVG(800, 600)).not.toContain('<text');
    });

    it('respects coordinate translations', () => {
      const svg = new ExportAsSVG();
      svg.translate(10, 20);
      svg.beginPath();
      svg.moveTo(5, 5);
      svg.lineTo(15, 15);
      svg.stroke();

      expect(svg.toSVG(800, 600)).toContain('points="15,25 25,35"');
    });

    it('implements stub context operations', () => {
      const svg = new ExportAsSVG();
      expect(() => {
        svg.save();
        svg.restore();
        svg.clearRect();
      }).not.toThrow();
    });
  });

  describe('Download utilities', () => {
    let mockAnchor: any;
    let mockImage: any;

    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob-url'),
        revokeObjectURL: vi.fn(),
      });

      // Mock anchor element
      mockAnchor = {
        href: '',
        download: '',
        style: {},
        click: vi.fn(),
      };
      const origCreate = document.createElement;
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') return mockAnchor as any;
        return origCreate.call(document, tagName);
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any));
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => ({} as any));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('downloadTextFile creates and triggers download on a temporary link', () => {
      downloadTextFile('some text', 'file.txt', 'text/plain');

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('file.txt');
      expect(mockAnchor.href).toBe('blob-url');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob-url');
    });

    it('downloadSvg calls downloadTextFile', () => {
      const spy = vi.fn();
      // Test svg triggers downloadSvg
      downloadSvg('<svg></svg>', 'test.svg');
      expect(mockAnchor.download).toBe('test.svg');
    });

    describe('downloadPngFromCanvas', () => {
      it('uses canvas.toBlob when present and downloads successfully', async () => {
        const canvas = document.createElement('canvas');
        canvas.toBlob = vi.fn((callback) => {
          callback(new Blob(['png-data'], { type: 'image/png' }));
        });

        await downloadPngFromCanvas(canvas, 'test.png');

        expect(canvas.toBlob).toHaveBeenCalled();
        expect(mockAnchor.download).toBe('test.png');
      });

      it('falls back to toDataURL when toBlob is missing', async () => {
        const canvas = document.createElement('canvas');
        // Delete toBlob
        (canvas as any).toBlob = null;
        canvas.toDataURL = vi.fn(() => 'data:image/png;base64,cG5nLWRhdGE=');

        await downloadPngFromCanvas(canvas, 'test.png');

        expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
        expect(mockAnchor.download).toBe('test.png');
      });

      it('uses SVG fallback rendering on toBlob failure', async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        canvas.toBlob = vi.fn((callback) => {
          callback(null); // Force failure
        });

        // Mock Image class to trigger onload automatically
        mockImage = {};
        vi.stubGlobal('Image', vi.fn(() => {
          setTimeout(() => {
            if (mockImage.onload) mockImage.onload();
          }, 0);
          return mockImage;
        }));

        // Mock canvas inside svgToPngBlob
        const mockOffscreenCanvas: any = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            fillStyle: '',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          })),
          toBlob: vi.fn((callback) => {
            callback(new Blob(['fallback-png'], { type: 'image/png' }));
          }),
        };
        const origCreate = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
          if (tagName === 'canvas') return mockOffscreenCanvas;
          if (tagName === 'a') return mockAnchor;
          return origCreate.call(document, tagName);
        });

        await downloadPngFromCanvas(canvas, 'fallback.png', '<svg></svg>');

        expect(mockAnchor.download).toBe('fallback.png');
        vi.unstubAllGlobals();
      });

      it('throws error when everything fails', async () => {
        const canvas = document.createElement('canvas');
        canvas.toBlob = vi.fn((callback) => callback(null));

        await expect(downloadPngFromCanvas(canvas, 'fail.png')).rejects.toThrow(
          'Unable to export PNG in this browser.'
        );
      });
    });

    describe('copyToClipboard', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', {});
      });

      it('uses navigator.clipboard when available', async () => {
        const mockWriteText = vi.fn(() => Promise.resolve());
        (navigator as any).clipboard = { writeText: mockWriteText };

        await copyToClipboard('text to copy');

        expect(mockWriteText).toHaveBeenCalledWith('text to copy');
      });

      it('falls back to textarea and execCommand when clipboard is unavailable', async () => {
        const mockTextarea = {
          value: '',
          style: {},
          select: vi.fn(),
        };
        const origCreate = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
          if (tagName === 'textarea') return mockTextarea as any;
          return origCreate.call(document, tagName);
        });
        document.execCommand = vi.fn(() => true);

        await copyToClipboard('fallback copy');

        expect(mockTextarea.value).toBe('fallback copy');
        expect(mockTextarea.select).toHaveBeenCalled();
        expect(document.execCommand).toHaveBeenCalledWith('copy');
      });
    });
  });
});
