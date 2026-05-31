
const sanitizeXmlString = (value) =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const escapeXml = (value) =>
  sanitizeXmlString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const decodeXmlText = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const makeTextWithLineBreaks = (text, attrs = '') => {
  const normalizedAttrs = attrs.replace(/\s+xml:space="[^"]*"/g, '');
  const textAttrs = `${normalizedAttrs} xml:space="preserve"`;
  const lines = sanitizeXmlString(text).split(/\r?\n/);

  return lines.map((line) => `<w:t${textAttrs}>${escapeXml(line)}</w:t>`).join('<w:br/>');
};

const values = {
    A: 'REPLACEMENT_FOR_A',
    K: '',
    M: '',
};

const placeholderPattern = new RegExp(`[${Object.keys(values).join('')}]`, 'g');

const itemName = "K&M 21367";
const escapedItemName = escapeXml(itemName);
console.log('Escaped:', escapedItemName);

// Now suppose we have this escaped name inside a run in the XML
const runXml = `<w:r><w:t>${escapedItemName}</w:t></w:r>`;

// Simulation of replaceTextPlaceholders on a run
function simulateReplace(text) {
    const decodedText = decodeXmlText(text);
    console.log('Decoded:', decodedText);
    const replacedText = decodedText.replace(placeholderPattern, (placeholder) => values[placeholder] ?? placeholder);
    console.log('Replaced:', replacedText);
    return replacedText;
}

// In contractGenerator.ts, it does:
// return runXml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (_textMatch, attrs, text) => {
//     const decodedText = decodeXmlText(text);
//     const replacedText = decodedText.replace(placeholderPattern, (placeholder) => values[placeholder] ?? placeholder);
//     ...
//     return makeTextWithLineBreaks(replacedText, attrs);
// });

const result = simulateReplace(escapedItemName);
const finalXml = makeTextWithLineBreaks(result);
console.log('Final XML content:', finalXml);
