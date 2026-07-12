function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob(resolve, 'image/png');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      resolve(new Blob([array], { type: mime }));
    } catch {
      resolve(null);
    }
  });
}

function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      void canvasToBlob(offscreen).then(resolve);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

export async function downloadPngFromCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  svgFallback?: string,
): Promise<void> {
  const blob = await canvasToBlob(canvas);
  if (blob) {
    downloadBlob(blob, filename);
    return;
  }

  if (svgFallback) {
    const svgBlob = await svgToPngBlob(svgFallback, canvas.width, canvas.height);
    if (svgBlob) {
      downloadBlob(svgBlob, filename);
      return;
    }
  }

  throw new Error('Unable to export PNG in this browser.');
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadSvg(svg: string, filename: string): void {
  downloadTextFile(svg, filename, 'image/svg+xml;charset=utf-8');
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
}
