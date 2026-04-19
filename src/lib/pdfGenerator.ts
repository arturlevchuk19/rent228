import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  equipment?: { name: string; unit?: string };
  work_item?: { name: string; unit?: string };
  quantity: number;
  price: number;
  total: number;
  multi_day_rate_override?: number | null;
  notes?: string;
  is_extra?: boolean;
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
  budgetDays: number;
  budgetTotalsMode: 'combined_only' | 'day1_plus_combined';
  totalDay1FromEditor?: number;
  totalCombinedFromEditor?: number;
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

const calculateBYNCashPrice = (priceUSD: number, exchangeRate: number): number => {
  const baseAmount = priceUSD * exchangeRate;
  return Math.ceil(baseAmount);
};

const isWorkNonDelivery = (item: BudgetItem): boolean => {
  if (!item.work_item?.name) return false;
  const workName = item.work_item.name.toLowerCase();
  return !workName.includes('доставка оборудования') && !workName.includes('доставка персонала');
};

const calculateBYNNonCashPrice = (priceUSD: number, exchangeRate: number, item?: BudgetItem): number => {
  const baseAmount = priceUSD * exchangeRate;
  let withBankRate: number;
  if (item && item.work_item && isWorkNonDelivery(item)) {
    withBankRate = baseAmount * 1.67;
  } else {
    withBankRate = baseAmount / 0.8;
  }
  return Math.ceil(withBankRate);
};

const formatMoney = (value: number): string => value.toFixed(2);

export async function generateBudgetPDF(data: PDFData): Promise<void> {
  const formattedEventDate = formatDateRu(data.eventDate);
  const formattedCreatedDate = formatDateRu(data.createdDate || new Date().toISOString());
  const versionLabel = (data.version || '1.0').trim() || '1.0';

  const loadImageAsDataURL = async (url: string): Promise<string> => {
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

  const logoDataURL = await loadImageAsDataURL('/image.png');

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
    position: absolute; left: -9999px; width: 800px; height: auto;
    background-color: #ffffff; color: #111827;
    font-family: 'Montserrat', sans-serif; padding: 25px 40px;
    box-sizing: border-box; line-height: 1.2;
  `;

  let categoriesHtml = '';
  let grandTotalDay1 = 0;
  const grayAccent = '#6b7280';
  const textPrimary = '#111827';
  const textMuted = '#6b7280';
  const borderStrong = '#000000';
  const borderSoft = '#000000';
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

  let grandTotalNonWorkDay1 = 0;
  let grandTotalWorkDay1 = 0;

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
    const locationAccent = isNoLocation ? '#4b5563' : (locationColorById.get(locationId) || '#14532d');

    let locationHtml = '';

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
      const rows = items.map((item, itemIdx) => {
        const itemPrefix = `${itemIdx + 1}. `;
        const name = item.equipment?.name || item.work_item?.name || '—';
        const notes = item.notes?.trim();
        const displayName = `${itemPrefix}${notes ? `${name} ${notes}` : name}`;
        const qty = item.quantity || 0;
        const unit = item.work_item?.unit || item.equipment?.unit || 'шт.';
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

        return `
          <tr>
            <td style="padding: 6px 8px; font-size: 13px; color: ${textPrimary}; width: 60%;">${displayName}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: center; color: ${textPrimary}; width: 10%;">${qty} ${unit}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: right; color: ${textPrimary}; width: 15%;">${formatMoney(rowPriceDisplay)}${currencySuffix}</td>
            <td style="padding: 6px 8px; font-size: 13px; text-align: right; font-weight: 600; color: ${textPrimary}; width: 15%;">${formatMoney(rowTotalDisplay)}${currencySuffix}</td>
          </tr>
        `;
      }).join('');

      const categoryHasOnlyWork = items.every(item => !!item.work_item);
      if (categoryHasOnlyWork) {
        grandTotalWorkDay1 += categorySumDay1;
      } else {
        grandTotalNonWorkDay1 += categorySumDay1;
      }
      grandTotalDay1 += categorySumDay1;
      locationTotalDay1 += categorySumDay1;
      locationTotalCombined += categorySumCombined;
      const categoryTotal = isCombinedOnlyMode ? categorySumCombined : categorySumDay1;

      locationHtml += `
       <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px; min-height: 22px;">
          <div style="width: 6px; height: 20px; background: ${grayAccent}; border-radius: 10px; margin-right: 12px; flex-shrink: 0;"></div>
          <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin: 0; padding: 0; height: 20px; line-height: 20px; display: flex; align-items: center; position: relative; top: -4px;">
            ${categoryPrefix}${categoryName}
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-transform: uppercase; font-size: 9px; color: ${textPrimary}; border-bottom: 1px solid ${borderStrong};">
              <th style="text-align: left; padding: 6px 8px;">Наименование</th>
              <th style="text-align: center; padding: 6px 8px;">Кол-во</th>
              <th style="text-align: right; padding: 6px 8px;">Цена</th>
              <th style="text-align: right; padding: 6px 8px;">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-size: 10px; font-weight: 700; color: ${textPrimary};">ИТОГО ПО РАЗДЕЛУ:</td>
              <td style="padding: 8px; text-align: right; font-weight: 700; color: ${textPrimary}; font-size: 13px;">${formatMoney(categoryTotal)}${currencySuffix}</td>
            </tr>
            ${!isCombinedOnlyMode && budgetDays > 1 ? `
            <tr>
              <td colspan="3" style="padding: 8px; text-align: right; font-size: 10px; font-weight: 700; color: ${textPrimary};">ИТОГО ПО РАЗДЕЛУ ЗА ${budgetDays} ДН.:</td>
              <td style="padding: 8px; text-align: right; font-weight: 700; color: ${textPrimary}; font-size: 13px;">${formatMoney(categorySumCombined)}${currencySuffix}</td>
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
        <div style="margin-top: 8px; padding: 10px 8px; display: flex; justify-content: flex-end; align-items: center; gap: 14px; border-top: 1px dashed ${borderStrong};">
          <span style="font-size: 11px; font-weight: 700; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.8px;">Итого локации:</span>
          <span style="font-size: 14px; font-weight: 800; color: ${textPrimary};">${formatMoney(locationTotal)}${currencySuffix}</span>
        </div>
        ${!isCombinedOnlyMode && budgetDays > 1 ? `
        <div style="padding: 2px 8px 10px; display: flex; justify-content: flex-end; align-items: center; gap: 14px;">
          <span style="font-size: 11px; font-weight: 700; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.8px;">Итого локации за ${budgetDays} дн.:</span>
          <span style="font-size: 14px; font-weight: 800; color: ${textPrimary};">${formatMoney(locationTotalCombined)}${currencySuffix}</span>
        </div>
        ` : ''}
      `;

    const locationHeaderHtml = isNoLocation
  ? ''
  : `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; min-height: 22px;">
      <div style="width: 6px; height: 20px; border-radius: 9999px; background: ${locationAccent};"></div>
      <div style="
        padding: 0px 12px 6px; 
        height: 22px; 
        border-radius: 9999px; 
        font-size: 10px; 
        font-weight: 800; 
        letter-spacing: 0.5px; 
        text-transform: uppercase; 
        color: #f3f4f6; 
        background: ${locationAccent}; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      ">
        ${displayLocationName}
      </div>
    </div>`;

    categoriesHtml += `
      <section style="margin-bottom: 24px; padding: 14px 14px 6px; background: #f9fafb; border: 1px solid ${borderSoft}; border-radius: 10px;">
        ${locationHeaderHtml}
        ${locationHtml}
        ${locationTotalsHtml}
      </section>
    `;
  });

  let extraServicesHtml = '';
  if (extraBudgetItems.length > 0) {
    const extraGrouped = extraBudgetItems.reduce<Record<string, BudgetItem[]>>((acc, item) => {
      const categoryId = item.category_id || 'uncategorized-extra';
      if (!acc[categoryId]) acc[categoryId] = [];
      acc[categoryId].push(item);
      return acc;
    }, {});

    const extraCategoriesHtml = Object.entries(extraGrouped).map(([categoryId, items]) => {
      const category = data.categories.find((c) => c.id === categoryId);
      const categoryName = category?.name || 'Дополнительные услуги';
      let categoryTotal = 0;
      const rows = items.map((item) => {
        const name = item.equipment?.name || item.work_item?.name || '—';
        const notes = item.notes?.trim();
        const displayName = notes ? `${name} ${notes}` : name;
        const qty = item.quantity || 0;
        const unit = item.work_item?.unit || item.equipment?.unit || 'шт.';
        const price = calculatePrice(item.price || 0, item);
        const total = price * qty;
        categoryTotal += total;
        return `
          <tr>
            <td style="padding: 5px 8px; font-size: 12px; color: ${textPrimary}; width: 60%;">${displayName}</td>
            <td style="padding: 5px 8px; font-size: 12px; text-align: center; color: ${textPrimary}; width: 10%;">${qty} ${unit}</td>
            <td style="padding: 5px 8px; font-size: 12px; text-align: right; color: ${textPrimary}; width: 15%;">${formatMoney(price)}${currencySuffix}</td>
            <td style="padding: 5px 8px; font-size: 12px; text-align: right; font-weight: 600; color: ${textPrimary}; width: 15%;">${formatMoney(total)}${currencySuffix}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 14px;">
          <div style="font-size: 12px; font-weight: 700; color: ${textPrimary}; margin-bottom: 6px; text-transform: uppercase;">${categoryName}</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${rows}
              <tr>
                <td colspan="3" style="padding: 6px 8px; text-align: right; font-size: 10px; font-weight: 700; color: ${textPrimary};">ИТОГО ПО РАЗДЕЛУ:</td>
                <td style="padding: 6px 8px; text-align: right; font-size: 12px; font-weight: 700; color: ${textPrimary};">${formatMoney(categoryTotal)}${currencySuffix}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    extraServicesHtml = `
      <section style="margin-top: 20px; padding: 12px 14px; border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 10px; background: rgba(91, 33, 182, 0.08);">
        ${extraCategoriesHtml}
      </section>
    `;
  }

  // Исправленные блоки Заказчика и Организатора [cite: 63, 64]
  const clientHtml = data.clientName ? `
    <div style="display: flex; flex-direction: column; min-width: 0;">
      <span style="font-size: 8px; color: ${textMuted}; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Заказчик</span>
      <span style="font-size: 11px; font-weight: 600; color: ${textPrimary};">${data.clientName}</span>
    </div>` : '';

  const organizerHtml = data.organizerName ? `
    <div style="display: flex; flex-direction: column; min-width: 0;">
      <span style="font-size: 8px; color: ${textMuted}; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Организатор</span>
      <span style="font-size: 11px; font-weight: 600; color: ${textPrimary};">${data.organizerName}</span>
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
  const grandTotalWithDiscountDay1 = grandTotalNonWorkDay1 * (1 - discountPercentRaw / 100) + grandTotalWorkDay1;

  const grandTotalNonWorkCombined = mainBudgetItems
    .filter((item) => !item.work_item)
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
  const grandTotalWithDiscountCombined = grandTotalNonWorkCombined * (1 - discountPercentRaw / 100) + grandTotalWorkCombined;

  const editorDay1Total = data.totalDay1FromEditor ?? roundGrandTotalForPaymentMode(grandTotalDay1);
  const editorCombinedTotal = data.totalCombinedFromEditor ?? roundGrandTotalForPaymentMode(grandTotalCombined);
  const pdfDay1Total = roundDownToNearestFive(editorDay1Total);
  const pdfCombinedTotal = roundDownToNearestFive(editorCombinedTotal);

  const footerTotalsHtml = isCombinedOnlyMode
    ? `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">Итого за ${budgetDays} дн.:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; text-align: right; white-space: nowrap;">${formatMoney(pdfCombinedTotal)}${currencySuffix}</span>
      </div>
      ${data.discountEnabled && discountPercentRaw > 0 ? `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">Со скидкой ${discountPercentDisplay}% на оборудование за ${budgetDays} дн.:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; color: #4ade80; text-align: right; white-space: nowrap;">${formatMoney(roundGrandTotalForPaymentMode(grandTotalWithDiscountCombined))}${currencySuffix}</span>
      </div>` : ''}
    `
    : `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">${budgetDays === 1 ? 'ИТОГО:' : 'Итого за 1 день:'}</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; text-align: right; white-space: nowrap;">${formatMoney(pdfDay1Total)}${currencySuffix}</span>
      </div>
      ${budgetDays > 1 ? `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">Итого за ${budgetDays} дн.:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; text-align: right; white-space: nowrap;">${formatMoney(pdfCombinedTotal)}${currencySuffix}</span>
      </div>
      ` : ''}
      ${data.discountEnabled && discountPercentRaw > 0 ? `
      ${budgetDays > 1 ? `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">Со скидкой ${discountPercentDisplay}% на оборудование за ${budgetDays} дн.:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; color: #4ade80; text-align: right; white-space: nowrap;">${formatMoney(roundGrandTotalForPaymentMode(grandTotalWithDiscountCombined))}${currencySuffix}</span>
      </div>
      ` : `
      <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; width: 100%;">
        <span style="font-size: 10px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: 1px; text-align: right; line-height: 1.2;">Со скидкой ${discountPercentDisplay}% на оборудование:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1.1; color: #4ade80; text-align: right; white-space: nowrap;">${formatMoney(roundGrandTotalForPaymentMode(grandTotalWithDiscountDay1))}${currencySuffix}</span>
      </div>
      `}` : ''}
    `;

  container.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid ${borderStrong}; padding-bottom: 15px;">
      <div style="display: flex; align-items: center;">
        <img src="${logoDataURL}" style="width: 120px; height: auto;" alt="Logo" />
      </div>
      
      <div style="flex: 1; margin-left: 30px; display: flex; flex-direction: column; align-items: flex-end;">
        <div style="text-align: right; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${textPrimary};">Коммерческое предложение</div>
          <div style="font-size: 10px; color: ${textMuted}; margin-top: 2px;">Версия ${versionLabel}</div>
          <div style="font-size: 10px; color: ${textMuted}; margin-top: 2px;">Дата создания: ${formattedCreatedDate}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 20px; background: #f9fafb; border: 1px solid ${borderSoft}; border-radius: 12px; padding: 10px 16px; width: 350px; box-sizing: border-box;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: ${textMuted}; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Событие</span>
            <span style="font-size: 11px; font-weight: 600; font-style: italic;">${data.eventName || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: ${textMuted}; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Дата</span>
            <span style="font-size: 11px; font-weight: 600;">${formattedEventDate}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: ${textMuted}; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Локация</span>
            <span style="font-size: 11px; font-weight: 600;">${data.venueName || '—'}</span>
          </div>
          ${participantsCellsHtml}
        </div>
      </div>
    </header>

    ${categoriesHtml}

    <footer style="margin-top: 25px; border-top: 2px solid ${borderStrong}; padding-top: 15px; padding-bottom: 16px; display: flex; justify-content: flex-end;">
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding-right: 12px; width: min(560px, 100%);">
        ${footerTotalsHtml}
      </div>
    </footer>
    ${extraServicesHtml}
    <div style="height: 84px; background: #ffffff;"></div>
  `;

  document.body.appendChild(container);
  await document.fonts.ready;

  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    height: container.scrollHeight,
    windowHeight: container.scrollHeight
  });

  document.body.removeChild(container);

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

  // Формируем имя файла: {Наименование} {Площадка} {Дата} Версия {номер версии}
  // Название мероприятия (eventName) - если пустое, пропускаем
  const fileNameParts: string[] = [];
  
  if (data.eventName) {
    fileNameParts.push(data.eventName);
  } else if (data.venueName) {
    // Если название пустое, первым элементом берем площадку
    fileNameParts.push(data.venueName);
  }
  
  // Если eventName уже добавлен, добавляем venueName вторым
  if (data.eventName && data.venueName) {
    fileNameParts.push(data.venueName);
  }
  
  if (formattedEventDate && formattedEventDate !== '—') {
    fileNameParts.push(formattedEventDate);
  }
  fileNameParts.push(`Версия ${versionLabel}`);
  
  // Убираем недопустимые символы для имени файла
  const fileName = fileNameParts.join(' ').replace(/[<>:"/\\|?*]/g, '_');
  pdf.save(`${fileName}.pdf`);
}
