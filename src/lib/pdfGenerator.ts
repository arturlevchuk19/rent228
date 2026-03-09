import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Интерфейсы данных [cite: 53]
interface BudgetItem {
  category_id?: string;
  equipment?: { name: string };
  work_item?: { name: string; unit?: string };
  quantity: number;
  price: number;
  total: number;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
}

interface PDFData {
  eventName: string;
  eventDate?: string;
  venueName?: string;
  clientName?: string;
  organizerName?: string;
  budgetItems: BudgetItem[];
  categories: Category[];
  exchangeRate: number;
  paymentMode?: 'usd' | 'byn_cash' | 'byn_noncash';
}

const calculateBYNCashPrice = (priceUSD: number, exchangeRate: number): number => {
  const baseAmount = priceUSD * exchangeRate;
  return Math.round(baseAmount / 5) * 5;
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
  return Math.round(withBankRate / 5) * 5;
};

export async function generateBudgetPDF(data: PDFData): Promise<void> {
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

  // Группировка по категориям [cite: 65, 78]
  const groupedByCategory: Record<string, BudgetItem[]> = {};
  data.budgetItems.forEach((item) => {
    const catId = item.category_id || 'uncategorized';
    if (!groupedByCategory[catId]) groupedByCategory[catId] = [];
    groupedByCategory[catId].push(item);
  });

  const categoryOrder = data.categories.map(c => c.id);
  const sortedCategoryIds = Object.keys(groupedByCategory).sort((a, b) => {
    return (categoryOrder.indexOf(a) ?? 999) - (categoryOrder.indexOf(b) ?? 999);
  });

  const container = document.createElement('div');
  // Уменьшены отступы для компактности [cite: 53]
  container.style.cssText = `
    position: absolute; left: -9999px; width: 800px; height: auto;
    background-color: #0a0a0a; color: #ffffff;
    font-family: 'Montserrat', sans-serif; padding: 25px 40px;
    box-sizing: border-box; line-height: 1.2;
  `;

  let categoriesHtml = '';
  let grandTotal = 0;
  const grayAccent = '#4b5563';
  const grayBg = 'rgba(255, 255, 255, 0.05)';
  const paymentMode = data.paymentMode || 'usd';
  const currencySuffix = paymentMode !== 'usd' ? ' BYN' : ' $';

  const calculatePrice = (usdPrice: number, item?: BudgetItem): number => {
    switch (paymentMode) {
      case 'byn_cash':
        return calculateBYNCashPrice(usdPrice, data.exchangeRate);
      case 'byn_noncash':
        return calculateBYNNonCashPrice(usdPrice, data.exchangeRate, item);
      default:
        return usdPrice;
    }
  };

  sortedCategoryIds.forEach(catId => {
    const items = groupedByCategory[catId];
    const category = data.categories.find(c => c.id === catId);
    const categoryName = category?.name || 'Прочее';

    let categorySum = 0;
    const rows = items.map(item => {
      const name = item.equipment?.name || item.work_item?.name || '—';
      const notes = item.notes?.trim();
      const displayName = notes ? `${name} ${notes}` : name;
      const qty = item.quantity || 0;
      const unit = item.work_item?.unit || 'шт';
      const usdPrice = item.price || 0;
      const price = calculatePrice(usdPrice, item);
      const total = price * qty;
      categorySum += total;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 6px 8px; font-size: 13px; color: #ffffff; width: 60%;">${displayName}</td>
          <td style="padding: 6px 8px; font-size: 13px; text-align: center; color: #ffffff; width: 10%;">${qty} ${unit}</td>
          <td style="padding: 6px 8px; font-size: 13px; text-align: right; color: #ffffff; width: 15%;">${price.toFixed(0)}${currencySuffix}</td>
          <td style="padding: 6px 8px; font-size: 13px; text-align: right; font-weight: 600; color: #ffffff; width: 15%;">${total.toFixed(0)}${currencySuffix}</td>
        </tr>
      `;
    }).join('');

    grandTotal += categorySum;

    categoriesHtml += `
     <div style="margin-bottom: 20px;">
    <div style="display: flex; align-items: center; margin-bottom: 8px; min-height: 20px;">
      <div style="width: 6px; height: 18px; background: ${grayAccent}; border-radius: 10px; margin-right: 12px; flex-shrink: 0;"></div>
      <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin: 0; padding: 0; line-height: 1; display: flex; align-items: center;">
        ${categoryName}
      </h2>
      </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-transform: uppercase; font-size: 9px; color: #4b5563; border-bottom: 1px solid #1f2937;">
              <th style="text-align: left; padding: 6px 8px;">Наименование</th>
              <th style="text-align: center; padding: 6px 8px;">Кол-во</th>
              <th style="text-align: right; padding: 6px 8px;">Цена</th>
              <th style="text-align: right; padding: 6px 8px;">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="background: ${grayBg};">
              <td colspan="3" style="padding: 8px; text-align: right; font-size: 10px; font-weight: 700; color: #9ca3af;">ИТОГО ПО РАЗДЕЛУ:</td>
              <td style="padding: 8px; text-align: right; font-weight: 700; color: #ffffff; font-size: 13px;">${categorySum.toFixed(0)}${currencySuffix}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });

  // Исправленные блоки Заказчика и Организатора [cite: 63, 64]
  const clientHtml = data.clientName ? `
    <div style="display: flex; flex-direction: column; min-width: 120px; flex: 0 1 auto;">
      <span style="font-size: 8px; color: #4b5563; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Заказчик</span>
      <span style="font-size: 11px; font-weight: 600; color: #ffffff; white-space: nowrap;">${data.clientName}</span>
    </div>` : '';

  const organizerHtml = data.organizerName ? `
    <div style="display: flex; flex-direction: column; min-width: 120px; flex: 0 1 auto;">
      <span style="font-size: 8px; color: #4b5563; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Организатор</span>
      <span style="font-size: 11px; font-weight: 600; color: #ffffff; white-space: nowrap;">${data.organizerName}</span>
    </div>` : '';

  container.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #1f2937; padding-bottom: 15px;">
      <div style="display: flex; align-items: center;">
        <img src="${logoDataURL}" style="width: 120px; height: auto;" alt="Logo" />
      </div>
      
      <div style="flex: 1; margin-left: 30px; display: flex; flex-direction: column; align-items: flex-end;">
        <div style="text-align: right; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #ffffff;">Коммерческое предложение</div>
          <div style="font-size: 10px; color: #4b5563; margin-top: 2px;">Версия 2.0</div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 10px 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px 16px; width: fit-content; max-width: 350px; justify-content: flex-start;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: #4b5563; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Событие</span>
            <span style="font-size: 11px; font-weight: 600; font-style: italic;">${data.eventName || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: #4b5563; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Дата</span>
            <span style="font-size: 11px; font-weight: 600;">${data.eventDate || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 8px; color: #4b5563; text-transform: uppercase; margin-bottom: 2px; font-weight: 700;">Локация</span>
            <span style="font-size: 11px; font-weight: 600;">${data.venueName || '—'}</span>
          </div>

          <div style="flex-basis: 100%; height: 0; margin: 0;"></div>

          ${clientHtml}
          ${organizerHtml}
        </div>
      </div>
    </header>

    ${categoriesHtml}

    <footer style="margin-top: 25px; border-top: 2px solid #1f2937; padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 8px; color: #4b5563; text-transform: uppercase; letter-spacing: 2px; font-weight: 500;">ONPROMO.BY — Техническое обеспечение</div>
        
        <div style="display: flex; gap: 15px; align-items: center;">
          <span style="display: flex; align-items: center; color: #9ca3af; font-size: 10px;">
            <svg style="width: 14px; height: 14px; margin-right: 5px; fill: currentColor; display: block;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            <span style="line-height: 1;">onpromo.by</span>
          </span>
          <span style="display: flex; align-items: center; color: #9ca3af; font-size: 10px;">
            <svg style="width: 14px; height: 14px; margin-right: 5px; fill: currentColor; display: block;" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span style="line-height: 1;">instagram</span>
          </span>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Общий итог:</span>
        <span style="font-size: 28px; font-weight: 800; line-height: 1; padding-bottom: 2px;">${grandTotal.toFixed(0)}${currencySuffix}</span>
      </div>
    </footer>
  `;

  document.body.appendChild(container);
  await document.fonts.ready;

  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: '#0a0a0a',
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

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeightPx * pageWidth / imgWidthPx);
  pdf.save(`Proposal_${data.eventName || 'event'}.pdf`);
}
