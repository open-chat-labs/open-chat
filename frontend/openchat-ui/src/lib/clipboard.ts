// Clipboard write that reports the outcome: false when the API is missing (insecure context), the document has no focus,
// or permission is denied. Callers show "Copied" only on true.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser can put an image on the clipboard (ClipboardItem and clipboard.write). */
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

/** Copies the first canvas, svg or img in `root` (or `root` itself) as a PNG: drawn on white with a margin, so a QR code
 *  keeps its quiet zone wherever it's pasted. The write starts before anything is awaited, inside the user's gesture
 *  (Safari needs that). False when unsupported, there's nothing to copy, or drawing or the write fails (e.g. an img
 *  from another origin). An svg is drawn on its own: fills from CSS variables or page styles don't come along. */
export async function copyImage(root: Element, size = 512): Promise<boolean> {
  if (!canCopyImage()) return false;
  const source = root.matches('canvas, svg, img') ? root : root.querySelector('canvas, svg, img');
  if (!source) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(source, size) })]);
    return true;
  } catch {
    return false;
  }
}

async function toPng(source: Element, size: number): Promise<Blob> {
  const image = source instanceof HTMLCanvasElement ? source : source instanceof HTMLImageElement ? await loaded(source) : await svgImage(source as SVGSVGElement);
  const w = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth || image.width;
  const h = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight || image.height;
  if (!w || !h) throw new Error('nothing to draw');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const box = size * 0.84;
  const scale = Math.min(box / w, box / h);
  ctx.drawImage(image, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png'));
}

async function loaded(img: HTMLImageElement): Promise<HTMLImageElement> {
  if (!img.complete) await img.decode();
  return img;
}

// the svg as a standalone image at its rendered size; currentColor keeps the colour it has on the page
async function svgImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox?.baseVal;
  const width = rect.width || box?.width || 256;
  const height = rect.height || box?.height || 256;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.style.color = getComputedStyle(svg).color;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  await img.decode();
  return img;
}
