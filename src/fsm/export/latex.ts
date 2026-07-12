import { fixed } from '../math';
import type { DrawContext } from '../types';

export class ExportAsLaTeX implements DrawContext {
  fillStyle = 'black';
  strokeStyle = 'black';
  lineWidth = 1;
  font = '12px Arial, sans-serif';
  private points: { x: number; y: number }[] = [];
  private texData = '';
  private scale = 0.1;

  toLaTeX(): string {
    return (
      '\\documentclass[12pt]{article}\n' +
      '\\usepackage{tikz}\n\n' +
      '\\begin{document}\n\n' +
      '\\begin{center}\n' +
      '\\begin{tikzpicture}[scale=0.2]\n' +
      '\\tikzstyle{every node}+=[inner sep=0pt]\n' +
      this.texData +
      '\\end{tikzpicture}\n' +
      '\\end{center}\n\n' +
      '\\end{document}\n'
    );
  }

  beginPath(): void {
    this.points = [];
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    isReversed?: boolean,
  ): void {
    x *= this.scale;
    y *= this.scale;
    radius *= this.scale;

    if (endAngle - startAngle === Math.PI * 2) {
      this.texData +=
        `\\draw [${this.strokeStyle}] (${fixed(x, 3)},${fixed(-y, 3)}) circle (${fixed(radius, 3)});\n`;
      return;
    }

    let sa = startAngle;
    let ea = endAngle;
    if (isReversed) [sa, ea] = [ea, sa];
    if (ea < sa) ea += Math.PI * 2;

    if (Math.min(sa, ea) < -2 * Math.PI) {
      sa += 2 * Math.PI;
      ea += 2 * Math.PI;
    } else if (Math.max(sa, ea) > 2 * Math.PI) {
      sa -= 2 * Math.PI;
      ea -= 2 * Math.PI;
    }

    sa = -sa;
    ea = -ea;
    this.texData +=
      `\\draw [${this.strokeStyle}] (${fixed(x + radius * Math.cos(-sa), 3)},${fixed(-y + radius * Math.sin(-sa), 3)}) arc (${fixed((-sa * 180) / Math.PI, 5)}:${fixed((-ea * 180) / Math.PI, 5)}:${fixed(radius, 3)});\n`;
  }

  moveTo(x: number, y: number): void {
    this.points.push({ x: x * this.scale, y: y * this.scale });
  }

  lineTo(x: number, y: number): void {
    this.points.push({ x: x * this.scale, y: y * this.scale });
  }

  stroke(): void {
    if (this.points.length === 0) return;
    this.texData += `\\draw [${this.strokeStyle}]`;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      this.texData += `${i > 0 ? ' --' : ''} (${fixed(p.x, 2)},${fixed(-p.y, 2)})`;
    }
    this.texData += ';\n';
  }

  fill(): void {
    if (this.points.length === 0) return;
    this.texData += `\\fill [${this.strokeStyle}]`;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      this.texData += `${i > 0 ? ' --' : ''} (${fixed(p.x, 2)},${fixed(-p.y, 2)})`;
    }
    this.texData += ';\n';
  }

  measureText(text: string, canvas?: HTMLCanvasElement): TextMetrics {
    const c = canvas?.getContext('2d');
    if (!c) throw new Error('Canvas required for text measurement');
    c.font = '20px "Times New Roman", serif';
    return c.measureText(text);
  }

  advancedFillText(
    text: string,
    originalText: string,
    x: number,
    y: number,
    angleOrNull: number | null,
  ): void {
    if (text.replace(' ', '').length === 0) return;

    let nodeParams = '';
    if (angleOrNull != null) {
      const width = this.measureText(text).width;
      const dx = Math.cos(angleOrNull);
      const dy = Math.sin(angleOrNull);
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          nodeParams = '[right] ';
          x -= width / 2;
        } else {
          nodeParams = '[left] ';
          x += width / 2;
        }
      } else if (dy > 0) {
        nodeParams = '[below] ';
        y -= 10;
      } else {
        nodeParams = '[above] ';
        y += 10;
      }
    }

    x *= this.scale;
    y *= this.scale;
    this.texData +=
      `\\draw (${fixed(x, 2)},${fixed(-y, 2)}) node ${nodeParams}{$${originalText.replace(/ /g, '\\mbox{ }')}$};\n`;
  }

  fillText(): void {}

  translate(): void {}
  save(): void {}
  restore(): void {}
  clearRect(): void {}
}
