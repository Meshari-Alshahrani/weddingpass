/**
 * Single source of truth for output sanitization helpers.
 * Both production code and the QA suite import THESE functions — the suite
 * must never keep its own copy (drift risk).
 */

/** Neutralizes CSV/Excel formula injection (=, +, -, @ prefixes). */
export function sanitizeExcelCell(val: unknown): unknown {
  if (typeof val === 'string' && /^[=+@-]/i.test(val.trim())) {
    return `'${val}`;
  }
  return val;
}

/** Escapes HTML-significant characters (& first) for safe text interpolation. */
export function sanitizeHtml(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m] || m));
}

/**
 * RFC 5545 §3.3.11 escaping for iCalendar TEXT values.
 * Order matters: backslash MUST be escaped first, then ; , and newlines
 * become the two-character sequence \n.
 */
export function escapeIcsText(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 content-line folding at 75 OCTETS (bytes — NOT JavaScript
 * characters; Arabic letters and emoji are multi-byte). Continuation lines
 * begin with a single space which counts toward their own 75-octet budget.
 */
export function foldIcsLine(line: string, maxOctets: number = 75): string {
  if (!line) return line;
  const encoder = new TextEncoder();

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const limit = chunks.length === 0 ? maxOctets : maxOctets - 1; // continuation lines carry a leading space

    if (currentBytes + chBytes > limit && current.length > 0) {
      chunks.push(chunks.length === 0 ? current : ' ' + current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  chunks.push(chunks.length === 0 ? current : ' ' + current);

  return chunks.join('\r\n');
}
