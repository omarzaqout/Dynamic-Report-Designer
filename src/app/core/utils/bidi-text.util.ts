const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF]/;
const DIGIT_TOKEN_REGEX = /^\d[\d./:\-]*$/;

export function hasRtlCharacters(content: string): boolean {
  return RTL_CHAR_REGEX.test(content);
}

export function normalizeStoredText(content: string): string {
  if (!content) return '';
  return content.replace(/<br\s*\/?>/gi, '\n');
}

export function normalizeMixedDirectionalText(content: string): string {
  return content;
}

function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMixedParenthetical(open: string, inner: string, close: string): string {
  const normalizedInner = normalizeStoredText(inner);
  const tokens = normalizedInner.match(/(\s+|[^\s]+)/g) || [];
  const rendered = tokens
    .map((token) => {
      if (/^\s+$/.test(token)) return token.replace(/ /g, '&nbsp;');
      if (hasRtlCharacters(token)) {
        return `<span dir="rtl" style="direction:rtl; unicode-bidi:isolate;">${escapeHtml(token)}</span>`;
      }
      if (DIGIT_TOKEN_REGEX.test(token) || /[A-Za-z]/.test(token)) {
        return `<span dir="ltr" style="direction:ltr; unicode-bidi:isolate;">${escapeHtml(token)}</span>`;
      }
      return escapeHtml(token);
    })
    .join('');

  return `<span dir="ltr" style="direction:ltr; unicode-bidi:isolate;">${escapeHtml(open)}${rendered}${escapeHtml(close)}</span>`;
}

function formatRtlLine(line: string): string {
  const normalizedLine = normalizeStoredText(line);
  let result = '';
  let lastIndex = 0;
  const regex = /([\(\[\{])([^()\[\]{}]*)([\)\]\}])/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalizedLine)) !== null) {
    const [fullMatch, open, inner, close] = match;
    const index = match.index;

    result += escapeHtml(normalizedLine.slice(lastIndex, index));

    if (hasRtlCharacters(inner) && /\d/.test(inner)) {
      result += renderMixedParenthetical(open, inner, close);
    } else {
      result += escapeHtml(fullMatch);
    }

    lastIndex = index + fullMatch.length;
  }

  result += escapeHtml(normalizedLine.slice(lastIndex));
  return result;
}

export function formatMixedDirectionalHtml(content: string): string {
  if (!content) return '';

  return normalizeStoredText(content)
    .split('\n')
    .map((line) => {
      if (!hasRtlCharacters(line)) {
        return escapeHtml(line);
      }

      return formatRtlLine(line);
    })
    .join('<br>');
}
