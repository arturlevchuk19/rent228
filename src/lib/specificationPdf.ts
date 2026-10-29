import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { regularFont, boldFont } from './specificationPdfFonts';
import { eventDateLabel } from './eventProject';
import type { SpecificationRow } from './specificationExport';

export interface SpecificationPdfData {
  eventName: string; budgetName: string; startDate: string; endDate?: string; venue?: string; rows: SpecificationRow[];
}
/** Vector text and embedded Cyrillic fonts keep the table sharp at any zoom. */
export function buildSpecificationPdf(data: SpecificationPdfData): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('SpecSans.ttf', regularFont); pdf.addFont('SpecSans.ttf', 'SpecSans', 'normal');
  pdf.addFileToVFS('SpecSans-Bold.ttf', boldFont); pdf.addFont('SpecSans-Bold.ttf', 'SpecSans', 'bold');
  pdf.setFont('SpecSans', 'bold'); pdf.setFontSize(15); pdf.text('Спецификация оборудования', 14, 18);
  let top = 26;
  pdf.setFont('SpecSans', 'normal'); pdf.setFontSize(10);
  for (const text of [data.eventName, data.budgetName, eventDateLabel(data.startDate, data.endDate), data.venue || '']) {
    if (!text) continue;
    const lines = pdf.splitTextToSize(text, 182); pdf.text(lines, 14, top); top += lines.length * 5;
  }
  const groups = new Map<string, SpecificationRow[]>();
  for (const row of data.rows) { if (row.quantity <= 0) continue; const group = groups.get(row.group) || []; group.push(row); groups.set(row.group, group); }
  const body: RowInput[] = []; let number = 0;
  for (const [group, rows] of groups) {
    body.push([{ content: group, colSpan: 6, styles: { fillColor: [229, 234, 240], fontStyle: 'bold', textColor: [25, 35, 45] } }]);
    for (const row of rows) body.push([String(++number), row.name, row.sku || '—', String(row.quantity), row.unit, row.notes]);
  }
  if (!number) body.push([{ content: 'Спецификация пуста', colSpan: 6 }]);
  autoTable(pdf, {
    startY: top + 3, margin: { left: 14, right: 14, top: 14, bottom: 16 },
    head: [['№', 'Наименование', 'Артикул', 'Кол-во', 'Ед.', 'Примечание']], body, theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid',
    styles: { font: 'SpecSans', fontSize: 8, cellPadding: 2, overflow: 'linebreak', textColor: [20, 25, 30], lineColor: [195, 203, 210], lineWidth: 0.15 },
    headStyles: { fontStyle: 'bold', fillColor: [30, 45, 60], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 59 }, 2: { cellWidth: 27 }, 3: { cellWidth: 17, halign: 'right' }, 4: { cellWidth: 12 }, 5: { cellWidth: 57 } }
  });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFont('SpecSans', 'normal'); pdf.setFontSize(8); pdf.setTextColor(100); pdf.text(`Страница ${page} из ${pages}`, 196, 289, { align: 'right' }); }
  return pdf;
}
export function saveSpecificationPdf(data: SpecificationPdfData) {
  const name = ['Спецификация', data.eventName, data.budgetName].filter(Boolean).join('_').replace(/[<>:"/\\|?*]/g, '_');
  const safeName = Array.from(name, character => character.charCodeAt(0) < 32 ? '_' : character).join('');
  buildSpecificationPdf(data).save(`${safeName}.pdf`);
}
