export interface PdfBlock { top: number; bottom: number; keepWithNext?: boolean; }

/** Page cuts stay outside protected rows and text lines. Oversize rows may
 * continue on another page, but individual text lines are still protected. */
export function paginatePdf(height: number, pageHeight: number, blocks: PdfBlock[]): PdfBlock[] {
  // Whole rows/text lines take precedence over heading preferences. Resolve
  // overlapping constraints first so one cut cannot cascade back across a page.
  let protectedBlocks: PdfBlock[] = [];
  const orderedBlocks = [...blocks.filter(block => !block.keepWithNext), ...blocks.filter(block => block.keepWithNext)];
  for (const block of orderedBlocks) {
    if (block.bottom <= block.top || block.bottom - block.top > pageHeight) continue;
    let merged = { top: block.top, bottom: block.bottom };
    const overlaps: PdfBlock[] = [];
    let changed: boolean;
    do {
      changed = false;
      for (const existing of protectedBlocks) {
        if (!overlaps.includes(existing) && existing.top < merged.bottom && existing.bottom > merged.top) {
          overlaps.push(existing);
          merged = { top: Math.min(merged.top, existing.top), bottom: Math.max(merged.bottom, existing.bottom) };
          changed = true;
        }
      }
    } while (changed);
    // Keep headings with the first item even when it takes more than 20%
    // of a sheet. This does not reserve the rest of the category.
    if (merged.bottom - merged.top > pageHeight) continue;
    protectedBlocks = protectedBlocks.filter(existing => !overlaps.includes(existing));
    protectedBlocks.push(merged);
  }
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
    const firstRowRect = firstRow.getBoundingClientRect();
    // For an item taller than a page, accompany its first text line instead.
    const bottom = firstRowRect.bottom - top <= pageHeight ? firstRowRect.bottom : firstRowRect.top + 24;
    if (bottom - top <= pageHeight) blocks.push({ top: Math.max(0, Math.round(top - origin)), bottom: Math.round(bottom - origin), keepWithNext: true });
  });
  // Keep category totals (including multi-day totals) with the final item,
  // without reserving the rest of the category or the following location.
  container.querySelectorAll('table').forEach(table => {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const lastItem = rows.filter(row => !row.querySelector('td[colspan]')).pop();
    const lastRow = rows[rows.length - 1];
    if (!lastItem || !lastRow || lastItem === lastRow) return;
    const top = Math.round(lastItem.getBoundingClientRect().top - origin);
    const bottom = Math.round(lastRow.getBoundingClientRect().bottom - origin);
    if (bottom - top <= pageHeight) blocks.push({ top, bottom, keepWithNext: true });
  });
  // Protect rendered lines even for a note/position longer than a full page.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue;
    // A normal table row already protects its full contents. Font ink bounds
    // can protrude across the row edge (especially on Safari); measuring them
    // again joins adjacent rows into one large, falsely indivisible category.
    const row = walker.currentNode.parentElement?.closest('tr');
    if (row && row.getBoundingClientRect().height <= pageHeight) continue;
    range.selectNodeContents(walker.currentNode);
    Array.from(range.getClientRects()).forEach(rect => {
      blocks.push({ top: Math.max(0, Math.floor(rect.top - origin)), bottom: Math.ceil(rect.bottom - origin) });
    });
  }
  return blocks;
}
