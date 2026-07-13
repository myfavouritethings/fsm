import { fixed } from '../math';
import { textToXML } from '../text';
import type { DrawContext } from '../types';

export class ExportAsSVG implements DrawContext {
  fillStyle = 'black';
  strokeStyle = 'black';
  lineWidth = 1;
  font = '12px Arial, sans-serif';
  private points: { x: number; y: number }[] = [];
  private svgData = '';
  private transX = 0;
  private transY = 0;

  toSVG(width: number, height: number): string {
    return (
      '<?xml version="1.0" standalone="no"?>\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n' +
      `<svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">\n` +
      `<rect width="${width}" height="${height}" fill="white"/>\n` +
      this.svgData +
      '</svg>\n'
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
    x += this.transX;
    y += this.transY;
    const style = `stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" fill="none"`;

    if (endAngle - startAngle === Math.PI * 2) {
      this.svgData +=
        `\t<ellipse ${style} cx="${fixed(x, 3)}" cy="${fixed(y, 3)}" rx="${fixed(radius, 3)}" ry="${fixed(radius, 3)}"/>\n`;
      return;
    }

    let sa = startAngle;
    let ea = endAngle;
    if (isReversed) [sa, ea] = [ea, sa];
    if (ea < sa) ea += Math.PI * 2;

    const startX = x + radius * Math.cos(sa);
    const startY = y + radius * Math.sin(sa);
    const endX = x + radius * Math.cos(ea);
    const endY = y + radius * Math.sin(ea);
    const useGreaterThan180 = Math.abs(ea - sa) > Math.PI;

    this.svgData += `\t<path ${style} d="`;
    this.svgData += `M ${fixed(startX, 3)},${fixed(startY, 3)} `;
    this.svgData += `A ${fixed(radius, 3)},${fixed(radius, 3)} `;
    this.svgData += '0 ';
    this.svgData += `${+useGreaterThan180} 1 `;
    this.svgData += `${fixed(endX, 3)},${fixed(endY, 3)}"/>\n`;
  }

  moveTo(x: number, y: number): void {
    this.points.push({ x: x + this.transX, y: y + this.transY });
  }

  lineTo(x: number, y: number): void {
    this.points.push({ x: x + this.transX, y: y + this.transY });
  }

  stroke(): void {
    if (this.points.length === 0) return;
    this.svgData += `\t<polygon stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" fill="none" points="`;
    this.svgData += this.points.map((p) => `${fixed(p.x, 3)},${fixed(p.y, 3)}`).join(' ');
    this.svgData += '"/>\n';
  }

  fill(): void {
    if (this.points.length === 0) return;
    this.svgData += `\t<polygon fill="${this.fillStyle}" stroke-width="${this.lineWidth}" points="`;
    this.svgData += this.points.map((p) => `${fixed(p.x, 3)},${fixed(p.y, 3)}`).join(' ');
    this.svgData += '"/>\n';
  }

  measureText(text: string, canvas?: HTMLCanvasElement): TextMetrics {
    const c = (canvas || document.createElement('canvas')).getContext('2d');
    if (!c) throw new Error('Canvas required for text measurement');
    c.font = '20px "Times New Roman", serif';
    return c.measureText(text);
  }

  fillText(text: string, x: number, y: number): void {
    x += this.transX;
    y += this.transY;
    if (text.replace(' ', '').length > 0) {
      this.svgData +=
        `\t<text x="${fixed(x, 3)}" y="${fixed(y, 3)}" font-family="Times New Roman" font-size="20">${textToXML(text)}</text>\n`;
    }
  }

  translate(x: number, y: number): void {
    this.transX = x;
    this.transY = y;
  }

  save(): void {}
  restore(): void {}
  clearRect(): void {}
}
