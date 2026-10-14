import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { calcCombinedTotal, calcDay1Total } from './budgetPricing';

// Интерфейсы данных [cite: 53]
interface BudgetItem {
  category_id?: string | null;
  location_id?: string | null;
  location?: {
    id: string;
    name: string;
    color?: string;
  } | null;
  equipment?: { name: string; unit?: string; category?: string };
  work_item?: { name: string; unit?: string };
  name?: string;
  quantity: number;
  price: number;
  total: number;
  multi_day_rate_override?: number | null;
  notes?: string;
  is_extra?: boolean;
  unit?: string | null;
  marker_color?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  color?: string;
}

interface PDFData {
  eventName: string;
  eventDate?: string;
  eventEndDate?: string;
  createdDate?: string;
  version?: string;
  venueName?: string;
  clientName?: string;
  organizerName?: string;
  budgetItems: BudgetItem[];
  categories: Category[];
  locations?: Location[];
  exchangeRate: number;
  paymentMode?: 'usd' | 'byn_cash' | 'byn_noncash';
  discountEnabled?: boolean;
  discountPercent?: number;
  discount2Enabled?: boolean;
  discount2Percent?: number;
  // Зависимость скидки организатора (режимы выбора убраны): скидка организатору доступна
  // и без скидки клиенту. Если скидка клиенту НЕ активна — скидка организатору считается
  // от сметы (базы оборудования); если скидка клиенту активна — скидка организатору
  // считается от скидки клиента (последовательное применение: база x (1 - d1) x (1 - d2)).
  budgetNote?: string;
  budgetDays: number;
  budgetTotalsMode: 'combined_only' | 'day1_plus_combined';
  totalDay1FromEditor?: number;
  totalCombinedFromEditor?: number;
  discountedTotalFromEditor?: number;
  // Промежуточный итог со скидкой клиента (без скидки организатора), чтобы в PDF первая
  // строка скидки не восстанавливалась делением на множитель организаторской скидки.
  discountedTotalLevel1FromEditor?: number;
  totalWithExtraFromEditor?: number;
}

const formatDateRu = (dateValue?: string): string => {
  if (!dateValue) return '—';

  const trimmedDate = dateValue.trim();
  if (!trimmedDate) return '—';

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmedDate)) {
    return trimmedDate;
  }

  const isoDateMatch = trimmedDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${day}.${month}.${year}`;
  }

  const parsedDate = new Date(trimmedDate);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleDateString('ru-RU');
  }

  return trimmedDate;
};

// Формат отображения диапазона дат мероприятия: "13.10-15.10.2026"
const formatEventDateRangeRu = (startDate?: string, endDate?: string): string => {
  const formattedStart = formatDateRu(startDate);
  if (!endDate || !endDate.trim() || formattedStart === '—') {
    return formattedStart;
  }

  const formattedEnd = formatDateRu(endDate);
  if (formattedEnd === '—' || formattedEnd === formattedStart) {
    return formattedStart;
  }

  const startParts = formattedStart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const endParts = formattedEnd.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (startParts && endParts) {
    const [, startDay, startMonth, startYear] = startParts;
    const [, endDay, endMonth, endYear] = endParts;
    if (startYear === endYear && startMonth === endMonth) {
      // Один месяц: "13-15.10.2026"
      return `${startDay}-${endDay}.${startMonth}.${startYear}`;
    }
    // Разные месяцы: "13.10-15.10.2026"
    return `${startDay}.${startMonth}-${endDay}.${endMonth}.${endYear}`;
  }

  return `${formattedStart} - ${formattedEnd}`;
};

const isWorkNonDelivery = (item: BudgetItem): boolean => {
  if (!item.work_item?.name) return false;
  const workName = item.work_item.name.toLowerCase();
  return !workName.includes('доставка оборудования') && !workName.includes('доставка персонала');
};

const formatMoney = (value: number): string => value.toFixed(2);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isConsumablesEquipmentItem = (item: BudgetItem): boolean =>
  !item.work_item && item.equipment?.category?.trim().toLowerCase() === 'расходные материалы';

const hexToRgba = (hexColor?: string | null, alpha = 0.26): string | null => {
  if (!hexColor) return null;
  const normalized = hexColor.trim();
  const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const parsed = match[1];
  const r = parseInt(parsed.slice(0, 2), 16);
  const g = parseInt(parsed.slice(2, 4), 16);
  const b = parseInt(parsed.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Кэш dataURL логотипа на уровне модуля: декодирование картинки и дорогой
// canvas.toDataURL('image/png') выполняются один раз за сессию, повторные
// экспорты PDF переиспользуют готовую строку без сетевого запроса и перекодирования.
// Возвращаемое значение байт-в-байт идентично повторной загрузке того же файла,
// поэтому выходной PDF не меняется.
let cachedLogoDataURL: string | null = null;
let pendingLogoPromise: Promise<string> | null = null;

const loadImageAsDataURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};

const getLogoDataURL = (): Promise<string> => {
  if (cachedLogoDataURL) return Promise.resolve(cachedLogoDataURL);
  if (!pendingLogoPromise) {
    // Ограничиваем ожидание логотипа: раньше зависший запрос к /image2.png
    // подвешивал весь экспорт на десятки секунд (браузерный дефолтный таймаут).
    // На успешном пути поведение и выходной PDF не меняются.
    const timeoutMs = 8000;
    pendingLogoPromise = Promise.race([
      loadImageAsDataURL('/image2.png'),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`Logo load timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]).then(
      (dataURL) => {
        cachedLogoDataURL = dataURL;
        return dataURL;
      },
      (error) => {
        // Не кэшируем ошибку: повторный экспорт попробует загрузить логотип снова.
        pendingLogoPromise = null;
        throw error;
      }
    );
  }
  return pendingLogoPromise;
};

// Ожидание шрифтов с верхней границей + отрисовка за два кадра вместо
// фиксированного setTimeout(100). Когда шрифты уже загружены (обычный случай —
// Montserrat в приложении даже не подключён, document.fonts.ready резолвится
// сразу), это убирает ~70–90 мс чистого ожидания на каждый экспорт.
// Рендер при этом идентичен: DOM уже в документе, два rAF гарантируют layout+paint.
const waitForRenderReady = async (timeoutMs = 1500): Promise<void> => {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Отсутствие Font Loading API не должно ломать экспорт.
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
};

// ─── Настройки экспорта ──────────────────────────────────────────────────────
// Режим генератора PDF:
//  - 'vector' (по умолчанию): jsPDF + autoTable, текст векторный. html2canvas не
//    используется вовсе — экспорт занимает десятки миллисекунд независимо от
//    размера сметы, файл весит килобайты, текст копируется/ищется в PDF.
//  - 'raster': legacy-рендер через скриншот DOM (html2canvas). Сохранён как
//    fallback для пиксельно-идентичного результата при необходимости.
type PdfEngine = 'vector' | 'raster';
const PDF_ENGINE: PdfEngine = 'vector';
// Качество растеризации legacy-режима (1 px CSS = scale device px).
// scale 2 → ~4x быстрее scale 4 по времени html2canvas и PNG-кодирования.
const RASTER_SCALE = 2;

// Данные для векторного рендера: плоская структура, из которой страницы собираются
// без DOM. Строки итогов уже отформатированы (с валютой), чтобы не дублировать
// бизнес-логику скидок/округлений.
interface VectorRow {
  name: string;
  qty: string;
  price: string;
  total: string;
  bg?: [number, number, number]; // подсветка маркера строки
}
interface VectorSection {
  kind: 'category';
  title: string;
  rows: VectorRow[];
  totals: { label: string; value: string }[];
}
interface VectorLocation {
  header?: string;
  sections: VectorSection[];
  totals: { label: string; value: string }[];
}
interface VectorFooterLine {
  text: string;
  amount: string;
  underline?: boolean;
  strong?: boolean;
  gapBefore?: boolean;
}
interface VectorRenderData {
  logoDataURL: string;
  title: string;
  versionLine: string;
  createdLine: string;
  infoCells: { label: string; value: string }[];
  locations: VectorLocation[];
  footerLines: VectorFooterLine[];
  extras: VectorSection[];
  extrasTotalLines: VectorFooterLine[];
  note?: string;
}

// ─── Векторный генератор (jsPDF + autoTable) ─────────────────────────────────
// Собирает документ на стандартных A4-страницах: таблица категорий разбивается
// по страницам автоматически, итоги разделов/локаций и футер дописываются после.
function buildVectorPDF(rd: VectorRenderData): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = 210;
  const marginX = 8;
  const contentW = pageW - marginX * 2;
  let y = 8;

  // Логотип слева, шапка справа (как в HTML-версии)
  try {
    const logoH = 16;
    pdf.addImage(rd.logoDataURL, 'PNG', marginX, y, logoH * 2, logoH);
  } catch {
    // логотип не критичен для экспорта
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(26, 26, 26);
  pdf.text(rd.title, pageW - marginX, y + 4, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text(rd.versionLine, pageW - marginX, y + 9, { align: 'right' });
  pdf.text(rd.createdLine, pageW - marginX, y + 13.5, { align: 'right' });
  y += 20;

  // Инфо-блоки (Дата / Локация / Заказчик / Организатор) в сетке 2 колонки
  if (rd.infoCells.length > 0) {
    const colW = contentW / 2;
    rd.infoCells.forEach((cell, idx) => {
      const cx = marginX + (idx % 2) * colW;
      const cy = y + Math.floor(idx / 2) * 9;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(107, 114, 128);
      pdf.text(cell.label.toUpperCase(), cx, cy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(26, 26, 26);
      pdf.text(cell.value, cx, cy + 4);
    });
    y += Math.ceil(rd.infoCells.length / 2) * 9 + 1;
  }
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  pdf.line(marginX, y, pageW - marginX, y);
  y += 4;

  const ensureSpace = (needed: number) => {
    if (y + needed > 282) {
      pdf.addPage();
      y = 12;
    }
  };

  const printSectionTitle = (title: string) => {
    ensureSpace(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title.toUpperCase(), marginX + 3, y + 4);
    y += 6;
  };

  const renderTable = (rows: VectorRow[]) => {
    autoTable(pdf, {
      startY: y,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 0.8, bottom: 2.2, left: 2, right: 2 }, textColor: [26, 26, 26], lineColor: [0, 0, 0], lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 } },
      head: [['Наименование', 'Кол-во', 'Цена', 'Сумма']],
      headStyles: { font: 'helvetica', fontStyle: 'bold', fontSize: 8, textColor: [0, 0, 0], cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, lineWidth: { bottom: 0.3, top: 0, left: 0, right: 0 }, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: contentW * 0.6 },
        1: { cellWidth: contentW * 0.1, halign: 'center' },
        2: { cellWidth: contentW * 0.15, halign: 'right' },
        3: { cellWidth: contentW * 0.15, halign: 'right' },
      },
      body: rows.map((r) => [r.name, r.qty, r.price, r.total]),
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const rowDef = rows[hookData.row.index];
          if (rowDef?.bg) hookData.cell.styles.fillColor = rowDef.bg;
          if (hookData.column.index === 3) hookData.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: marginX, right: marginX, bottom: 12, top: 12 },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.5;
  };

  const printTotals = (totals: { label: string; value: string }[], big: boolean) => {
    totals.forEach((t) => {
      ensureSpace(big ? 9 : 7);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(big ? 11 : 10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${t.label}:`, pageW - marginX - 32, y + 3.5, { align: 'right' });
      pdf.text(t.value, pageW - marginX, y + 3.5, { align: 'right' });
      y += big ? 6.5 : 5.5;
    });
    y += 2;
  };

  rd.locations.forEach((loc) => {
    if (loc.header) {
      ensureSpace(10);
      pdf.setFillColor(75, 85, 99);
      pdf.rect(marginX, y, 1.8, 5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text(loc.header.toUpperCase(), marginX + 4.5, y + 4);
      y += 7;
    }
    loc.sections.forEach((section) => {
      printSectionTitle(section.title);
      renderTable(section.rows);
      printTotals(section.totals, false);
    });
    printTotals(loc.totals, true);
  });

  // Печать жирной строки итога: метка прижата к сумме справа, сумма — к правому краю.
  // Метка не переносится по словам (nowrap), как в HTML-версии; если одна строка
  // не умещается слева от суммы, она обрезается по ширине, чтобы ничего не
  // наезжало на сумму. Возвращает высоту блока для продвижения курсора.
  const printStrongLine = (text: string, amount: string, fontSize: number, underline: boolean): number => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(0, 0, 0);
    const amountW = pdf.getTextWidth(amount);
    const baselineY = y + fontSize * 0.35;
    const maxLabelW = Math.max(10, pageW - marginX - amountW - 4 - marginX);
    pdf.text(pdf.splitTextToSize(text, maxLabelW)[0] || '', pageW - marginX - amountW - 4, baselineY, { align: 'right' });
    pdf.text(amount, pageW - marginX, baselineY, { align: 'right' });
    if (underline) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.6);
      pdf.line(pageW - marginX - amountW, baselineY + 1.2, pageW - marginX, baselineY + 1.2);
    }
    return fontSize * 0.45 + 3;
  };

  // Футер: итоги/скидки — справа, подчёркнутые суммы как в HTML-версии
  rd.footerLines.forEach((line) => {
    if (line.gapBefore) y += 4;
    const fs = line.strong ? 13 : 11;
    ensureSpace(fs + 6);
    y += printStrongLine(line.text, line.amount, fs, Boolean(line.underline));
  });

  // Дополнительные услуги: own section(s) + итоги
  rd.extras.forEach((section) => {
    y += 3;
    printSectionTitle(section.title);
    renderTable(section.rows);
    printTotals(section.totals, false);
  });
  rd.extrasTotalLines.forEach((line) => {
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    ensureSpace(22);
    pdf.line(marginX, y, pageW - marginX, y);
    y += 3;
    y += printStrongLine(line.text, line.amount, 13, Boolean(line.underline));
    y += 3;
  });

  // Примечание
  if (rd.note) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    const noteLines = pdf.splitTextToSize(rd.note, contentW - 6);
    ensureSpace(noteLines.length * 4 + 10);
    pdf.text('ПРИМЕЧАНИЕ', marginX + 3, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(26, 26, 26);
    pdf.text(noteLines, marginX + 3, y + 9);
  }

  return pdf;
}

// Сохранение растерного PDF (скриншот всей сметы на одной странице) — fallback-движок.
const saveRasterPdf = (canvas: HTMLCanvasElement, fileName: string): void => {
  const pageWidth = 210; // A4 width in mm (portrait)
  const imgHeightPx = canvas.height;
  const imgWidthPx = canvas.width;

  // Calculate proportional height in mm to fit content exactly
  // This ensures page height matches the budget content height
  let pageHeight = (imgHeightPx * pageWidth) / imgWidthPx;

  // Ensure portrait orientation: height must be >= width
  // If content is short, set minimum height to width (210mm) to maintain portrait
  // This adds minimal empty space while keeping portrait orientation
  if (pageHeight < pageWidth) {
    pageHeight = pageWidth;
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
    putOnlyUsedFonts: true,
    compress: true
  });

  const renderedImageHeightMm = imgHeightPx * pageWidth / imgWidthPx;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, renderedImageHeightMm);
  pdf.save(`${fileName}.pdf`);
};

export async function generateBudgetPDF(data: PDFData): Promise<void> {
  const formattedEventDate = formatDateRu(data.eventDate);
  const eventDateDisplayHtml = formatEventDateRangeRu(data.eventDate, data.eventEndDate);
  const formattedCreatedDate = formatDateRu(data.createdDate || new Date().toISOString());
  const versionLabel = (data.version || '1.0').trim() || '1.0';

  const logoDataURL = await getLogoDataURL();

  const mainBudgetItems = data.budgetItems.filter((item) => !item.is_extra);
  const extraBudgetItems = data.budgetItems.filter((item) => item.is_extra);

  const groupedByLocation: Record<string, Record<string, BudgetItem[]>> = {};
  mainBudgetItems.forEach((item) => {
    const locationId = item.location_id || 'no-location';
    const categoryId = item.category_id || 'uncategorized';
    if (!groupedByLocation[locationId]) {
      groupedByLocation[locationId] = {};
    }
    if (!groupedByLocation[locationId][categoryId]) {
      groupedByLocation[locationId][categoryId] = [];
    }
    groupedByLocation[locationId][categoryId].push(item);
  });

  const locationNameById = new Map((data.locations || []).map(location => [location.id, location.name]));
  const locationColorById = new Map((data.locations || []).map(location => [location.id, location.color || '#14532d']));
  data.budgetItems.forEach(item => {
    if (item.location_id && item.location?.name && !locationNameById.has(item.location_id)) {
      locationNameById.set(item.location_id, item.location.name);
      locationColorById.set(item.location_id, item.location.color || '#14532d');
    }
  });

  const locationOrder = (data.locations || []).map(location => location.id);

  // Плоские данные для векторного рендера (jsPDF + autoTable) — собираются параллельно
  // с HTML-строками, чтобы бизнес-логика расчёта цен/скидок была общей.
  const vectorLocations: VectorLocation[] = [];
  const vectorExtras: VectorSection[] = [];
  const vectorFooterLines: VectorFooterLine[] = [];
  const vectorExtrasTotalLines: VectorFooterLine[] = [];
  const sortedLocationIds = Object.keys(groupedByLocation).sort((a, b) => {
    if (a === 'no-location') return 1;
    if (b === 'no-location') return -1;
    const indexA = locationOrder.indexOf(a);
    const indexB = locationOrder.indexOf(b);
    const normalizedIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const normalizedIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (normalizedIndexA !== normalizedIndexB) return normalizedIndexA - normalizedIndexB;
    return (locationNameById.get(a) || '').localeCompare(locationNameById.get(b) || '', 'ru');
  });

  const categoryOrder = data.categories.map(c => c.id);

  const container = document.createElement('div');
  // Уменьшены отступы для компактности [cite: 53]
  container.style.cssText = `
    position: absolute; position:relative; width: 800px; height: auto;
    background-color: #ffffff; color: #1a1a1a;
    font-family: 'Montserrat', sans-serif; padding: 20px 30px;
    box-sizing: border-box; line-height: 1.2;
  `;

  let categoriesHtml = '';
  let grandTotalDay1 = 0;
  const grayAccent = '#ffffff'; ///#4b5563
  const paymentMode = data.paymentMode || 'usd';
  const currencySuffix = paymentMode !== 'usd' ? ' BYN' : ' $';

  const budgetDays = Math.max(1, data.budgetDays || 1);
  const isCombinedOnlyMode = data.budgetTotalsMode === 'combined_only';

  const calculatePrice = (usdPrice: number, item?: BudgetItem, round = true): number => {
    const baseAmount = usdPrice * data.exchangeRate;
    switch (paymentMode) {
      case 'byn_cash':
        return round ? Math.ceil(baseAmount) : baseAmount;
      case 'byn_noncash': {
        let withBankRate: number;
        if (item && item.work_item && isWorkNonDelivery(item)) {
          withBankRate = baseAmount * 1.67;
        } else {
          withBankRate = baseAmount / 0.8;
        }
        return round ? Math.ceil(withBankRate) : withBankRate;
      }
      default:
        return usdPrice;
    }
  };

  const roundGrandTotalForPaymentMode = (value: number): number => {
    return Math.floor(value);
  };

  const roundDownToNearestFive = (value: number): number => {
    return Math.floor(value / 5) * 5;
  };

  let grandTotalWorkDay1 = 0;

  // Подсветка строки маркером в векторном PDF: смешение цвета с белым (alpha 0.26)
  const markerToRgb = (hexColor?: string | null): [number, number, number] | undefined => {
    if (!hexColor) return undefined;
    const match = hexColor.trim().match(/^#([0-9a-fA-F]{6})$/);
    if (!match) return undefined;
    const parsed = match[1];
    const mix = (c: number) => Math.round(c * 0.26 + 255 * 0.74);
    return [mix(parseInt(parsed.slice(0, 2), 16)), mix(parseInt(parsed.slice(2, 4), 16)), mix(parseInt(parsed.slice(4, 6), 16))];
  };

  let locationIdx = 0;
  sortedLocationIds.forEach(locationId => {
    const groupedByCategory = groupedByLocation[locationId];
    const sortedCategoryIds = Object.keys(groupedByCategory).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      const normalizedIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const normalizedIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      if (normalizedIndexA !== normalizedIndexB) return normalizedIndexA - normalizedIndexB;
      return a.localeCompare(b, 'ru');
    });

    const isNoLocation = locationId === 'no-location';
    locationIdx++;
    const locationPrefix = `${locationIdx}. `;
    const locationName = isNoLocation ? '' : (locationNameById.get(locationId) || 'Локация');
    const displayLocationName = isNoLocation ? '' : `${locationPrefix}${locationName}`;

    let locationHtml = '';
    const vectorSections: VectorSection[] = [];

    let locationTotalDay1 = 0;
    let locationTotalCombined = 0;

    let categoryIdx = 0;
    sortedCategoryIds.forEach(catId => {
      categoryIdx++;
      const items = groupedByCategory[catId];
      const category = data.categories.find(c => c.id === catId);
      const categoryName = category?.name || 'Прочее';
      const categoryPrefix = `${categoryIdx}. `;

      let categorySumDay1 = 0;
      let categorySumCombined = 0;
      const vectorRows: VectorRow[] = [];
      const rows = items.map((item, itemIdx) => {
        const itemPrefix = `${itemIdx + 1}. `;
        const name = item.name || item.equipment?.name || item.work_item?.name || '—';
        const notes = item.notes?.trim();
        const displayName = notes ? `${name} ${notes}` : name;
        const qty = item.quantity || 0;
        const unit = item.unit || item.work_item?.unit || item.equipment?.unit || 'шт.';
        const usdPriceDay1 = item.price || 0;
        const usdTotalDay1 = calcDay1Total(item);

        // Use rounded values for display
        const displayUnitPriceBYNDay1 = calculatePrice(usdPriceDay1, item, true);
        const displayTotalDay1BYN = calculatePrice(usdTotalDay1, item, true);

        const usdUnitPriceCombined = calcCombinedTotal(
          { price: usdPriceDay1, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
          budgetDays,
          item.multi_day_rate_override
        );
        const displayUnitPriceBYNCombined = calculatePrice(usdUnitPriceCombined, item, true);
        const displayTotalCombinedBYN = displayUnitPriceBYNCombined * qty;

        const rowTotalDisplay = isCombinedOnlyMode ? displayTotalCombinedBYN : displayTotalDay1BYN;
        const rowPriceDisplay = isCombinedOnlyMode ? displayUnitPriceBYNCombined : displayUnitPriceBYNDay1;

        categorySumDay1 += paymentMode === 'usd' ? usdTotalDay1 : displayTotalDay1BYN;
        categorySumCombined += paymentMode === 'usd' ? calcCombinedTotal(item, budgetDays) : displayTotalCombinedBYN;

        vectorRows.push({
          name: `${itemPrefix}${displayName}`,
          qty: `${qty} ${unit}`,
          price: `${formatMoney(rowPriceDisplay)}${currencySuffix}`,
          total: `${formatMoney(rowTotalDisplay)}${currencySuffix}`,
          bg: markerToRgb(item.marker_color),
        });

        const rowBg = hexToRgba(item.marker_color, 0.26);
        return `
          <tr style="border-bottom: 1px solid #000000;${rowBg ? ` background-color: ${rowBg};` : ''}">
            <td style="padding: 0px 8px 8px 10px; font-size: 15px; color: #1a1a1a; width: 60%;">
              <div style="display: flex; align-items: flex-start;">
                <span style="display: inline-block; margin-right: 0.25em; white-space: nowrap; flex-shrink: 0;">${itemPrefix}</span>
                <span style="display: inline-block; min-width: 0; overflow-wrap: anywhere; word-break: break-word;">${displayName}</span>
              </div>
            </td>
            <td style="padding: 0px 8px 8px 10px; font-size: 15px; text-align: center; color: #1a1a1a; width: 10%; white-space: nowrap;">${qty} ${unit}</td>
            <td style="padding: 0px 8px 8px 10px; font-size: 15px; text-align: right; color: #1a1a1a; width: 15%; white-space: nowrap;">${formatMoney(rowPriceDisplay)}${currencySuffix}</td>
            <td style="padding: 0px 8px 8px 10px; font-size: 15px; text-align: right; font-weight: 600; color: #1a1a1a; width: 15%; white-space: nowrap;">${formatMoney(rowTotalDisplay)}${currencySuffix}</td>
          </tr>
        `;
      }).join('');

      const categoryHasOnlyWork = items.every(item => !!item.work_item);
      // Only the work-day-1 total is rendered in the PDF footer; non-work items are
      // already part of grandTotalDay1 below, so no separate non-work total is tracked.
      if (categoryHasOnlyWork) {
        grandTotalWorkDay1 += categorySumDay1;
      }
      grandTotalDay1 += categorySumDay1;
      locationTotalDay1 += categorySumDay1;
      locationTotalCombined += categorySumCombined;
      const categoryTotal = isCombinedOnlyMode ? categorySumCombined : categorySumDay1;

      vectorSections.push({
        kind: 'category',
        title: `${categoryPrefix}${categoryName}`,
        rows: vectorRows,
        totals: [
          { label: 'ИТОГО ПО РАЗДЕЛУ', value: `${formatMoney(categoryTotal)}${currencySuffix}` },
          ...((!isCombinedOnlyMode && budgetDays > 1)
            ? [{ label: `ИТОГО ПО РАЗДЕЛУ ЗА ${budgetDays} ДН.`, value: `${formatMoney(categorySumCombined)}${currencySuffix}` }]
            : []),
        ],
      });

      locationHtml += `
       <div style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px; min-height: 22px;">
          <div style="width: 6px; height: 20px; background: ${grayAccent}; border-radius: 10px; margin-right: 12px; flex-shrink: 0;"></div>
          <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0; padding: 0; min-height: 20px; line-height: 1.2; display: flex; align-items: center; position: relative; top: 0px;">
            ${categoryPrefix}${categoryName}
          </div>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-transform: uppercase; font-size: 13px; color: #000000; border-bottom: 1px solid #000000;">
              <th style="text-align: center; padding: 8px 8px; vertical-align: middle; line-height: 1.2; width: 60%;">Наименование</th>
              <th style="text-align: center; padding: 8px 8px; vertical-align: middle; line-height: 1.2; width: 10%; white-space: nowrap;">Кол-во</th>
              <th style="text-align: right; padding: 8px 8px; vertical-align: middle; line-height: 1.2; width: 15%; white-space: nowrap;">Цена</th>
              <th style="text-align: right; padding: 8px 8px; vertical-align: middle; line-height: 1.2; width: 15%; white-space: nowrap;">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="border-bottom: 1px solid #000000;">
              <td colspan="3" style="padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; white-space: nowrap; color: #000000;">ИТОГО ПО РАЗДЕЛУ:</td>
              <td style="padding: 0px 8px 8px 10px; text-align: right; font-weight: 700; white-space: nowrap; color: #000000; font-size: 18px;">${formatMoney(categoryTotal)}${currencySuffix}</td>
            </tr>
            ${!isCombinedOnlyMode && budgetDays > 1 ? `
            <tr style="border-bottom: 1px solid #000000;">
              <td colspan="3" style="padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; white-space: nowrap; color: #000000;">ИТОГО ПО РАЗДЕЛУ ЗА ${budgetDays} ДН.:</td>
              <td style="padding: 0px 8px 8px 10px; text-align: right; font-weight: 700; white-space: nowrap; color: #000000; font-size: 18px;">${formatMoney(categorySumCombined)}${currencySuffix}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
      `;
    });
    const locationTotal = isCombinedOnlyMode ? locationTotalCombined : locationTotalDay1;

    const locationTotalsHtml = isNoLocation
      ? ''
      : `
        <div style="padding: 2px 8px; display: flex; justify-content: flex-end; align-items: center; gap: 5px;">
          <span style="font-size: 18px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.8px;">Итого локации:</span>
          <span style="font-size: 21px; font-weight: 800; color: #000000;">${formatMoney(locationTotal)}${currencySuffix}</span>
        </div>
        ${!isCombinedOnlyMode && budgetDays > 1 ? `
        <div style="padding: 2px 8px 10px; display: flex; justify-content: flex-end; align-items: center; gap: 5px;">
          <span style="font-size: 18px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.8px;">Итого локации за ${budgetDays} дн.:</span>
          <span style="font-size: 21px; font-weight: 800; color: #000000;">${formatMoney(locationTotalCombined)}${currencySuffix}</span>
        </div>
        ` : ''}
      `;

    const locationHeaderHtml = isNoLocation
  ? ''
  : `<div style="display: flex; align-items: center; margin-bottom: 12px; min-height: 22px;">
      <div style="width: 6px; height: 20px; border-radius: 10px; margin-right: 11px; background: #4b5563; flex-shrink: 0;"></div>
      <div style="
        padding: 0px 12px 12px 0px; 
        height: 22px; 
        font-size: 18px; 
        font-weight: 800; 
        letter-spacing: 1px; 
        text-transform: uppercase; 
        color: #000000; 
        display: flex; 
        align-items: center; 
        justify-content: flex-start;
      ">
        ${displayLocationName}
      </div>
    </div>`;

    categoriesHtml += `
      <section style="margin-bottom: 16px; padding: 14px 14px 6px; background: #ffffff; border: 1px solid #000000; border-radius: 10px;">
        ${locationHeaderHtml}
        ${locationHtml}
        ${locationTotalsHtml}
      </section>
    `;

    vectorLocations.push({
      header: isNoLocation ? undefined : displayLocationName,
      sections: vectorSections,
      totals: isNoLocation ? [] : [
        { label: 'ИТОГО ЛОКАЦИИ', value: `${formatMoney(locationTotal)}${currencySuffix}` },
        ...((!isCombinedOnlyMode && budgetDays > 1)
          ? [{ label: `ИТОГО ЛОКАЦИИ ЗА ${budgetDays} ДН.`, value: `${formatMoney(locationTotalCombined)}${currencySuffix}` }]
          : []),
      ],
    });
  });

  let extraServicesHtml = '';
  if (extraBudgetItems.length > 0) {
    const extraGrouped = extraBudgetItems.reduce<Record<string, BudgetItem[]>>((acc, item) => {
      const categoryId = item.category_id || 'uncategorized-extra';
      if (!acc[categoryId]) acc[categoryId] = [];
      acc[categoryId].push(item);
      return acc;
    }, {});

    const extraCategoriesHtml = Object.entries(extraGrouped)
      .sort(([a], [b]) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        const normalizedIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const normalizedIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
        if (normalizedIndexA !== normalizedIndexB) return normalizedIndexA - normalizedIndexB;
        return a.localeCompare(b, 'ru');
      })
      .map(([categoryId, items]) => {
        const category = data.categories.find((c) => c.id === categoryId);
        const categoryName = category?.name || 'Дополнительные услуги';
        let categoryTotalDay1 = 0;
        let categoryTotalCombined = 0;
        const vectorExtraRows: VectorRow[] = [];
        const rows = items.map((item, itemIdx) => {
          const itemPrefix = `${itemIdx + 1}. `;
          const name = item.name || item.equipment?.name || item.work_item?.name || '—';
          const notes = item.notes?.trim();
          const displayName = notes ? `${name} ${notes}` : name;
          const qty = item.quantity || 0;
          const unit = item.unit || item.work_item?.unit || item.equipment?.unit || 'шт.';
          
          // Calculate price with multi-day coefficient for extra services
          const usdPriceDay1 = item.price || 0;
          const usdPriceCombined = calcCombinedTotal(
            { price: usdPriceDay1, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
            budgetDays,
            item.multi_day_rate_override
          );
          
          const displayUnitPriceBYNDay1 = calculatePrice(usdPriceDay1, item, true);
          const displayUnitPriceBYNCombined = calculatePrice(usdPriceCombined, item, true);
          
          const displayUnitPriceBYN = isCombinedOnlyMode 
            ? displayUnitPriceBYNCombined
            : displayUnitPriceBYNDay1;
          
          const displayTotalBYN = displayUnitPriceBYN * qty;
          const displayTotalDay1BYN = displayUnitPriceBYNDay1 * qty;
          const displayTotalCombinedBYN = displayUnitPriceBYNCombined * qty;
          
          categoryTotalDay1 += paymentMode === 'usd' ? calcDay1Total(item) : displayTotalDay1BYN;
          categoryTotalCombined += paymentMode === 'usd' ? calcCombinedTotal(item, budgetDays) : displayTotalCombinedBYN;
          
          vectorExtraRows.push({
            name: `${itemPrefix}${displayName}`,
            qty: `${qty} ${unit}`,
            price: `${formatMoney(displayUnitPriceBYN)}${currencySuffix}`,
            total: `${formatMoney(displayTotalBYN)}${currencySuffix}`,
            bg: markerToRgb(item.marker_color),
          });
          
          return `
            <tr style="border-bottom: 1px solid #000000;">
              <td style="padding: 8px 8px; font-size: 15px; color: #1a1a1a; width: 60%; vertical-align: middle; line-height: 1.2;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="display: inline-block; margin-right: 0.25em; white-space: nowrap; flex-shrink: 0;">${itemPrefix}</span>
                  <span style="display: inline-block; min-width: 0; overflow-wrap: anywhere; word-break: break-word;">${displayName}</span>
                </div>
              </td>
              <td style="padding: 8px 8px; font-size: 15px; text-align: center; color: #1a1a1a; width: 10%; vertical-align: middle; line-height: 1.2; white-space: nowrap;">${qty} ${unit}</td>
              <td style="padding: 8px 8px; font-size: 15px; text-align: right; color: #1a1a1a; width: 15%; vertical-align: middle; line-height: 1.2; white-space: nowrap;">${formatMoney(displayUnitPriceBYN)}${currencySuffix}</td>
              <td style="padding: 8px 8px; font-size: 15px; text-align: right; font-weight: 600; color: #1a1a1a; width: 15%; vertical-align: middle; line-height: 1.2; white-space: nowrap;">${formatMoney(displayTotalBYN)}${currencySuffix}</td>
            </tr>
          `;
        }).join('');

        const categoryTotal = isCombinedOnlyMode ? categoryTotalCombined : categoryTotalDay1;

        vectorExtras.push({
          kind: 'category',
          title: categoryName,
          rows: vectorExtraRows,
          totals: [
            { label: 'ИТОГО ПО РАЗДЕЛУ', value: `${formatMoney(categoryTotal)}${currencySuffix}` },
            ...((!isCombinedOnlyMode && budgetDays > 1)
              ? [{ label: `ИТОГО ПО РАЗДЕЛУ ЗА ${budgetDays} ДН.`, value: `${formatMoney(categoryTotalCombined)}${currencySuffix}` }]
              : []),
          ],
        });

        return `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; margin-bottom: 8px; min-height: 22px;">
              <div style="width: 6px; height: 20px; background: ${grayAccent}; border-radius: 10px; margin-right: 12px; flex-shrink: 0;"></div>
              <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0; padding: 0; min-height: 20px; line-height: 1.2; display: flex; align-items: center; position: relative; top: 0px;">
                ${categoryName}
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${rows}
                <tr style="border-bottom: 1px solid #000000;">
                  <td colspan="3" style="padding: 0px 8px 8px 10px ; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;">ИТОГО ПО РАЗДЕЛУ:</td>
                  <td style="padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;">${formatMoney(categoryTotal)}${currencySuffix}</td>
                </tr>
                ${!isCombinedOnlyMode && budgetDays > 1 ? `
                <tr style="border-bottom: 1px solid #000000;">
                  <td colspan="3" style="padding: 0px 8px 8px 10px ; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;">ИТОГО ПО РАЗДЕЛУ ЗА ${budgetDays} ДН.:</td>
                  <td style="padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;">${formatMoney(categoryTotalCombined)}${currencySuffix}</td>
                </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

    extraServicesHtml = `
      <section style="margin-top: 20px; padding: 12px 14px; border: 1px solid #000000; border-radius: 10px; background: #ffffff;">
        ${extraCategoriesHtml}
      </section>
    `;
  }

  const trimmedBudgetNote = (data.budgetNote || '').trim();
  const budgetNoteHtml = trimmedBudgetNote
    ? `
      <section style="margin-top: 18px; padding: 14px; border: 1px solid #000000; border-radius: 10px; background: #ffffff;">
        <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; font-weight: 700;">Примечание</div>
        <div style="font-size: 15px; color: #1a1a1a; line-height: 1.4; white-space: normal;">${escapeHtml(trimmedBudgetNote).replace(/\n/g, '<br/>')}</div>
      </section>
    `
    : '';

  // Исправленные блоки Заказчика и Организатора [cite: 63, 64]
  const clientHtml = data.clientName ? `
    <div style="display: flex; flex-direction: column; min-width: 0;">
      <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Заказчик</span>
      <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${data.clientName}</span>
    </div>` : '';

  const organizerHtml = data.organizerName ? `
    <div style="display: flex; flex-direction: column; min-width: 0;">
      <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Организатор</span>
      <span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${data.organizerName}</span>
    </div>` : '';
  const participantsCellsHtml = `${clientHtml}${organizerHtml}`;

  const grandTotalCombined = mainBudgetItems.reduce((sum, item) => {
    const qty = item.quantity || 0;
    const usdUnitPriceCombined = calcCombinedTotal(
      { price: item.price || 0, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
      budgetDays,
      item.multi_day_rate_override
    );
    const unitPriceBYNCombined = calculatePrice(usdUnitPriceCombined, item, false);
    return sum + unitPriceBYNCombined * qty;
  }, 0);

  const discountPercentRaw = data.discountPercent || 0;
  const discountPercentDisplay = Math.round(discountPercentRaw);
  const hasFirstDiscount = Boolean(data.discountEnabled) && discountPercentRaw > 0;
  // Скидка организатора доступна независимо от скидки клиенту:
  // - без активной скидки клиенту она считается от сметы (применяется к базе оборудования);
  // - с активной скидкой клиенту — от скидки клиента (скидки применяются последовательно).
  const hasOrganizerDiscount = Boolean(data.discount2Enabled) && (data.discount2Percent || 0) > 0;
  // Отдельная строка «со скидкой» для организатора печатается только когда есть первый
  // уровень (иначе итог один — «Итого со скидкой на оборудование d2%» от сметы).
  const hasSecondDiscountRow = hasOrganizerDiscount && hasFirstDiscount;
  // Итоговый множитель второй скидки применяется в обоих случаях (от сметы или от скидки клиента).
  const discount2PercentRaw = hasOrganizerDiscount ? (data.discount2Percent || 0) : 0;
  const discount2PercentDisplay = Math.round(discount2PercentRaw);
  const discount2Multiplier = discount2PercentRaw > 0 ? 1 - discount2PercentRaw / 100 : 1;
  const discountLabelHtml = `Итого со скидкой на оборудование ${discountPercentDisplay}%`;
  const discount2LabelHtml = `Итого со скидкой на оборудование ${discount2PercentDisplay}%`;

  const grandTotalDiscountEligibleDay1 = mainBudgetItems
    .filter((item) => !item.work_item && !isConsumablesEquipmentItem(item))
    .reduce((sum, item) => {
      const qty = item.quantity || 0;
      const unitPriceBYN = calculatePrice(item.price || 0, item, true);
      return sum + unitPriceBYN * qty;
    }, 0);
  const grandTotalConsumablesDay1 = mainBudgetItems
    .filter((item) => isConsumablesEquipmentItem(item))
    .reduce((sum, item) => {
      const qty = item.quantity || 0;
      const unitPriceBYN = calculatePrice(item.price || 0, item, true);
      return sum + unitPriceBYN * qty;
    }, 0);
  const grandTotalWorkCombined = mainBudgetItems
    .filter((item) => !!item.work_item)
    .reduce((sum, item) => {
      const qty = item.quantity || 0;
      const usdUnitPriceCombined = calcCombinedTotal(
        { price: item.price || 0, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
        budgetDays,
        item.multi_day_rate_override
      );
      const unitPriceBYNCombined = calculatePrice(usdUnitPriceCombined, item, false);
      return sum + unitPriceBYNCombined * qty;
    }, 0);
  const grandTotalDiscountEligibleCombined = mainBudgetItems
    .filter((item) => !item.work_item && !isConsumablesEquipmentItem(item))
    .reduce((sum, item) => {
      const qty = item.quantity || 0;
      const usdUnitPriceCombined = calcCombinedTotal(
        { price: item.price || 0, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
        budgetDays,
        item.multi_day_rate_override
      );
      const unitPriceBYNCombined = calculatePrice(usdUnitPriceCombined, item, false);
      return sum + unitPriceBYNCombined * qty;
    }, 0);
  const grandTotalConsumablesCombined = mainBudgetItems
    .filter((item) => isConsumablesEquipmentItem(item))
    .reduce((sum, item) => {
      const qty = item.quantity || 0;
      const usdUnitPriceCombined = calcCombinedTotal(
        { price: item.price || 0, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
        budgetDays,
        item.multi_day_rate_override
      );
      const unitPriceBYNCombined = calculatePrice(usdUnitPriceCombined, item, false);
      return sum + unitPriceBYNCombined * qty;
    }, 0);
  const editorDay1Total = data.totalDay1FromEditor ?? roundGrandTotalForPaymentMode(grandTotalDay1);
  const editorCombinedTotal = data.totalCombinedFromEditor ?? roundGrandTotalForPaymentMode(grandTotalCombined);
  const pdfDay1Total = roundDownToNearestFive(editorDay1Total);
  const pdfCombinedTotal = roundDownToNearestFive(editorCombinedTotal);

  // Строки итогов со скидками для PDF. Скидки применяются только к оборудованию
  // (расходники и работа не скидываются).
  const discountEligibleBaseForMode = isCombinedOnlyMode || budgetDays > 1
    ? grandTotalDiscountEligibleCombined
    : grandTotalDiscountEligibleDay1;
  const fixedBaseForMode = isCombinedOnlyMode || budgetDays > 1
    ? grandTotalConsumablesCombined + grandTotalWorkCombined
    : grandTotalConsumablesDay1 + grandTotalWorkDay1;
  const fallbackRound = (value: number) =>
    data.paymentMode === 'usd' ? Math.round(value * 100) / 100 : Math.floor(value);

  // Итоговые суммы со скидками: если редактор передал готовую сумму — берём её как есть,
  // иначе пересчитываем из базовых сумм. Промежуточный итог «после скидки клиента»
  // восстанавливаем делением на множитель организаторской скидки
  // (или берём из discountedTotalLevel1FromEditor).
  // Обе строки округляются кратно 5 в меньшую сторону — как и остальные итоги PDF.
  const editorFinalTotal = data.discountedTotalFromEditor ?? fallbackRound(
    discountEligibleBaseForMode * (1 - discountPercentRaw / 100) * discount2Multiplier + fixedBaseForMode
  );
  // Промежуточный итог по скидке клиента.
  const level1Raw = hasFirstDiscount
    ? (data.discountedTotalLevel1FromEditor
        ?? (hasSecondDiscountRow ? editorFinalTotal / discount2Multiplier : editorFinalTotal))
    : 0;
  const level1Display = roundDownToNearestFive(level1Raw);
  const level2Display = hasSecondDiscountRow ? roundDownToNearestFive(editorFinalTotal) : 0;

  // Общий шаблон итоговых строк («Итого со скидкой на оборудование …%» и
  // «Итого с дополнительными услугами …»): метка всегда выводится в одну строку —
  // для неё отключается верхний регистр (широкие заглавные буквы как раз и не давали
  // месту хватить) и ставится white-space: nowrap. Период «за N дн.» — отдельный
  // nowrap-блок, двоеточие прижимается к концу метки. Ширина строки ограничивается
  // только снизу (min-width), поэтому длинная метка может занять всю ширину
  // контейнера и не переносится на вторую строку.
  const TOTAL_ROW_MIN_WIDTH = 640;
  // Подчёркивается сумма строки организатора (строки со скидкой организатора);
  // сумма строки клиента — без подчёркивания. Между цифрами и линией подчёркивания
  // делается отступ (padding-bottom), чтобы линия не прилипала к числу.
  const makeTotalRowHtml = (
    label: string,
    amount: number,
    options: {
      underlineAmount?: boolean;
      period?: string;
      minWidth?: number;
      extraContainerStyle?: string;
    } = {}
  ) => {
    const { underlineAmount = false, period = '', minWidth = TOTAL_ROW_MIN_WIDTH, extraContainerStyle = '' } = options;
    const periodPart = period ? ` <span style="white-space: nowrap;">${period}</span>` : '';
    // Отступ между числом и линией: text-decoration: underline игнорирует padding,
    // поэтому линия делается через border-bottom + padding-bottom.
    const amountDecoration = underlineAmount
      ? ' border-bottom: 2px solid #000000; padding-bottom: 8px;'
      : '';
    return `
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; min-width: ${minWidth}px;${extraContainerStyle}">
        <span style="font-size: 24px; font-weight: 650; color: #000000; text-align: right; line-height: 1.2; flex: 1;"><span style="white-space: nowrap;">${label}</span>${periodPart}:</span>
        <span style="font-size: 30px; font-weight: 700; line-height: 1.2; color: #000000; text-align: right; white-space: nowrap;${amountDecoration}">${formatMoney(amount)}${currencySuffix}</span>
      </div>`;
  };

  const makeDiscountRowHtml = (label: string, amount: number, underlineAmount = false) =>
    makeTotalRowHtml(label, amount, {
      underlineAmount,
      period: budgetDays === 1 ? '' : `за ${budgetDays} дн.`
    });

  // Строки скидок: строка клиента (d1) и строка организатора (d2). Скидка организатора
  // доступна и без скидки клиенту — в этом случае печатается одна итоговая строка
  // «Итого со скидкой на оборудование d2%» (скидка считается от сметы, сумма подчёркнута).
  // При активной скидке клиенту печатаются обе строки, а итог — последовательное
  // применение обеих скидок (скидка организатору — от скидки клиента; зависимость выше).
  const singleDiscountLabelHtml = hasFirstDiscount ? discountLabelHtml : discount2LabelHtml;
  const discountRowsHtml = (hasFirstDiscount || hasOrganizerDiscount)
    ? (hasSecondDiscountRow
        ? makeDiscountRowHtml(discountLabelHtml, level1Display) +
          makeDiscountRowHtml(discount2LabelHtml, level2Display, true)
        : makeDiscountRowHtml(
            singleDiscountLabelHtml,
            roundDownToNearestFive(editorFinalTotal),
            !hasFirstDiscount
          ))
    : '';

  // Build the total with extras for PDF
  // Calculate extra services totals for both day1 and combined modes
  const extraTotalDay1 = extraBudgetItems.length > 0
    ? extraBudgetItems.reduce((sum, item) => {
        const qty = item.quantity || 0;
        const usdPriceDay1 = item.price || 0;
        const unitPriceBYNDay1 = calculatePrice(usdPriceDay1, item, false);
        return sum + unitPriceBYNDay1 * qty;
      }, 0)
    : 0;
    
  const extraTotalCombined = extraBudgetItems.length > 0
    ? extraBudgetItems.reduce((sum, item) => {
        const qty = item.quantity || 0;
        const usdPriceDay1 = item.price || 0;
        const usdPriceCombined = calcCombinedTotal(
          { price: usdPriceDay1, quantity: 1, multi_day_rate_override: item.multi_day_rate_override },
          budgetDays,
          item.multi_day_rate_override
        );
        const unitPriceBYNCombined = calculatePrice(usdPriceCombined, item, false);
        return sum + unitPriceBYNCombined * qty;
      }, 0)
    : 0;
    
  const mainTotalDay1 = pdfDay1Total;
  const mainTotalCombined = pdfCombinedTotal;
  
  // Calculate discounted totals for use with extras. Сумма «со скидкой» считается
  // по той же формуле, что и в редакторе (скидка применяется только к оборудованию),
  // с промежуточным итогом после скидки клиента (без скидки организатора), вниз кратно 5.
  const fixedDay1 = grandTotalConsumablesDay1 + grandTotalWorkDay1;
  const fixedCombined = grandTotalConsumablesCombined + grandTotalWorkCombined;
  // Промежуточный итог после скидки клиента (без скидки организатора):
  const level1Day1 = grandTotalDiscountEligibleDay1 * (1 - discountPercentRaw / 100) + fixedDay1;
  const level1Combined = grandTotalDiscountEligibleCombined * (1 - discountPercentRaw / 100) + fixedCombined;
  // Окончательный итог: обе скидки применяются последовательно (скидка организатора —
  // от результата скидки клиента).
  const finalDay1 = (level1Day1 - fixedDay1) * discount2Multiplier + fixedDay1;
  const finalCombined = (level1Combined - fixedCombined) * discount2Multiplier + fixedCombined;

  // Если редактор передал точную сумму (например, введённую вручную) — берём её,
  // иначе используем пересчитанное значение. Округление вниз кратно 5.
  // Скидки применяются, если активен хотя бы один уровень (клиент или организатор).
  const hasAppliedDiscount = hasFirstDiscount || hasOrganizerDiscount;

  // Итоги «со скидкой» отдельно для каждого периода. В режиме «Итого за 1дн и Nдн»
  // при выводе обеих сумм скидка считается от суммы оборудования соответствующего
  // дня: для N-го итога — от суммы на N день (combined), а не на первый.
  // Ручная сумма из редактора (discountedTotalFromEditor) относится к текущему
  // режиму итогов: в combined_only — к N-дневному итогу, в day1_plus_combined — к итогу за 1 день.
  const discountedTotalForPeriod = (period: 'day1' | 'combined'): number => {
    if (!hasAppliedDiscount) return period === 'combined' ? mainTotalCombined : mainTotalDay1;
    const manualAppliesToPeriod = (period === 'combined') === isCombinedOnlyMode;
    if (manualAppliesToPeriod && data.discountedTotalFromEditor !== undefined) {
      return roundDownToNearestFive(data.discountedTotalFromEditor);
    }
    const level1 = period === 'combined' ? level1Combined : level1Day1;
    const final = period === 'combined' ? finalCombined : finalDay1;
    // Без второй строки скидок печатается только итог со скидкой клиента —
    // промежуточный уровень (без множителя организатора).
    return roundDownToNearestFive(hasSecondDiscountRow ? final : level1);
  };

  const discountedTotalDay1 = discountedTotalForPeriod('day1');
  const discountedTotalCombined = discountedTotalForPeriod('combined');

  // Total with extras for each mode: discounted main total + extra services
  // Apply round down to nearest 5 for consistency with main totals
  const grandTotalWithExtrasDay1 = data.totalWithExtraFromEditor !== undefined && !isCombinedOnlyMode
    ? roundDownToNearestFive(data.totalWithExtraFromEditor)
    : roundDownToNearestFive(discountedTotalDay1 + extraTotalDay1);
    
  const grandTotalWithExtrasCombined = data.totalWithExtraFromEditor !== undefined && isCombinedOnlyMode
    ? roundDownToNearestFive(data.totalWithExtraFromEditor)
    : roundDownToNearestFive(discountedTotalCombined + extraTotalCombined);

  // Show extra services totals only if checkbox is enabled (totalWithExtraFromEditor is provided)
  // and there are extra items
  const showExtraTotals = data.totalWithExtraFromEditor !== undefined && extraBudgetItems.length > 0;
  
  if (showExtraTotals) {
    // Строки «Итого с дополнительными услугами» выводятся по тому же шаблону, что и
    // строка «Итого со скидкой на оборудование …%»: метка в одну строку (white-space:
    // nowrap, без UPPERCASE и letter-spacing), чтобы текст не переносился на 2 строчки.
    const extrasLabel = 'Итого с дополнительными услугами';
    const extrasContainerStyle = ' margin-top: 20px; padding: 20px 0 40px 0; border-top: 2px solid #000000;';
    // Итог с доп. услугами за период = скинутая база этого периода + доп. услуги периода.
    const makeGrandTotalWithExtrasForPeriod = (period: 'day1' | 'combined') =>
      roundDownToNearestFive(discountedTotalForPeriod(period) + (period === 'combined' ? extraTotalCombined : extraTotalDay1));
    // Show totals based on mode
    if (isCombinedOnlyMode) {
      // Combined only mode: show only combined total with extras
      extraServicesHtml += makeTotalRowHtml(
        extrasLabel,
        grandTotalWithExtrasCombined,
        {
          period: budgetDays === 1 ? '' : `за ${budgetDays} дн.`,
          extraContainerStyle: extrasContainerStyle
        }
      );
    } else {
      // Day1 plus combined mode: in multi-day mode only the N-day total with extras
      // is shown (the "за 1 день" row with extra services is removed by design).
      if (budgetDays === 1) {
        extraServicesHtml += makeTotalRowHtml(extrasLabel, grandTotalWithExtrasDay1, {
          extraContainerStyle: extrasContainerStyle
        });
      } else {
        extraServicesHtml += makeTotalRowHtml(extrasLabel, makeGrandTotalWithExtrasForPeriod('combined'), {
          period: `за ${budgetDays} дн.`,
          extraContainerStyle: extrasContainerStyle
        });
      }
    }
  }

  const footerTotalsHtml = isCombinedOnlyMode
    ? `
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; max-width: 450px;">
        <span style="font-size: 24px; font-weight: 650; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; line-height: 1.2; flex: 1;">${budgetDays === 1 ? 'ИТОГО:' : `Итого за ${budgetDays} дн.:`}</span>
        <span style="font-size: 30px; font-weight: 700; line-height: 1.2; text-align: right; white-space: nowrap; color: #000000;">${formatMoney(pdfCombinedTotal)}${currencySuffix}</span>
      </div>
      ${discountRowsHtml}
    `
    : `
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; max-width: 450px;">
        <span style="font-size: 24px; font-weight: 650; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; line-height: 1.2; flex: 1;">${budgetDays === 1 ? 'ИТОГО:' : 'Итого за 1 день:'}</span>
        <span style="font-size: 30px; font-weight: 700; line-height: 1.2; text-align: right; white-space: nowrap; color: #000000;">${formatMoney(pdfDay1Total)}${currencySuffix}</span>
      </div>
      ${budgetDays > 1 ? `
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; width: 100%; max-width: 450px;">
        <span style="font-size: 24px; font-weight: 650; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; line-height: 1.2; flex: 1;">Итого за ${budgetDays} дн.:</span>
        <span style="font-size: 30px; font-weight: 700; line-height: 1.2; text-align: right; white-space: nowrap; color: #000000;">${formatMoney(pdfCombinedTotal)}${currencySuffix}</span>
      </div>
      ` : ''}
      ${discountRowsHtml}
    `;

  // ─── Плоские данные для векторного рендера ─────────────────────────────────
  // Шапка документа
  const vectorInfoCells: { label: string; value: string }[] = [
    { label: 'Дата', value: eventDateDisplayHtml },
    { label: 'Локация', value: data.venueName || '—' },
  ];
  if (data.clientName) vectorInfoCells.push({ label: 'Заказчик', value: data.clientName });
  if (data.organizerName) vectorInfoCells.push({ label: 'Организатор', value: data.organizerName });

  // Итоговые строки футера (ИТОГО / за N дн.) — по той же логике, что и HTML-версия
  if (isCombinedOnlyMode) {
    vectorFooterLines.push({
      text: budgetDays === 1 ? 'ИТОГО:' : `Итого за ${budgetDays} дн.:`,
      amount: `${formatMoney(pdfCombinedTotal)}${currencySuffix}`,
      strong: true,
    });
  } else {
    vectorFooterLines.push({
      text: budgetDays === 1 ? 'ИТОГО:' : 'Итого за 1 день:',
      amount: `${formatMoney(pdfDay1Total)}${currencySuffix}`,
      strong: true,
    });
    if (budgetDays > 1) {
      vectorFooterLines.push({
        text: `Итого за ${budgetDays} дн.:`,
        amount: `${formatMoney(pdfCombinedTotal)}${currencySuffix}`,
        strong: true,
      });
    }
  }

  // Строки скидок: зеркалим discountRowsHtml (клиент d1, организатор d2 с подчёркиванием)
  const periodSuffix = budgetDays === 1 ? '' : ` за ${budgetDays} дн.`;
  const discountRowText = (label: string) => `${label}${periodSuffix}:`;
  if (hasFirstDiscount || hasOrganizerDiscount) {
    if (hasSecondDiscountRow) {
      vectorFooterLines.push({
        text: discountRowText(discountLabelHtml),
        amount: `${formatMoney(level1Display)}${currencySuffix}`,
        strong: true,
        gapBefore: true,
      });
      vectorFooterLines.push({
        text: discountRowText(discount2LabelHtml),
        amount: `${formatMoney(level2Display)}${currencySuffix}`,
        strong: true,
        underline: true,
      });
    } else {
      vectorFooterLines.push({
        text: discountRowText(hasFirstDiscount ? discountLabelHtml : discount2LabelHtml),
        amount: `${formatMoney(roundDownToNearestFive(editorFinalTotal))}${currencySuffix}`,
        strong: true,
        underline: !hasFirstDiscount,
        gapBefore: true,
      });
    }
  }

  // Строки «Итого с дополнительными услугами» — зеркалят extraServicesHtml.
  // Итог с доп. услугами за период = скинутая база этого периода + доп. услуги периода.
  const makeGrandTotalWithExtrasForPeriod = (period: 'day1' | 'combined') =>
    roundDownToNearestFive(discountedTotalForPeriod(period) + (period === 'combined' ? extraTotalCombined : extraTotalDay1));

  if (showExtraTotals) {
    const extrasLabel = 'Итого с дополнительными услугами';
    const pushExtrasLine = (amount: number, withPeriod: boolean) => {
      vectorExtrasTotalLines.push({
        text: `${extrasLabel}${withPeriod && budgetDays > 1 ? ` за ${budgetDays} дн.` : ''}:`,
        amount: `${formatMoney(amount)}${currencySuffix}`,
        strong: true,
      });
    };
    if (isCombinedOnlyMode) {
      pushExtrasLine(grandTotalWithExtrasCombined, budgetDays !== 1);
    } else if (budgetDays === 1) {
      pushExtrasLine(grandTotalWithExtrasDay1, false);
    } else {
      pushExtrasLine(makeGrandTotalWithExtrasForPeriod('combined'), true);
    }
  }

  const vectorRenderData: VectorRenderData = {
    logoDataURL,
    title: 'Коммерческое предложение',
    versionLine: `Версия ${versionLabel}`,
    createdLine: `Дата создания: ${formattedCreatedDate}`,
    infoCells: vectorInfoCells,
    locations: vectorLocations,
    footerLines: vectorFooterLines,
    extras: vectorExtras,
    extrasTotalLines: vectorExtrasTotalLines,
    note: trimmedBudgetNote || undefined,
  };

  // Формируем имя файла: Дата_Площадка_Версия (общее для обоих движков)
  const fileNameParts: string[] = [];

  if (formattedEventDate && formattedEventDate !== '—') {
    fileNameParts.push(formattedEventDate);
  }

  if (data.venueName) {
    fileNameParts.push(data.venueName);
  }

  fileNameParts.push(`Версия ${versionLabel}`);

  // Убираем недопустимые символы для имени файла
  const fileName = fileNameParts.join('_').replace(/[<>:"/\\|?*]/g, '_');

  // Векторный движок не использует DOM/html2canvas вообще — экспорт занимает
  // десятки миллисекунд вместо десятков секунд на скриншот длинной сметы.
  if (PDF_ENGINE === 'vector') {
    buildVectorPDF(vectorRenderData).save(`${fileName}.pdf`);
    return;
  }

  container.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #000000; padding-bottom: 15px;">
      <div style="display: flex; align-items: center;">
        <img src="${logoDataURL}" style="width: 150px; height: auto; margin-top: 15px;" alt="Logo" />
      </div>
      
      <div style="flex: 1; margin-left: 30px; display: flex; flex-direction: column; align-items: flex-end;">
        <div style="text-align: right; margin-bottom: 8px;">
          <div style="font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1a1a1a;">Коммерческое предложение</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 2px;">Версия ${versionLabel}</div>
          <div style="font-size: 14px; color: #6b7280; margin-top: 2px;">Дата создания: ${formattedCreatedDate}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; background: #ffffff; border: 1px solid #000000; border-radius: 12px; padding: 10px 16px; width: 350px; box-sizing: border-box;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Дата</span>
            <span style="font-size: 16px; font-weight: 600;">${eventDateDisplayHtml}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Локация</span>
            <span style="font-size: 16px; font-weight: 600;">${data.venueName || '—'}</span>
          </div>
          ${participantsCellsHtml}
        </div>
      </div>
    </header>

    ${categoriesHtml}

    <footer style="margin-top: 25px; border-top: 2px solid #000000; padding-top: 15px; padding-bottom: 16px; display: flex; justify-content: flex-end;">
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding-right: 0px; width: 100%;">
        ${footerTotalsHtml}
      </div>
    </footer>
    ${extraServicesHtml}
    ${budgetNoteHtml}
    <div style="height: 80px; background: #ffffff;"></div>
  `;

  document.body.appendChild(container);
  await waitForRenderReady();
  const canvas = await html2canvas(container, {
    scale: RASTER_SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    imageTimeout: 5000,
    removeContainer: false,
    height: container.scrollHeight,
    windowHeight: container.scrollHeight
  });

  container.remove();

  // Растерный fallback: скриншот всей сметы на одной странице.
  saveRasterPdf(canvas, fileName);
}
