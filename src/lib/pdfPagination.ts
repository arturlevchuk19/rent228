export interface PdfBlock { top: number; bottom: number; }

/** Page cuts stay outside protected rows and text lines. Oversize rows may
 * continue on another page, but individual text lines are still protected. */
export function paginatePdf(height: number, pageHeight: number, blocks: PdfBlock[]): PdfBlock[] {
  const protectedBlocks = blocks.filter(block => block.bottom > block.top && block.bottom - block.top <= pageHeight);
  const pages: PdfBlock[] = [];
  let top = 0;
  while (top < height) {
    let bottom = Math.min(top + pageHeight, height);
    if (bottom < height) {
      let previous: number;
      do {
        previous = bottom;
        for (const block of protectedBlocks) {
          if (block.top < bottom && block.bottom > bottom && block.top > top) bottom = block.top;
        }
      } while (bottom < previous);
    }
    pages.push({ top, bottom });
    top = bottom;
  }
  return pages;
}

export function measurePdfBlocks(container: HTMLElement, pageHeight: number): PdfBlock[] {
  const origin = container.getBoundingClientRect().top;
  const blocks: PdfBlock[] = [];
  const add = (rect: { top: number; bottom: number }) => {
    // Adjacent collapsed table rows share an edge. Round both sides equally:
    // expanding both rectangles would overlap them and push every cut backwards.
    blocks.push({ top: Math.max(0, Math.round(rect.top - origin)), bottom: Math.round(rect.bottom - origin) });
  };
  // Keep table rows, totals and the document header intact.
  container.querySelectorAll<HTMLElement>('header, tr, footer, [data-pdf-keep]').forEach(element => add(element.getBoundingClientRect()));
  // A category/location heading must travel with its table heading and first row.
  container.querySelectorAll('table').forEach(table => {
    const firstRow = table.querySelector('tbody tr');
    if (!firstRow) return;
    const category = table.parentElement!;
    const section = category.parentElement!;
    const top = section.tagName === 'SECTION' && section.querySelector('table') === table
      ? section.getBoundingClientRect().top : category.getBoundingClientRect().top;
    const bottom = firstRow.getBoundingClientRect().bottom;
    if (bottom - top <= pageHeight) add({ top, bottom });
  });
  // Protect rendered lines even for a note/position longer than a full page.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue;
    range.selectNodeContents(walker.currentNode);
    Array.from(range.getClientRects()).forEach(rect => {
      blocks.push({ top: Math.max(0, Math.floor(rect.top - origin)), bottom: Math.ceil(rect.bottom - origin) });
    });
  }
  return blocks;
}
