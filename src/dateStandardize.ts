/**
 * Genealogical date standardizer.
 * Converts free-form date strings into a canonical format.
 */
import {
  normalizeAccents,
  MONTHS,
  MONTH_NUM,
  DAYS_IN_MONTH,
  MODIFIERS,
  QUARTER_WORDS,
  UNKNOWN_PHRASES,
  SPECIAL_PHRASES,
  ORDINAL_SUFFIXES,
  BC_WORDS,
  AD_WORDS,
  WFT_PATTERN,
} from './dateConstants';

// ---------- The book's order ----------
/**
 * The order a book prints its all-number dates in: day first (`13-2-1700`) or month first
 * (`2-13-1700`). The caller decides it from the book; `stdDate` only applies it.
 */
export type DateOrder = 'dmy' | 'mdy';

// The qualifiers a reading picked by the order keeps: a printed `abt 7-8-1971` is `Abt 7 Aug 1971`.
const QUALIFIERS: Set<string> = new Set(['Abt', 'Cal', 'Est', 'Bef', 'Aft']);

// ---------- Token types ----------
interface Token {
  type: 'num' | 'str' | 'sym';
  value: string;
}

// ---------- Parsed date components ----------
interface DateParts {
  modifier?: string;
  day?: number;
  month?: string;       // 3-letter abbreviation
  year?: number;
  splitYear?: string;   // e.g. "24", "00"
  bc?: boolean;
  uncertain?: boolean;
  quarter?: number;     // 1-4 for quarter dates
}

// ---------- Tokenizer ----------
function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
      tokens.push({ type: 'num', value: num });
    } else if (/[a-zA-Z]/.test(ch)) {
      let str = '';
      while (i < s.length && /[a-zA-Z]/.test(s[i])) str += s[i++];
      tokens.push({ type: 'str', value: str });
    } else if (ch === '/' || ch === '<' || ch === '>' || ch === '&') {
      tokens.push({ type: 'sym', value: ch });
      i++;
    } else {
      i++;
    }
  }
  return tokens;
}

// ---------- Format a single date ----------
function formatDate(d: DateParts): string {
  const parts: string[] = [];
  if (d.modifier) parts.push(d.modifier);
  if (d.day !== undefined) parts.push(String(d.day));
  if (d.month) parts.push(d.month);
  if (d.year !== undefined) {
    let yearStr = String(d.year);
    if (d.splitYear !== undefined) yearStr += '/' + d.splitYear;
    parts.push(yearStr);
  }
  if (d.bc) parts.push('BC');
  if (d.uncertain) parts.push('(?)');
  return parts.join(' ');
}

// ---------- Number-to-month ----------
function numToMonth(n: number): string | undefined {
  for (const [abbr, num] of MONTH_NUM) {
    if (num === n) return abbr;
  }
  return undefined;
}

// ---------- Is a month named in this text? ----------
function namesAMonth(s: string): boolean {
  const words = normalizeAccents(s).toLowerCase().match(/[a-z]+/g) ?? [];
  return words.some((w) => MONTHS.has(w));
}

// ---------- A date with a blank for its day or its month ----------
// `numberIs` says where the printed number stands: before the blank (`9/ /1979`) or after it
// (`/07/1879`). It is the month only where the book's order puts the month there.
function blankDate(num: string, numberIs: 'first' | 'second', year: string, order?: DateOrder): string | undefined {
  const n = parseInt(num, 10);
  const y = parseInt(year, 10);
  if (y < 1000 || y > 2200) return undefined;
  const monthHere = (numberIs === 'first' && order === 'mdy') || (numberIs === 'second' && order === 'dmy');
  const mon = monthHere && n >= 1 && n <= 12 ? numToMonth(n) : undefined;
  return mon ? `${mon} ${y}` : `${y}`;
}

// ---------- Pre-processing ----------
function preProcess(raw: string, order?: DateOrder): { text: string; trailingParen: string; uncertain: boolean; orDates: string[] | null } {
  let text = raw;
  let trailingParen = '';
  let uncertain = false;
  const orDates: string[] | null = null;

  // Convert em-dashes/en-dashes to hyphens
  text = text.replace(/[\u2013\u2014]/g, '-');

  // Replace b.c. with bc (but not at start where it might mean "before circa")
  text = text.replace(/(?!^)b\.c\./gi, 'bc');

  // Extract trailing parenthetical
  const parenMatch = text.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  if (parenMatch && parenMatch[1].trim().length > 0) {
    text = parenMatch[1].trim();
    trailingParen = parenMatch[2];
  }

  // Handle question mark
  if (text.includes('?')) {
    uncertain = true;
    text = text.replace(/\?/g, '');
  }

  // Detect YYYYMMDD (exactly 8 digits, standalone)
  const yyyymmddMatch = text.match(/^(\d{8})$/);
  if (yyyymmddMatch) {
    const digits = yyyymmddMatch[1];
    const y = parseInt(digits.substring(0, 4), 10);
    const m = parseInt(digits.substring(4, 6), 10);
    const d = parseInt(digits.substring(6, 8), 10);
    if (y >= 1000 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const mon = numToMonth(m);
      if (mon) {
        text = `${d} ${mon} ${y}`;
      }
    }
  }

  // Convert yyyy-mm-dd / yyyy/mm/dd / yyyy.mm.dd embedded dates
  text = text.replace(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/g, (_match, y, m, d) => {
    const yy = parseInt(y, 10);
    const mm = parseInt(m, 10);
    const dd = parseInt(d, 10);
    if (yy >= 1000 && yy <= 2200 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const mon = numToMonth(mm);
      if (mon) return `${dd} ${mon} ${yy}`;
    }
    return _match;
  });

  // Close a typewriter space in an all-number date: `7- 8-1971` reads as `7-8-1971`. Only between
  // two small numbers before a four-digit year, so a range such as `1865 - 1900` is untouched, and
  // never after a named month, where the numbers are a day and something else.
  text = text.replace(/(?<!\d)(\d{1,2})-\s+(\d{1,2})-(\d{4})(?!\d)/g,
    (_match, a, b, y, offset: number, whole: string) =>
      namesAMonth(whole.slice(0, offset)) ? _match : `${a}-${b}-${y}`);

  // A blank where the day or the month should be: `9/ /1979`, `11- -1981`, `02/__/1932`, `10--1740`,
  // and `/07/1879`. The number beside the blank is the month in one order and the day in the other,
  // so it is read as the month only in the book's order; otherwise only the year is sure. Never after
  // a named month, where the number is the day (`Sept. 7--1800`).
  text = text.replace(/(?<![\d/.\-])(\d{1,2})\s*([/.\-])[\s_]*\2\s*(\d{4})(?!\d)/g,
    (_match, n, _sep, y, offset: number, whole: string) =>
      namesAMonth(whole.slice(0, offset)) ? _match : (blankDate(n, 'first', y, order) ?? _match));
  text = text.replace(/^[\s_]*([/.\-])\s*(\d{1,2})\s*\1\s*(\d{4})(?!\d)/,
    (_match, _sep, n, y) => blankDate(n, 'second', y, order) ?? _match);

  // Handle ambiguous mm-dd-yyyy / dd-mm-yyyy
  text = text.replace(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/g, (_match, a, b, y) => {
    const aa = parseInt(a, 10);
    const bb = parseInt(b, 10);
    const yy = parseInt(y, 10);
    if (yy < 1000 || yy > 2200) return _match;

    const aIsDay = aa >= 1 && aa <= 31;
    const bIsDay = bb >= 1 && bb <= 31;
    const aIsMonth = aa >= 1 && aa <= 12;
    const bIsMonth = bb >= 1 && bb <= 12;

    if (aa > 12 && bIsMonth) {
      // dd-mm-yyyy
      const mon = numToMonth(bb);
      return mon ? `${aa} ${mon} ${yy}` : _match;
    } else if (bb > 12 && aIsMonth) {
      // mm-dd-yyyy
      const mon = numToMonth(aa);
      return mon ? `${bb} ${mon} ${yy}` : _match;
    } else if (aIsMonth && bIsDay && aa === bb) {
      // Same number, pick mm-dd-yyyy interpretation
      const mon = numToMonth(aa);
      return mon ? `${bb} ${mon} ${yy}` : _match;
    } else if (aIsMonth && bIsMonth && aIsDay && bIsDay && aa !== bb) {
      // Truly ambiguous
      const monA = numToMonth(aa);
      const monB = numToMonth(bb);
      if (monA && monB) {
        return `__OR__${bb} ${monA} ${yy}__OR__${aa} ${monB} ${yy}__OR__`;
      }
      return _match;
    }
    return _match;
  });

  // Convert dd-Mon-yyyy (dashes between day/month/year with alpha month) → spaces
  text = text.replace(/(\d{1,2})-([a-zA-Z]+)-(\d{4})/g, '$1 $2 $3');

  // Handle abbreviated year ranges: 1875-80 → 1875-1880 (BEFORE dash processing)
  text = text.replace(/(\d{4})-(\d{1,3})(?!\d)/g, (_match, base, suffix) => {
    const baseYear = parseInt(base, 10);
    if (baseYear >= 1000 && baseYear <= 2200 && suffix.length < 4) {
      // Check it's not already a full year range converted above
      return `${base}-${fullYear(baseYear, suffix)}`;
    }
    return _match;
  });

  // Handle dashes as range separators
  if (text.includes('-')) {
    const lowerText = text.toLowerCase();
    const hasBet = /\b(bet|btw|between)\b/.test(lowerText);
    const hasFrom = /\b(from|frm)\b/.test(lowerText);

    if (hasBet) {
      text = text.replace(/-/g, ' and ');
    } else if (hasFrom) {
      text = text.replace(/-/g, ' to ');
    } else {
      // Check if there's a dash that looks like a range separator (between date-like content)
      // Only convert dashes that are surrounded by spaces or date-like content
      text = 'from ' + text.replace(/-/g, ' to ');
    }
  }

  // A printed "or" beside the two readings of an all-number date makes an "or" date of its own, and
  // the readings are two of its dates (`1-9-1816 or 1819`).
  if (text.includes('__OR__') && tokenize(text.replace(TWO_READINGS, ' ')).some(isOrToken)) {
    text = text.replace(TWO_READINGS, ' $1 or $2 ');
  }

  return { text: text.trim(), trailingParen, uncertain, orDates };
}

// ---------- Main parser ----------
function parseDateTokens(tokens: Token[], startIdx: number, endIdx: number): DateParts {
  const parts: DateParts = {};
  const pendingNums: number[] = [];
  let i = startIdx;

  while (i < endIdx) {
    const tok = tokens[i];

    if (tok.type === 'str') {
      const lower = normalizeAccents(tok.value).toLowerCase();

      // Check for month
      const monthAbbr = MONTHS.get(lower);
      if (monthAbbr) {
        parts.month = monthAbbr;
        // If we had a pending number <= 31, it's a day
        if (pendingNums.length === 1 && pendingNums[0] <= 31) {
          parts.day = pendingNums[0];
          pendingNums.length = 0;
        }
        i++;
        continue;
      }

      // Check for ordinal suffix after number
      if (ORDINAL_SUFFIXES.has(lower) && pendingNums.length > 0) {
        // Just ignore the suffix; the number is already stored
        i++;
        continue;
      }

      // Check for quarter word
      if (QUARTER_WORDS.has(lower)) {
        i++;
        continue;
      }

      // Check for BC
      if (BC_WORDS.has(lower)) {
        parts.bc = true;
        i++;
        continue;
      }

      // Check for AD
      if (AD_WORDS.has(lower)) {
        // Just discard
        i++;
        continue;
      }

      // Check for modifier
      const mod = MODIFIERS.get(lower);
      if (mod) {
        if (mod === 'and' || mod === 'or' || mod === 'From' || mod === 'To' || mod === 'Bet') {
          // These are handled at a higher level
          i++;
          continue;
        }
        if (parts.modifier) {
          // Double modifier — keep the first (primary)
          i++;
          continue;
        }
        parts.modifier = mod;
        i++;
        continue;
      }

      // Unknown string — skip
      i++;
      continue;
    }

    if (tok.type === 'num') {
      const num = parseInt(tok.value, 10);

      // Check if next token is an ordinal suffix
      if (i + 1 < endIdx && tokens[i + 1].type === 'str') {
        const nextLower = tokens[i + 1].value.toLowerCase();
        if (ORDINAL_SUFFIXES.has(nextLower)) {
          // Check if the token after ordinal is a quarter word
          if (i + 2 < endIdx && tokens[i + 2].type === 'str') {
            const qLower = tokens[i + 2].value.toLowerCase();
            if (QUARTER_WORDS.has(qLower) && num >= 1 && num <= 4) {
              // This is a quarter: "1st quarter"
              parts.day = undefined;
              parts.month = undefined;
              // Store quarter in a special way — we'll use day field as quarter marker
              pendingNums.push(num);
              // Mark this as quarter
              parts.quarter = num;
              i += 3; // skip num, ordinal, quarter word
              continue;
            }
          }
        }
      }

      // Check if next token is a quarter word directly (e.g., "1 quarter")
      if (i + 1 < endIdx && tokens[i + 1].type === 'str') {
        const nextLower = tokens[i + 1].value.toLowerCase();
        if (QUARTER_WORDS.has(nextLower) && num >= 1 && num <= 4) {
          parts.quarter = num;
          i += 2;
          continue;
        }
      }

      if (num >= 1000 && num <= 2200) {
        parts.year = num;
        // If there's a pending number and it could be a day
        if (pendingNums.length === 1 && pendingNums[0] >= 1 && pendingNums[0] <= 31) {
          parts.day = pendingNums[0];
        }
        pendingNums.length = 0;
        i++;

        // Check for split year: / followed by number
        if (i < endIdx && tokens[i].type === 'sym' && tokens[i].value === '/' &&
            i + 1 < endIdx && tokens[i + 1].type === 'num') {
          const suffixTok = tokens[i + 1];
          const suffixVal = parseInt(suffixTok.value, 10);

          if (num >= 1000 && num <= 1752) {
            // Valid split year range
            const nextYear = num + 1;
            const suffixLen = suffixTok.value.length;

            if (suffixLen <= 2) {
              // Verify suffix matches nextYear
              if (suffixLen === 1) {
                if ((nextYear % 10) === suffixVal) {
                  parts.splitYear = String(nextYear % 100).padStart(2, '0');
                  i += 2;
                } else {
                  // Invalid split year
                  parts.splitYear = undefined;
                }
              } else {
                if ((nextYear % 100) === suffixVal) {
                  parts.splitYear = suffixTok.value.padStart(2, '0');
                  i += 2;
                } else {
                  parts.splitYear = undefined;
                }
              }
            } else if (suffixLen === 3 || suffixLen === 4) {
              // e.g. 1699/1700
              if (suffixVal === nextYear) {
                parts.splitYear = String(nextYear % 100).padStart(2, '0');
                i += 2;
              }
            }

            // Check month validity for split years (only Jan-Mar)
            if (parts.splitYear !== undefined && parts.month) {
              const monthNum = MONTH_NUM.get(parts.month);
              if (monthNum && monthNum > 3) {
                parts.uncertain = true;
              }
            }
          } else {
            // Year > 1752, not valid split year — don't consume / and next num
            // Leave them for other processing
          }
        }
        continue;
      }

      // It's a smaller number
      if (parts.month && !parts.day && num >= 1 && num <= 31) {
        parts.day = num;
        i++;
        continue;
      }

      // Could be a day or a two-digit year (BC context)
      pendingNums.push(num);
      i++;
      continue;
    }

    if (tok.type === 'sym') {
      if (tok.value === '<' || tok.value === '>') {
        const mod = MODIFIERS.get(tok.value);
        if (mod && !parts.modifier) {
          parts.modifier = mod;
        }
      }
      i++;
      continue;
    }

    i++;
  }

  // Resolve pending numbers
  if (pendingNums.length > 0) {
    for (const num of pendingNums) {
      if (num >= 1000 && num <= 2200) {
        if (!parts.year) parts.year = num;
      } else if (parts.bc && num < 100) {
        if (!parts.year) parts.year = num;
      } else if (num >= 1 && num <= 31 && !parts.day) {
        // Store as potential day even without month (for range gap filling)
        parts.day = num;
      } else if (parts.quarter && num >= 1000 && num <= 2200) {
        parts.year = num;
      }
    }
  }

  return parts;
}

// Find all positions of a modifier keyword (checks both str and sym tokens)
function findAllModifier(tokens: Token[], keyword: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let lookup: string | undefined;
    if (tok.type === 'str') {
      lookup = MODIFIERS.get(tok.value.toLowerCase());
    } else if (tok.type === 'sym') {
      lookup = MODIFIERS.get(tok.value);
    }
    if (lookup === keyword) positions.push(i);
  }
  return positions;
}

// ---------- Main export ----------
export function stdDate(raw: string, order?: DateOrder): string {
  if (order !== undefined && order !== 'dmy' && order !== 'mdy') {
    throw new Error(`stdDate: order must be 'dmy' or 'mdy', not ${JSON.stringify(order)}`);
  }

  // 1. Empty/whitespace
  if (!raw || !raw.trim()) return '';

  const trimmed = raw.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // 2. Unknown phrases
  if (UNKNOWN_PHRASES.has(lowerTrimmed)) return '';

  // 3. Special phrases (check before other processing)
  const specialResult = SPECIAL_PHRASES.get(lowerTrimmed);
  if (specialResult) {
    return specialResult;
  }

  // Also check with trailing parenthetical stripped
  const specialParenMatch = trimmed.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  if (specialParenMatch) {
    const base = specialParenMatch[1].trim().toLowerCase();
    const paren = specialParenMatch[2];
    const sp = SPECIAL_PHRASES.get(base);
    if (sp) return sp + ' ' + paren;
  }

  // 4. WFT patterns
  if (WFT_PATTERN.test(trimmed)) return '';

  // Handle input that is entirely parenthetical
  if (/^\([^)]*\)$/.test(trimmed)) {
    return trimmed;
  }

  // 5. Pre-process
  const { text, trailingParen, uncertain } = preProcess(trimmed, order);

  if (!text) return '';

  // Check for __OR__ pattern (ambiguous date)
  if (text.includes('__OR__')) {
    const orParts = text.match(/__OR__(.*?)__OR__(.*?)__OR__/);
    if (orParts) {
      const interp1 = orParts[1].trim();
      const interp2 = orParts[2].trim();

      // The book's order picks one reading (the first is month first, the second day first), but only
      // where nothing else is printed beside the date, or only a qualifier, which the reading keeps.
      // Anything else (a second date, a range, a printed "or", a word it does not know) keeps both
      // readings, so a picked reading never hides what it leaves out.
      const sentinels = text.match(/__OR__.*?__OR__.*?__OR__/g) ?? [];
      const around = tokenize(normalizeAccents(text.replace(/__OR__.*?__OR__.*?__OR__/g, ' ')))
        .map((t) => MODIFIERS.get(t.type === 'str' ? t.value.toLowerCase() : t.value));
      const onlyQualifiers = around.every((m) => m !== undefined && QUALIFIERS.has(m));
      let result = `${interp1} or ${interp2}`;
      if (order && sentinels.length === 1 && onlyQualifiers) {
        const reading = order === 'mdy' ? interp1 : interp2;
        result = around.length ? `${around[0]} ${reading}` : reading;
      }
      if (trailingParen) result += ' ' + trailingParen;
      if (uncertain) result += ' (?)';
      return result;
    }
  }

  // Tokenize
  const allTokens = tokenize(normalizeAccents(text));

  if (allTokens.length === 0) return '';

  // Check for "Q" prefix for quarters (e.g., "Q1")
  if (allTokens.length >= 2 && allTokens[0].type === 'str' &&
      allTokens[0].value.toLowerCase() === 'q' && allTokens[1].type === 'num') {
    const qNum = parseInt(allTokens[1].value, 10);
    if (qNum >= 1 && qNum <= 4 && allTokens.length >= 3) {
      const yearTok = allTokens[2];
      if (yearTok.type === 'num') {
        const year = parseInt(yearTok.value, 10);
        if (year >= 1000 && year <= 2200) {
          let result = `Q${qNum} ${year}`;
          if (trailingParen) result += ' ' + trailingParen;
          return result;
        }
      }
    }
  }

  // Check for From/To pattern
  const fromPositions = findAllModifier(allTokens, 'From');
  const toPositions = findAllModifier(allTokens, 'To');
  const betPositions = findAllModifier(allTokens, 'Bet');
  const andPositions = findAllModifier(allTokens, 'and');

  // Check for Bet...and range
  if (betPositions.length > 0 && andPositions.length > 0) {
    const betIdx = betPositions[0];
    const andIdx = andPositions[0];
    if (andIdx > betIdx) {
      const date1 = parseDateTokens(allTokens, betIdx + 1, andIdx);
      const date2 = parseDateTokens(allTokens, andIdx + 1, allTokens.length);

      // Range gap filling
      fillRangeGaps(date1, date2);

      const d1str = formatDate(date1);
      const d2str = formatDate(date2);
      if (!date1.year && !date2.year) return '';
      let result = `Bet ${d1str} and ${d2str}`;
      if (trailingParen) result += ' ' + trailingParen;
      if (uncertain) result += ' (?)';
      return result;
    }
  }

  // Check for From...To range
  if (fromPositions.length > 0 && toPositions.length > 0) {
    const fromIdx = fromPositions[0];
    const toIdx = toPositions[0];
    if (toIdx > fromIdx) {
      const date1 = parseDateTokens(allTokens, fromIdx + 1, toIdx);
      const date2 = parseDateTokens(allTokens, toIdx + 1, allTokens.length);

      fillRangeGaps(date1, date2);

      const d1str = formatDate(date1);
      const d2str = formatDate(date2);
      if (!date1.year && !date2.year) return '';
      let result = `Bet ${d1str} and ${d2str}`;
      if (trailingParen) result += ' ' + trailingParen;
      if (uncertain) result += ' (?)';
      return result;
    }
  }

  // Standalone From → Aft
  if (fromPositions.length > 0 && toPositions.length === 0 && andPositions.length === 0) {
    const fromIdx = fromPositions[0];
    const date = parseDateTokens(allTokens, fromIdx + 1, allTokens.length);
    if (!date.year) return '';
    date.modifier = 'Aft';
    let result = formatDate(date);
    if (trailingParen) result += ' ' + trailingParen;
    if (uncertain) result += ' (?)';
    return result;
  }

  // Standalone To → Bef
  if (toPositions.length > 0 && fromPositions.length === 0) {
    const toIdx = toPositions[0];
    const date = parseDateTokens(allTokens, toIdx + 1, allTokens.length);
    if (!date.year) return '';
    date.modifier = 'Bef';
    let result = formatDate(date);
    if (trailingParen) result += ' ' + trailingParen;
    if (uncertain) result += ' (?)';
    return result;
  }

  // Two or more dates in one cell: an "or" date
  const spans = dateSpans(allTokens, 0, allTokens.length);
  if (spans.length > 1) {
    const read = orDate(allTokens, spans, betPositions.length > 0 || andPositions.length > 0);
    if (read) {
      let result = read.text;
      if (trailingParen) result += ' ' + trailingParen;
      if (read.uncertain || uncertain) result += ' (?)';
      return result;
    }
  }

  // Single date parse
  const date = parseDateTokens(allTokens, 0, allTokens.length);

  // Check for quarter
  if (date.quarter) {
    const q = date.quarter;
    if (date.year) {
      let result = `Q${q} ${date.year}`;
      if (trailingParen) result += ' ' + trailingParen;
      return result;
    }
  }

  // Validate
  if (!date.year && !date.month && !date.day) {
    // Check if there was only a modifier
    return '';
  }

  if (!date.year) {
    // No year found
    return '';
  }

  // Two-digit year without BC context
  if (date.year < 100 && !date.bc) {
    return '';
  }

  if (uncertain) date.uncertain = true;

  let result = formatDate(date);
  if (trailingParen) result += ' ' + trailingParen;
  return result;
}


// ---------- Range gap filling ----------
function fillRangeGaps(date1: DateParts, date2: DateParts): void {
  // If date1 missing year but date2 has year, copy year
  if (!date1.year && date2.year) {
    date1.year = date2.year;
  }
  // If date1 missing month but date2 has month and date1 has day, copy month
  if (!date1.month && date2.month && date1.day) {
    date1.month = date2.month;
  }
  // If date1 has a pending number (stored nowhere yet) but no day, and date1 has no month...
  // This is handled in the parser when a number is left in pendingNums
}

// ---------- Two dates in one cell: an "or" date ----------
// The two readings of an all-number date, as preProcess marks them (`__OR__a__OR__b__OR__`).
const TWO_READINGS = /__OR__(.*?)__OR__(.*?)__OR__/g;

// A year the book shortened to its last digits, after one it printed whole: `1875` and `80` give
// 1880, `1849` and `8` give 1848. Read in a dash range (`1875-80`) and an "or" date (`1849 or 50`).
function fullYear(base: number, tail: string): number {
  const p = Math.pow(10, tail.length);
  return Math.floor(base / p) * p + parseInt(tail, 10);
}

// The year a book shortened after an "or": the nearest one that ends in the printed digits, because an
// "or" names the year beside the one it follows, across a decade or a century too (`1849 or 8` is
// 1848, `1899 or 0` is 1900). Two as near keep `fullYear`'s (`1840 or 5` is 1845). A dash range keeps
// `fullYear`'s reading.
function nearestYear(base: number, tail: string): number {
  const step = Math.pow(10, tail.length);
  const same = fullYear(base, tail);
  return [same - step, same + step].reduce((best, y) => (Math.abs(y - base) < Math.abs(best - base) ? y : best), same);
}

// A date's year as a point in time: a B.C. year counts back, so 1500 BC comes before 1499 BC.
function yearInTime(d: DateParts): number {
  return d.bc ? -(d.year as number) : (d.year as number);
}

// Is a `/` all that is printed between tokens i and j?
function slashBetween(tokens: Token[], i: number, j: number): boolean {
  return j === i + 2 && tokens[i + 1].type === 'sym' && tokens[i + 1].value === '/';
}

// Are tokens i and j printed side by side: next to each other, or with only a `/` between?
function sideBySide(tokens: Token[], i: number, j: number): boolean {
  return j === i + 1 || slashBetween(tokens, i, j);
}

// Are the numbers at tokens i and j two days printed side by side (`23/24`, `13 15`)? Not when only a
// space is between them and together they make one day, which may be a day the scanner split in two
// (`3 1 MAR 1969` is 31 March).
function twoDays(tokens: Token[], i: number, j: number): boolean {
  if (slashBetween(tokens, i, j)) return true;
  return j === i + 1 && parseInt(tokens[i].value + tokens[j].value, 10) > 31;
}

// Is the token a month's name, as the parser reads one?
function isMonthToken(tok: Token): boolean {
  return tok.type === 'str' && MONTHS.has(normalizeAccents(tok.value).toLowerCase());
}

// Is the token a printed "or"?
function isOrToken(tok: Token): boolean {
  return tok.type === 'str' && MODIFIERS.get(tok.value.toLowerCase()) === 'or';
}

// Is the first number or month tokens[start..end) prints (with `last`, the last one) a month?
function monthAtEdge(tokens: Token[], start: number, end: number, last: boolean): boolean {
  const span = tokens.slice(start, end);
  for (const t of last ? span.reverse() : span) {
    if (t.type === 'num' || isMonthToken(t)) return t.type !== 'num';
  }
  return false;
}

// Did the parser read every number tokens[start..end) prints, as the date's day, year or the second
// half of a double year? `(38 in 1880)` prints an age it does not.
function readsEveryNumber(tokens: Token[], start: number, end: number, date: DateParts): boolean {
  const numbers = tokens.slice(start, end).filter((t) => t.type === 'num').length;
  return numbers <= [date.day, date.year, date.splitYear].filter((part) => part !== undefined).length;
}

// Do a and b say one date, the one leaving out a part the other has and agreeing on the rest
// (`Mar 1818` and `11 Mar 1818`, `1663` and `Oct 1663`)?
function oneDate(a: DateParts, b: DateParts): boolean {
  return a.year === b.year && (!a.month || !b.month || a.month === b.month)
    && (a.day === undefined || b.day === undefined || a.day === b.day);
}

// Where one date printed in the tokens begins and ends, and whether a printed "or" comes before it.
interface Span {
  start: number;
  end: number;
  afterOr: boolean;
}

// Where each date printed in tokens[start..end) begins and ends. A cell that prints one date, as
// nearly every cell does, is one span. A new date begins:
// - after a printed "or" (`25 or 29 Jan. 1856`). One between words (`in or before 1663`, `1760 or
//   later`) begins a "date" with nothing of its own, which says no date but its neighbour's, so the
//   cell is read as one date (orDate);
// - at a second year (`abt 1820 1824`, `28 JUL 1794/1797`), but not at the next year printed beside
//   the first, which is a double date and stays one date (`1722 1723`, `1767/1768`);
// - at a second month, with any number before it the first month did not take as its day
//   (`30 Oct. 1806 16 Nov 1806`, `16 Sept./Dec. 1785`, `bet. Sept. 22, Oct. 15, 1712`);
// - at a second day printed beside the first, before their month (`13 15 Apr. 1787`, `23/24 Oct 1870`)
//   or after it (`Jan 5/6 1785`), unless the two may be one day the scanner split (twoDays).
// Each span is then read as a whole cell is (parseDateTokens). This only finds where the dates are;
// it decides none of their parts.
function dateSpans(tokens: Token[], start: number, end: number): Span[] {
  const cuts: { at: number; afterOr: boolean }[] = [];
  let yearAt: number | undefined;   // the token read as this date's year
  let month = false;
  let dayAt: number | undefined;    // the token read as this date's day
  let loose: number[] = [];         // numbers up to 31 not yet read as a day

  for (let i = start; i < end; i++) {
    const tok = tokens[i];
    if (tok.type === 'str') {
      if (isOrToken(tok)) {
        cuts.push({ at: i + 1, afterOr: true });
        yearAt = undefined; month = false; dayAt = undefined; loose = [];
      } else if (isMonthToken(tok)) {
        if (month) {
          cuts.push({ at: loose.length ? loose[0] : i, afterOr: false });
          yearAt = undefined; dayAt = undefined;
        }
        month = true;
        let run = loose.length && loose[loose.length - 1] === i - 1 ? loose.slice(-1) : [];
        while (run.length && run.length < loose.length && twoDays(tokens, loose[loose.length - run.length - 1], run[0])) {
          run = loose.slice(-run.length - 1);
        }
        for (const at of run.slice(1)) cuts.push({ at, afterOr: false });
        if (run.length || loose.length === 1) dayAt = loose[loose.length - 1];
        loose = [];
      }
      continue;
    }
    if (tok.type !== 'num') continue;
    const n = parseInt(tok.value, 10);
    if (n >= 1000 && n <= 2200) {
      if (yearAt !== undefined && !(n === parseInt(tokens[yearAt].value, 10) + 1 && sideBySide(tokens, yearAt, i))) {
        cuts.push({ at: loose.length ? loose[0] : i, afterOr: false });
        month = false; dayAt = undefined;
      }
      if (loose.length === 1) dayAt = loose[0];
      yearAt = i; loose = [];
    } else if (n >= 1 && n <= 31 && !(yearAt !== undefined && slashBetween(tokens, yearAt, i))) {
      if (month && dayAt === undefined) {
        dayAt = i;
      } else if (month && yearAt === undefined && dayAt !== undefined && twoDays(tokens, dayAt, i)) {
        cuts.push({ at: i, afterOr: false });
        month = false; dayAt = i;
      } else {
        loose.push(i);
      }
    }
  }

  const starts = [{ at: start, afterOr: false }, ...cuts];
  return starts.map(({ at, afterOr }, k) => ({ start: at, end: k + 1 < starts.length ? starts[k + 1].at : end, afterOr }));
}

// `to` takes `src`'s day where it has none and its month can have that day.
function shareDay(to: DateParts, src: DateParts): void {
  if (to.day === undefined && src.day !== undefined && to.month && src.day <= DAYS_IN_MONTH[MONTH_NUM.get(to.month) ?? 0]) {
    to.day = src.day;
  }
}

// The dates of an "or" date printed as one share what the book printed once. A date missing its year
// or its month takes it from the nearest date that has one, the next first (`25 or 29 Jan. 1856`,
// `Aug 11 or 14, 1825`). Two months printed together are two months of one date, so a day printed once
// beside them is the day of both, before them (`16 Sept./Dec. 1785`) or after them (`Feb./May 17,
// 1672`), where the month can have it; a day printed between two months is the first month's alone
// (`Dec 18. Apr 1763`), and a month printed beside its own year shares no day (`Sept. 1785 or 16 Oct.
// 1785`). monthsTogether[k] says whether date k's month is printed beside the month of the date before it.
function fillShared(dates: DateParts[], monthsTogether: boolean[]): void {
  dates.forEach((d, k) => {
    const nearest = [...dates.slice(k + 1), ...dates.slice(0, k).reverse()];
    if (d.year === undefined) {
      const src = nearest.find((x) => x.year !== undefined);
      if (src) {
        d.year = src.year; d.splitYear = src.splitYear; d.bc = src.bc;
      }
    }
    if (d.day !== undefined && !d.month) {
      const src = nearest.find((x) => x.month);
      if (src) d.month = src.month;
    }
  });
  for (let k = dates.length - 1; k > 0; k--) {
    if (monthsTogether[k]) shareDay(dates[k - 1], dates[k]);
  }
  for (let k = 1; k < dates.length; k++) {
    if (monthsTogether[k]) shareDay(dates[k], dates[k - 1]);
  }
}

// Two or more dates printed in one cell: dates in two years go up as between the years (`1678 or 9`
// -> `Bet 1678 and 1679`), and dates in one year with every one spelled out (`25 or 29 Jan. 1856` ->
// `25 Jan 1856 or 29 Jan 1856`). Where the cell prints `bet` or `and` (`bet. Sept. 22, Oct. 15,
// 1712`), its two dates are a range's ends. A number alone after an "or" that follows a year is that
// year shortened, to the nearest year ending in its digits (`1849 or 50`, `1849 or 8`, `1899 or 0`).
//
// Returns null where the cell does not read as two dates and is read as one, as before: a number left
// over, among dates printed side by side with no "or" (`(38 in 1880) 1842` is an age and a year) or in
// a date that takes its year from another, where it may be that date's own year (`18 Aug 1912 or 26 Aug
// '09`); a date before or after another, which no form of two dates says; a date with no year, or a
// day with no month; and dates that say one date (`March March 11, 1818`, `October or thereabouts
// 1663`, and an "or" between words, `1678 or earlier`). A qualifier is dropped, as on a range: the
// "or" already says the date is not known exactly. A range runs from the earlier year to the later,
// and a B.C. year counts back (`1500 B.C. or 1499 B.C.` -> `Bet 1500 BC and 1499 BC`).
function orDate(tokens: Token[], spans: Span[], between: boolean): { text: string; uncertain: boolean } | null {
  const dates = spans.map((s) => parseDateTokens(tokens, s.start, s.end));
  for (let k = 1; k < dates.length; k++) {
    const { start, end, afterOr } = spans[k];
    const tail = afterOr && end - start === 1 && tokens[start].type === 'num' ? tokens[start].value : undefined;
    const before = dates[k - 1].year;
    const full = tail !== undefined && before !== undefined ? nearestYear(before, tail) : undefined;
    if (full !== undefined && full >= 1000 && full <= 2200) dates[k] = { year: full };
  }
  const printedOr = spans.some((s) => s.afterOr);
  if (!spans.every((s, k) => (printedOr && dates[k].year !== undefined) || readsEveryNumber(tokens, s.start, s.end, dates[k]))) {
    return null;
  }
  if (dates.some((d) => d.modifier === 'Bef' || d.modifier === 'Aft')) return null;
  fillShared(dates, spans.map((s, k) => k > 0 && monthAtEdge(tokens, spans[k - 1].start, spans[k - 1].end, true)
    && monthAtEdge(tokens, s.start, s.end, false)));
  if (dates.some((d) => d.year === undefined || (d.day !== undefined && !d.month))) return null;
  if (dates.some((a, k) => dates.slice(k + 1).some((b) => oneDate(a, b)))) return null;
  const uncertain = dates.some((d) => d.uncertain);
  for (const d of dates) {
    d.modifier = undefined; d.uncertain = undefined;
  }
  const years = dates.map((d) => yearInTime(d));
  const first = dates[years.indexOf(Math.min(...years))];
  const last = dates[years.indexOf(Math.max(...years))];
  if (between) {
    if (dates.length !== 2) return null;
    return { text: `Bet ${formatDate(dates[0])} and ${formatDate(dates[1])}`, uncertain };
  }
  if (yearInTime(first) !== yearInTime(last)) {
    const ends = [first, last].map((d) => formatDate({ year: d.year, splitYear: d.splitYear, bc: d.bc }));
    return { text: `Bet ${ends[0]} and ${ends[1]}`, uncertain };
  }
  return { text: dates.map((d) => formatDate(d)).join(' or '), uncertain };
}
