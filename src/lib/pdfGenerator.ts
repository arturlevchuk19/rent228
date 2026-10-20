import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { calcCombinedTotal, calcDay1Total } from './budgetPricing';

const pdfRuntime = pdfMake as any;
pdfRuntime.vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs;

interface BudgetItem {
  category_id?: string | null; location_id?: string | null;
  location?: { id: string; name: string; color?: string } | null;
  equipment?: { name: string; unit?: string; category?: string };
  work_item?: { name: string; unit?: string };
  quantity: number; price: number; total: number;
  multi_day_rate_override?: number | null; notes?: string; is_extra?: boolean;
  unit?: string | null; marker_color?: string | null;
}
interface Category { id: string; name: string; }
interface Location { id: string; name: string; color?: string; }
interface PDFData {
  eventName: string; eventDate?: string; eventEndDate?: string; createdDate?: string;
  version?: string; venueName?: string; clientName?: string; organizerName?: string;
  budgetItems: BudgetItem[]; categories: Category[]; locations?: Location[];
  exchangeRate: number; paymentMode?: 'usd' | 'byn_cash' | 'byn_noncash';
  discountEnabled?: boolean; discountPercent?: number; discount2Enabled?: boolean;
  discount2Percent?: number; budgetNote?: string; budgetDays: number;
  budgetTotalsMode: 'combined_only' | 'day1_plus_combined';
  totalDay1FromEditor?: number; totalCombinedFromEditor?: number;
  discountedTotalFromEditor?: number; discountedTotalLevel1FromEditor?: number;
  totalWithExtraFromEditor?: number;
}

const money = (value: number) => value.toFixed(2);
const dateRu = (value?: string) => {
  if (!value) return '—';
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value;
};
const esc = (value: string) => value.replace(/[<>]/g, '');

export async function generateBudgetPDF(data: PDFData): Promise<void> {
  const paymentMode = data.paymentMode || 'usd';
  const suffix = paymentMode === 'usd' ? ' $' : ' BYN';
  const categories = new Map(data.categories.map(c => [c.id, c.name]));
  const locations = new Map((data.locations || []).map(l => [l.id, l.name]));
  const groups = new Map<string, BudgetItem[]>();

  data.budgetItems.filter(item => !item.is_extra).forEach(item => {
    const key = item.location_id || 'no-location';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });

  const body: any[] = [[
    { text: 'Наименование', style: 'tableHeader' },
    { text: 'Кол-во', style: 'tableHeader', alignment: 'center' },
    { text: 'Цена', style: 'tableHeader', alignment: 'right' },
    { text: 'Сумма', style: 'tableHeader', alignment: 'right' }
  ]];

  groups.forEach((items, locationId) => {
    const locationName = locationId === 'no-location' ? 'Без локации' : (locations.get(locationId) || 'Локация');
    body.push([{ text: locationName.toUpperCase(), style: 'section', colSpan: 4 }, {}, {}, {}]);
    const byCategory = new Map<string, BudgetItem[]>();
    items.forEach(item => {
      const key=item.category_id || 'uncategorized';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    });
    byCategory.forEach((categoryItems, categoryId) => {
      body.push([{ text: (categories.get(categoryId) || 'Прочее').toUpperCase(), style: 'category', colSpan: 4 }, {}, {}, {}]);
      categoryItems.forEach((item, index) => {
        const name=esc(item.equipment?.name || item.work_item?.name || '—');
        const notes=item.notes?.trim() ? ` — ${esc(item.notes.trim())}` : '';
        const qty=item.quantity || 0;
        const usdTotal=data.budgetTotalsMode === 'combined_only'
          ? calcCombinedTotal(item, data.budgetDays, item.multi_day_rate_override)
          : calcDay1Total(item);
        const unit=item.unit || item.work_item?.unit || item.equipment?.unit || 'шт.';
        const price=item.price || 0;
        body.push([
          { text: `${index + 1}. ${name}${notes}`, style: 'item' },
          { text: `${qty} ${unit}`, style: 'item', alignment: 'center' },
          { text: `${money(price)}${suffix}`, style: 'item', alignment: 'right' },
          { text: `${money(usdTotal)}${suffix}`, style: 'item', alignment: 'right' }
        ]);
      });
      const total=categoryItems.reduce((sum,item)=>sum+(data.budgetTotalsMode === 'combined_only'
        ? calcCombinedTotal(item,data.budgetDays,item.multi_day_rate_override) : calcDay1Total(item)),0);
      body.push([{ text: 'ИТОГО ПО РАЗДЕЛУ', style: 'subtotal', colSpan: 3, alignment: 'right' }, {}, {}, { text: `${money(total)}${suffix}`, style: 'subtotal', alignment: 'right' }]);
    });
  });

  const total = data.budgetTotalsMode === 'combined_only'
    ? data.totalCombinedFromEditor ?? 0 : data.totalDay1FromEditor ?? 0;
  const discount = data.discountedTotalFromEditor;
  const summary: any[] = [
    [{ text: 'ИТОГОВАЯ СУММА', style: 'totalLabel' }, { text: discount !== undefined ? money(discount) + suffix : money(total) + suffix, style: 'totalValue' }]
  ];
  if (discount !== undefined) summary.push([{ text: `ИТОГО СО СКИДКОЙ ${data.discountPercent || 0}%`, style: 'discountLabel' }, { text: money(discount)+suffix, style: 'totalValue' }]);
  if (data.totalWithExtraFromEditor !== undefined) summary.push([{ text: 'ИТОГО С ДОПОЛНИТЕЛЬНЫМИ УСЛУГАМИ', style: 'discountLabel' }, { text: money(data.totalWithExtraFromEditor)+suffix, style: 'totalValue' }]);

  const docDefinition: any = {
    pageSize: 'A4', pageMargins: [32, 32, 32, 36],
    header: (currentPage: number, pageCount: number) => ({
      margin: [32, 18, 32, 0],
      columns: [{ text: 'RentMaster', style: 'brand' }, { text: `Страница ${currentPage} из ${pageCount}`, alignment: 'right', style: 'pageNumber' }]
    }),
    content: [
      { text: 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', style: 'title' },
      { text: data.eventName || 'Мероприятие', style: 'eventName' },
      { columns: [
        { text: [ { text: 'Дата: ', bold: true }, dateRu(data.eventDate) + (data.eventEndDate ? ` — ${dateRu(data.eventEndDate)}` : '') ] },
        { text: [ { text: 'Площадка: ', bold: true }, data.venueName || '—' ] }
      ], style: 'meta' },
      { text: [ { text: 'Заказчик: ', bold: true }, data.clientName || '—', '    ', { text: 'Организатор: ', bold: true }, data.organizerName || '—' ], style: 'meta' },
      { text: `Версия ${data.version || '1.0'}    Дата создания: ${dateRu(data.createdDate)}`, style: 'muted', margin: [0, 0, 0, 14] },
      { table: { headerRows: 1, widths: ['*', 55, 60, 70], body }, layout: 'lightHorizontalLines' },
      { table: { widths: ['*', 150], body: summary }, layout: 'noBorders', margin: [0, 18, 0, 0] },
      ...(data.budgetNote ? [{ text: data.budgetNote, style: 'note', margin: [0, 16, 0, 0] }] : [])
    ],
    styles: {
      brand: { color: '#06b6d4', bold: true, fontSize: 14 },
      pageNumber: { color: '#6b7280', fontSize: 8 },
      title: { fontSize: 17, bold: true, color: '#111827', margin: [0, 0, 0, 8] },
      eventName: { fontSize: 15, bold: true, color: '#0891b2', margin: [0, 0, 0, 10] },
      meta: { fontSize: 9, color: '#374151', margin: [0, 0, 0, 5] },
      muted: { fontSize: 8, color: '#6b7280' },
      tableHeader: { bold: true, fontSize: 8, color: '#ffffff', fillColor: '#111827', margin: [4, 5, 4, 5] },
      section: { bold: true, fontSize: 10, color: '#ffffff', fillColor: '#334155', margin: [4, 6, 4, 6], pageBreak: 'avoid' },
      category: { bold: true, fontSize: 9, color: '#0891b2', fillColor: '#ecfeff', margin: [4, 5, 4, 5], pageBreak: 'avoid' },
      item: { fontSize: 8, color: '#111827', margin: [4, 4, 4, 4] },
      subtotal: { bold: true, fontSize: 8, color: '#111827', margin: [4, 5, 4, 5] },
      totalLabel: { bold: true, fontSize: 10, color: '#111827', margin: [4, 5, 4, 5] },
      totalValue: { bold: true, fontSize: 12, color: '#0891b2', alignment: 'right', margin: [4, 5, 4, 5] },
      discountLabel: { fontSize: 9, color: '#374151', margin: [4, 5, 4, 5] },
      note: { fontSize: 9, color: '#374151', italics: true }
    }
  };

  await new Promise<void>((resolve, reject) => {
    try { pdfRuntime.createPdf(docDefinition).download(`${dateRu(data.eventDate)}_${data.venueName || 'Смета'}_Версия ${data.version || '1.0'}.pdf`, resolve); }
    catch (error) { reject(error); }
  });
}
