export interface PdfBlock { top: number; bottom: number; }

/** Page cuts stay outside protected rows and text lines. Oversize rows may
 * continue on another page, but individual text lines are still protected. */
export function paginatePdf(height: number, pageHeight: number, blocks: PdfBlock[]): PdfBlock[] {
  // Earlier blocks have priority. Merge overlapping keep-together ranges only
  // when their union fits a page; otherwise keep the stronger, smaller ranges.
  // This prevents a category and a footer anchor from pulling cuts into rows.
  let protectedBlocks: PdfBlock[] = [];
  for (const block of blocks) {
    if (block.bottom <= block.top || block.bottom - block.top > pageHeight) continue;
    let merged = { ...block };
    const overlaps: PdfBlock[] = [];
    let changed: boolean;
    do {
      changed = false;
      for (const existing of protectedBlocks) {
        if (existing.top < merged.bottom && existing.bottom > merged.top && !overlaps.includes(existing)) {
          overlaps.push(existing);
          merged = { top: Math.min(merged.top, existing.top), bottom: Math.max(merged.bottom, existing.bottom) };
          changed = true;
        }
      }
    } while (changed);
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
  const tables = Array.from(container.querySelectorAll('table'));
  const lastItem = (table: Element) => Array.from(table.querySelectorAll('tbody tr')).filter(row => !row.querySelector('td[colspan]')).pop();
  // Anchor the grand total to real content, including category/location totals
  // between it and the final item. This moves content along with the footer.
  const footer = container.querySelector('footer');
  if (footer) {
    const preceding = tables.filter(table => table.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    const item = preceding && lastItem(preceding);
    if (item) add({ top: item.getBoundingClientRect().top, bottom: footer.getBoundingClientRect().bottom });
  }
  // Keep each location's totals with its last item too.
  container.querySelectorAll('section').forEach(section => {
    const table = Array.from(section.querySelectorAll('table')).pop();
    const item = table && lastItem(table);
    if (item) add({ top: item.getBoundingClientRect().top, bottom: section.getBoundingClientRect().bottom });
  });
  for (const table of tables) {
    const item = lastItem(table);
    if (item) add({ top: item.getBoundingClientRect().top, bottom: table.getBoundingClientRect().bottom });
  }
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
  // Prefer whole categories; large ones can still break between rows, with
  // their headings attached to the first item and totals to the last item.
  for (const table of tables) {
    const category = table.parentElement!;
    const section = category.parentElement!;
    const top = section.tagName === 'SECTION' && section.querySelector('table') === table
      ? section.getBoundingClientRect().top : category.getBoundingClientRect().top;
    add({ top, bottom: category.getBoundingClientRect().bottom });
  }
  return blocks;
}
