import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import templateUrl from '../data/ШАБЛОН ДОГОВОРА 2026.docx?url';
import type { BudgetItem, Client, Event } from './events';

interface ContractGenerationPayload {
  event: Event;
  client: Client;
  equipmentTypeRP: string;
  contractDate: string;
  amount: number;
  budgetItems: BudgetItem[];
}

const escapeXml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatDate = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[3]}.${isoDateMatch[2]}.${isoDateMatch[1]}`;
  }
  return trimmed;
};

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
};

const getBudgetItemName = (item: BudgetItem): string =>
  item.name?.trim() || item.equipment?.name?.trim() || item.work_item?.name?.trim() || item.notes?.trim() || 'Позиция сметы';

const getBudgetItemQuantity = (item: BudgetItem): string => {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const formattedQuantity = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(quantity) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(quantity);
  const unit = item.unit?.trim() || item.work_item?.unit?.trim() || item.equipment?.unit?.trim();
  return unit ? `${formattedQuantity} ${unit}` : formattedQuantity;
};

const makeCell = (text: string, width: number, align: 'left' | 'center' = 'left', bold = false): string => `
  <w:tc>
    <w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
    <w:p>
      <w:pPr>
        <w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${align === 'center' ? '<w:jc w:val="center"/>' : ''}
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/>${bold ? '<w:b/>' : ''}</w:rPr>
        <w:t xml:space="preserve">${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  </w:tc>`;

const makeSpecificationTable = (items: BudgetItem[]): string => {
  const rows = items.length > 0 ? items : [];
  const makeRow = (name: string, quantity: string, isHeader = false) => `
    <w:tr>
      ${makeCell(name, 7655, 'left', isHeader)}
      ${makeCell(quantity, 1984, 'center', isHeader)}
    </w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9639" w:type="dxa"/>
      <w:tblInd w:w="108" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="7655"/><w:gridCol w:w="1984"/></w:tblGrid>
    ${makeRow('Наименование', 'Количество', true)}
    ${rows.map((item) => makeRow(getBudgetItemName(item), getBudgetItemQuantity(item))).join('')}
  </w:tbl>`;
};

const replaceSpecificationPlaceholderTable = (documentXml: string, items: BudgetItem[]): string => {
  const placeholderIndex = documentXml.indexOf('<w:t>P</w:t>');
  if (placeholderIndex === -1) return documentXml;

  const tableStart = documentXml.lastIndexOf('<w:tbl>', placeholderIndex);
  const tableEnd = documentXml.indexOf('</w:tbl>', placeholderIndex);
  if (tableStart === -1 || tableEnd === -1) return documentXml.replace('<w:t>P</w:t>', `<w:t>${escapeXml(items.map(getBudgetItemName).join(', '))}</w:t>`);

  return `${documentXml.slice(0, tableStart)}${makeSpecificationTable(items)}${documentXml.slice(tableEnd + '</w:tbl>'.length)}`;
};

const decodeXmlText = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const getXmlParagraphText = (paragraphXml: string): string =>
  paragraphXml.replace(/<w:tab\s*\/?>/g, '\t').replace(/<w:br\s*\/?>/g, '\n').replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_match, text) => decodeXmlText(text)).replace(/<[^>]+>/g, '');

const removeEmptyOptionalParagraphs = (documentXml: string, optionalValues: Record<string, string>): string =>
  documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const paragraphText = getXmlParagraphText(paragraphXml);
    const hasEmptyOptionalPlaceholder = Object.entries(optionalValues).some(([placeholder, value]) => {
      if (value.trim()) return false;
      return new RegExp(`(^|[^A-ZА-ЯЁ])${placeholder}([^A-ZА-ЯЁ]|$)`).test(paragraphText);
    });

    return hasEmptyOptionalPlaceholder ? '' : paragraphXml;
  });

const makeTextWithLineBreaks = (text: string, attrs: string): string => {
  const normalizedAttrs = attrs.replace(/\s+xml:space="[^"]*"/g, '');
  const textAttrs = `${normalizedAttrs} xml:space="preserve"`;
  const lines = text.split(/\r?\n/);

  return lines.map((line) => `<w:t${textAttrs}>${escapeXml(line)}</w:t>`).join('<w:br/>');
};

const replaceTextPlaceholders = (documentXml: string, values: Record<string, string>): string => {
  const placeholderPattern = new RegExp(`[${Object.keys(values).join('')}]`, 'g');

  return documentXml.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (runXml) => {
    const runPropertiesMatch = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const isUnderlinedRun = Boolean(runPropertiesMatch?.[0].includes('<w:u'));

    if (!isUnderlinedRun) return runXml;

    return runXml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (_textMatch, attrs, text) => {
      const decodedText = decodeXmlText(text);
      const replacedText = decodedText.replace(placeholderPattern, (placeholder) => values[placeholder] ?? placeholder);

      if (replacedText === decodedText) {
        return `<w:t${attrs}>${text}</w:t>`;
      }

      return makeTextWithLineBreaks(replacedText, attrs);
    });
  });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function generateContractDocx({ event, client, equipmentTypeRP, contractDate, amount, budgetItems }: ContractGenerationPayload) {
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error('Не удалось загрузить шаблон договора');
  }

  const templateBuffer = new Uint8Array(await response.arrayBuffer());
  const zip = unzipSync(templateBuffer);
  const documentPath = 'word/document.xml';
  const documentFile = zip[documentPath];
  if (!documentFile) {
    throw new Error('В шаблоне договора не найден word/document.xml');
  }

  const venuePart = [event.venues?.address, event.venues?.name].filter(Boolean).join(', ');
  const eventTitle = event.name || event.event_type || '';
  const eventDate = formatDate(event.event_date);

  const values: Record<string, string> = {
    A: client.organization || '',
    B: client.signatory_position_ip || client.position || '',
    C: client.full_name || '',
    D: client.basis_for_action || '',
    E: eventTitle,
    F: equipmentTypeRP,
    G: eventDate,
    H: venuePart,
    I: client.unp || '',
    J: client.legal_address || '',
    K: client.postal_address || '',
    L: client.phone || '',
    M: client.bank_details || '',
    N: client.signatory_initials || '',
    O: formatAmount(amount),
    Q: eventDate,
    Z: formatDate(contractDate)
  };

  let documentXml = strFromU8(documentFile);
  documentXml = replaceSpecificationPlaceholderTable(documentXml, budgetItems);
  documentXml = removeEmptyOptionalParagraphs(documentXml, {
    I: values.I,
    J: values.J,
    K: values.K,
    L: values.L,
    M: values.M
  });
  documentXml = replaceTextPlaceholders(documentXml, values);
  zip[documentPath] = strToU8(documentXml);

  const output = zipSync(zip, { level: 6 });
  const safeEventName = (eventTitle || 'договор').replace(/[\\/:*?"<>|]+/g, '_');
  downloadBlob(
    new Blob([output.slice().buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    `Договор ${safeEventName}.docx`
  );
}
