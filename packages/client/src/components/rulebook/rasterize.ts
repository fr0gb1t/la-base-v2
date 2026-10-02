import { toCanvas } from 'html-to-image';

// The rulebook's pages are DOM (text, SVG drawings); the 3D booklet needs them as pictures.
// html-to-image draws a node through an SVG foreignObject. It can't read the Google Fonts
// stylesheet (cross-origin), so the fonts are fetched once and inlined as data URLs.

let fontCss: Promise<string> | null = null;

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/** @font-face rules of the page's Google Fonts, with the font files inlined. */
export function embeddedFontCss(): Promise<string> {
  if (fontCss) return fontCss;
  fontCss = (async () => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')];
    let css = '';
    for (const l of links) {
      try {
        css += await (await fetch(l.href)).text();
      } catch {
        /* offline: the snapshot falls back to the system serif */
      }
    }
    // only the latin subsets matter (Spanish text); every font file becomes a data URL
    css = css
      .split('/* ')
      .filter((block) => /^latin(-ext)? \*\//.test(block))
      .map((block) => block.replace(/^latin(-ext)? \*\//, ''))
      .join('\n');
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    const inlined = await Promise.all(urls.map(async (u) => [u, await toDataUrl(u).catch(() => u)] as const));
    for (const [u, data] of inlined) css = css.split(u).join(data);
    return css;
  })();
  return fontCss;
}

/** A picture of a DOM node (the size it has on screen), at `ratio` × resolution. */
export async function rasterize(node: HTMLElement, ratio = 2): Promise<HTMLCanvasElement> {
  return toCanvas(node, { pixelRatio: ratio, fontEmbedCSS: await embeddedFontCss(), cacheBust: false, skipAutoScale: true });
}
