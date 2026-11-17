/**
 * Genealogical date standardizer.
 * Converts free-form date strings into a canonical format.
 */
import {
  normalizeAccents,
  MONTHS,
  TWO_LETTER_MONTHS,
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

// ---------- All-number dates ----------
// What may stand between the numbers of an all-number date, beside the plain `/`, `.` and `-`: one
// of those or a comma, a bar or a middle dot, with a space beside it or not, or a space alone. A
// number right after a digit is inside a longer one (`123 4 1850`), so a date does not start there.
const ALL_NUMBER_GAP = String.raw`(?:\s*[/.\-,|·]\s*|\s+)`;
const SPACED_ALL_NUMBER = new RegExp(String.raw`(?<!\d)(\d{1,2})${ALL_NUMBER_GAP}(\d{1,2})${ALL_NUMBER_GAP}(\d{4})`, 'g');
// A year written first, then the month and the day, with the same separators (`1772, 9, 30`).
const SPACED_YEAR_FIRST = new RegExp(String.raw`(?<!\d)(\d{4})${ALL_NUMBER_GAP}(\d{1,2})${ALL_NUMBER_GAP}(\d{1,2})(?!\d)`, 'g');
// A month written as a Roman numeral, `i` to `xii` in either case, between a day and a year
// (`19.vi.1697`) or after a year (`1737 II.17.`).
const ROMAN_MONTHS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
const ROMAN_MONTH = ROMAN_MONTHS.join('|');
const ROMAN_MONTH_DAY_FIRST = new RegExp(String.raw`(?<!\d)(\d{1,2})${ALL_NUMBER_GAP}(${ROMAN_MONTH})${ALL_NUMBER_GAP}(\d{4})(?!\d)`, 'gi');
const ROMAN_MONTH_YEAR_FIRST = new RegExp(String.raw`(?<!\d)(\d{4})${ALL_NUMBER_GAP}(${ROMAN_MONTH})${ALL_NUMBER_GAP}(\d{1,2})(?!\d)`, 'gi');

// One number before a year, with only a separator between them (`11/1922`, `5 1963`, `4th 1864`,
// `22d 1805`). A number right after a separator stands beside a blank (`/07/1879`), so it is not read.
// The ordinals a day may carry, with the books' older `22d` for 22nd.
const DAY_ORDINALS = [...ORDINAL_SUFFIXES, 'd'];
const MONTH_AND_YEAR = new RegExp(
  String.raw`(?<![/.\-])(\d{1,2})(${DAY_ORDINALS.join('|')})?${ALL_NUMBER_GAP}(\d{4})`, 'gi');

// A number from 1 to 12 alone before a year is the month (`5 1963` is May 1963). Over 12, or with an
// ordinal (`22. 1911`, `4th 1864`), it is a day with no month, so only the year is sure. ALONE: the rest
// of the date holds no other number and no word but a qualifier (`abt 5 1850`). Beside a month it does
// not know (`Febuary 4, 1951`), a Quaker `mo` (`1 mo. 12, 1739`) or another number (`13 13 1850`), the
// number is something else, and reading it as the month would give a wrong month that looks right.
function monthAndYear(match: string, n: string, ordinal: string | undefined, y: string, offset: number, whole: string): string {
  const nn = parseInt(n, 10);
  const rest = `${whole.slice(0, offset)} ${whole.slice(offset + match.length)}`;
  const alone = !/\d/.test(rest) && tokenize(normalizeAccents(rest)).every((t) => t.type !== 'str' || MODIFIERS.has(t.value.toLowerCase()));
  if (!alone) return match;
  const mon = !ordinal && nn >= 1 && nn <= 12 ? numToMonth(nn) : undefined;
  return mon ? `${mon} ${y}` : y;
}

// A dash inside one date is a separator, not a range: between a word and a number (`May-5-1886`,
// `June—1872`, `ca-1828`), between a day and a month (`24-Nov 1716`), and between a month's day and its
// year (`Aug 7-1834`). A word is never a whole date. A dash between two whole dates or years stays a
// range (`Apr 1756-May 1757`), and so does one between two days (`Oct 16-23, 1910`), whose month and
// year are printed once.
const WORD_DASH_NUMBER = /([A-Za-z]+)(\.?)\s*-\s*(?=\d)/g;
// A number followed by a month name is the day of the next date (`30 Aug - 11 Sept 1820`).
const DAY_THEN_MONTH = /^\d{1,2}(?!\d)[.,]?\s*([A-Za-z]+)/;
const NUMBER_DASH_MONTH = /(?<!\d)(\d{1,2})\s*-\s*([A-Za-z]+)/g;
const MONTH_DAY_DASH_YEAR = new RegExp(
  String.raw`([A-Za-z]+)([.,]?\s*\d{1,2}(?:${DAY_ORDINALS.join('|')})?)(?!\d)\s*-\s*(\d{4})(?!\d)`, 'gi');

// A month given by its number, as the Quakers wrote it (`3 mo.`, `5th month`, `9m`), and a year with
// the second year the book may print after it (`1720/21`, `1747-8`).
// The words that mark a month given by its number (`7 mo`, `9m`, `10th month`).
const MONTH_NUMBER_WORDS = ['month', 'mth', 'mo', 'm'];
// The word may carry a raised letter (`12mº`, `9thmᵒ`, `9th moⁿ`), and no other letter or digit may follow it: in
// `5 März` the `M` begins a word.
const QUAKER_MONTH = new RegExp(String.raw`(?<!\d)(\d{1,2})(?:${DAY_ORDINALS.join('|')})?\s*[.:;]?\s*`
  + String.raw`(?:${MONTH_NUMBER_WORDS.join('|')})[ºᵒⁿ]*(?![\p{L}\p{N}_])\.?`, 'giu');
const QUAKER_YEAR = /(?<!\d)(\d{4})(\s*[/-]\s*\d{1,4})?(?!\d)/g;
// The year the English calendar began on 1 January rather than in March: a Quaker first month is
// March before it and January from it.
const NEW_STYLE_FROM = 1752;
const OLD_STYLE_FIRST_MONTH = MONTH_NUM.get('Mar') as number;

// `15 7 mo 1725` is 15 September 1725. The month is the number written with `mo`, `m` or `month`, and
// the one other number, if there is one, is the day. Before 1752 the first month is March, and the
// eleventh and twelfth are January and February of the next year, unless the book prints a second year
// itself (`1720/21`), which is kept. Only with one such month, one year and at most one other number;
// anything else is left as it was. A book that also names the month (`4th month Called June 1716`)
// names the same one, and the day it would otherwise hide is read.
function quakerDate(text: string): string {
  const months = [...text.matchAll(QUAKER_MONTH)];
  const years = [...text.matchAll(QUAKER_YEAR)];
  // The same year printed twice (`in the year 1665 1665`: the record's and its copy's) is one year.
  if (months.length !== 1 || new Set(years.map((y) => y[0])).size !== 1) return text;
  const [mo, yr] = [months[0], years[0]];
  const q = parseInt(mo[1], 10);
  const y = parseInt(yr[1], 10);
  if (q < 1 || q > MONTH_NUM.size || y < 1000 || y > 2200) return text;
  const inside = (i: number, m: RegExpMatchArray): boolean => i >= (m.index ?? 0) && i < (m.index ?? 0) + m[0].length;
  const others = [...text.matchAll(/\d+/g)]
    .filter((n) => !inside(n.index ?? 0, mo) && !years.some((y) => inside(n.index ?? 0, y)));
  if (others.length > 1) return text;
  const oldStyle = y < NEW_STYLE_FROM;
  const month = oldStyle ? (q + OLD_STYLE_FIRST_MONTH - 2) % MONTH_NUM.size + 1 : q;
  // January and February, the last two months of an Old Style year, fall in the next year as we count.
  const nextYear = oldStyle && month < OLD_STYLE_FIRST_MONTH;
  const year = nextYear && !yr[2] ? `${y + 1}` : yr[0];
  const parts: [number, number, string][] = [
    [mo.index ?? 0, (mo.index ?? 0) + mo[0].length, ` ${numToMonth(month)} `],
    [yr.index ?? 0, (yr.index ?? 0) + yr[0].length, year],
    ...years.slice(1).map((y): [number, number, string] => [y.index ?? 0, (y.index ?? 0) + y[0].length, '']),
  ];
  parts.sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [start, end, replacement] of parts) {
    out += text.slice(pos, start) + replacement;
    pos = end;
  }
  return out + text.slice(pos);
}

// Part of a year: a missing last digit is a decade (`186-`, `186_`, `186`, `190?-`), and two missing
// digits a century (`19__`, `18--`); and a decade or a century written with an `s` (`1850's`, `1870s`, and
// `1800's`, the century, which holds the decade 1800-1809 too if that is what was meant). Only where the
// cell is that and nothing else but an approximation, which a range drops anyway (`ca 170-`), or words that
// say only where in it (`early 1870's`, `in the 1850's`).
const YEAR_PART_WORDS = String.raw`^\s*((?:[A-Za-z]+\.?[\s,;-]+)*)`;
const DECADE = new RegExp(String.raw`${YEAR_PART_WORDS}(\d{3})(?:\s*[-_?])*\s*$`);
const CENTURY = new RegExp(String.raw`${YEAR_PART_WORDS}(\d{2})(?:\s*[-_?]){2,}\s*$`);
const DECADE_WITH_S = new RegExp(String.raw`${YEAR_PART_WORDS}(\d{2}[1-9])0\s*['’]?\s*s\s*$`, 'i');
const CENTURY_WITH_S = new RegExp(String.raw`${YEAR_PART_WORDS}(\d{2})00\s*['’]?\s*s\s*$`, 'i');
const WITHIN_A_SPAN = new Set(['early', 'mid', 'late', 'in', 'the']);

function partOfAYear(text: string): string | undefined {
  for (const [rx, span] of [[DECADE, 10], [CENTURY, 100], [DECADE_WITH_S, 10], [CENTURY_WITH_S, 100]] as const) {
    const m = text.match(rx);
    if (!m) continue;
    const words = m[1].match(/[A-Za-z]+/g) ?? [];
    if (words.some((w) => !WITHIN_A_SPAN.has(w.toLowerCase())
      && !APPROXIMATIONS.has(MODIFIERS.get(w.toLowerCase()) ?? ''))) return undefined;
    const first = parseInt(m[2], 10) * span;
    const last = first + span - 1;
    return first >= 1000 && last <= 2200 ? `${first}-${last}` : undefined;
  }
  return undefined;
}

// Can this month (1-12) have this day? February is given 29: a leap year is always possible.
function dayFits(day: number, month: number): boolean {
  return day >= 1 && day <= DAYS_IN_MONTH[month];
}

// Is this word a month name (`Aug`, `Sept`, `März`)?
function isMonth(word: string): boolean {
  return MONTHS.has(normalizeAccents(word).toLowerCase());
}

// Does this text name a month anywhere?
function monthNamedIn(s: string): boolean {
  return tokenize(normalizeAccents(s)).some((t) => t.type === 'str' && isMonth(t.value));
}

// A month's two-letter code (see TWO_LETTER_MONTHS) standing alone as a word.
const TWO_LETTER_MONTH = new RegExp(
  String.raw`(?<![A-Za-z0-9])(${[...TWO_LETTER_MONTHS.keys()].join('|')})(?![A-Za-z0-9])`, 'gi');

// A digit the scanner read as a letter: `I` or `l` for 1, `O` for 0 (`I664`, `Feb.I0`, `18O5`). Only in a number
// of at most four characters with a digit in it, so a word (`II`, `Dec. I`) and a longer number (`1789I`) stay.
const LETTER_FOR_DIGIT = /(?<![A-Za-z0-9])(?=[0-9IlO]{0,3}[0-9])[0-9IlO]{1,4}(?![A-Za-z0-9])/g;
const DIGIT_OF_LETTER: Record<string, string> = { I: '1', l: '1', O: '0' };
// And a day written in those letters alone, right after a month (`Oct. II`, `Dec. I`): a word is not a day there.
const LETTER_DAY_AFTER_MONTH = /(?<![A-Za-z])([A-Za-z]+)(\.\s*|\s+)([IlO]{1,2})(?![A-Za-z0-9])/g;

// `no later than 1813` is before it, and `not earlier than 1751` after it.
const NO_LATER_OR_EARLIER = /\bnot? (later|earlier) than\b/gi;

// A day the books name instead of numbering it (`Christmas 1873`, `New Year's Day 1868`): its day and month.
const NAMED_DAYS: [RegExp, number, number][] = [
  [/\b(?:christmas|xmas)\s+eve\b/gi, 24, 12],
  [/\b(?:christmas|xmas)(?:\s+day)?\b/gi, 25, 12],
  [/\bnew\s+year['’]?s?\s+eve\b/gi, 31, 12],
  [/\bnew\s+year['’]?s?\s+day\b/gi, 1, 1],
];

// Numbers the books write in words, read as digits: a day (`twenty-seventh of November 1771`, `February sixth,
// 1861`), a Quaker month (`the sixth month`) and a year (`one thousand eight hundred and ninety eight`, `nineteen
// hundred and 97`, `Eighteen thirty-eight`). A counting word is read only beside a day, a month or a month's name
// (`fourteen day of the 5 month`, `Twenty eight March`), so `two months ago` and `some twenty years` keep theirs.
const NUMBER_WORDS: Map<string, number> = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
  ['ten', 10], ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14], ['fifteen', 15], ['sixteen', 16],
  ['seventeen', 17], ['eighteen', 18], ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50],
  ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90],
]);
const ORDINAL_WORDS: Map<string, number> = new Map([
  ['first', 1], ['second', 2], ['third', 3], ['fourth', 4], ['fifth', 5], ['sixth', 6], ['seventh', 7], ['eighth', 8],
  ['ninth', 9], ['tenth', 10], ['eleventh', 11], ['twelfth', 12], ['thirteenth', 13], ['fourteenth', 14],
  ['fifteenth', 15], ['sixteenth', 16], ['seventeenth', 17], ['eighteenth', 18], ['nineteenth', 19],
  ['twentieth', 20], ['thirtieth', 30],
]);
const SCALE_WORDS: Map<string, number> = new Map([['hundred', 100], ['thousand', 1000]]);
// The books' old spellings, beyond the `ff` for a capital F, the `u` for a `v`, the `ea` for an `e` and the final
// `e` that `numberWord` reads anyway (`ffirst`, `Seuen`, `Eleaventh`, `foure`). Each is printed in two cells or more.
const OLD_NUMBER_SPELLINGS: Map<string, string> = new Map([
  ['twelf', 'twelfth'], ['twelveth', 'twelfth'], ['nineth', 'ninth'], ['fift', 'fifth'], ['sixt', 'sixth'],
  ['forth', 'fourth'], ['fowerth', 'fourth'], ['fiftenth', 'fifteenth'], ['twentifieth', 'twentieth'],
  ['thirtyeth', 'thirtieth'], ['elventh', 'eleventh'], ['thoussand', 'thousand'], ['thovsand', 'thousand'],
  ['too', 'two'],
]);
// The words after a counting word that make it a day or a month (`fourteen day`, `the seven month`).
const DAY_OR_MONTH_WORDS = new Set(['day', 'daye', 'd', 'dy', 'month', 'mo']);
// What an ordinal can count other than a date: a weekday (`first day of the week`) and an age (`thirty fourth year`).
const DAY_OF_THE_WEEK = /^\W*(?:day|dy|daye)\W+of\W+(?:the|ye)\W+weeke?\b/i;
const YEAR_WORDS = new Set(['year', 'yeare', 'yr']);
const WORD_OR_NUMBER = /[A-Za-z]+|\d+|&/g;
const JOINS_NUMBER_WORDS = /^[\s/-]*$/;

// A date printed before a `to` (or `until`), which starts a range the way a dash does (`1898 to 1900`).
const TO_WORDS = [...MODIFIERS].filter(([, mod]) => mod === 'To').map(([word]) => word);
const DATE_BEFORE_TO = new RegExp(String.raw`\d.*\b(${TO_WORDS.join('|')})\b`, 'i');

// The standard spelling of a number word (`ffirst` -> `first`, `Seuen` -> `seven`), or undefined.
function numberWord(word: string): string | undefined {
  let w = word.toLowerCase();
  if (w.startsWith('ff')) w = w.slice(1);
  const modern = w.replace(/u/g, 'v').replace(/ea/g, 'e');
  for (const form of [w, w.replace(/e$/, ''), modern, modern.replace(/e$/, '')]) {
    if (NUMBER_WORDS.has(form) || ORDINAL_WORDS.has(form) || SCALE_WORDS.has(form)) return form;
  }
  return OLD_NUMBER_SPELLINGS.get(w);
}

// Does `text` give a month: a month's name or two-letter code, or a Quaker month's number?
function givesAMonth(text: string): boolean {
  return monthNamedIn(text) || text.search(TWO_LETTER_MONTH) >= 0
    || [...text.matchAll(QUAKER_MONTH)].some((m) => parseInt(m[1], 10) >= 1 && parseInt(m[1], 10) <= MONTH_NUM.size);
}

// `text` with the numbers it writes in words as digits, where they are a day (unless not `days`), a month or a year.
function numbersInWords(text: string, days = true): string {
  const toks = [...text.matchAll(WORD_OR_NUMBER)];
  const at = (k: number): number => toks[k].index ?? 0;
  const endOf = (k: number): number => at(k) + toks[k][0].length;
  let out = '';
  let pos = 0;
  let i = 0;
  while (i < toks.length) {
    if (numberWord(toks[i][0]) === undefined) {
      i++;
      continue;
    }
    // The run: number words with spaces, a hyphen or a slash between them (`twenty/seventh`), `and` or `&`
    // between two of them, and after a hundred or a thousand the year's last digits (`nine hundred and 61`).
    // An ordinal ends it.
    let total = 0;
    let current = 0;
    let ordinal = false;
    let scaled = false;
    let hundred = false;
    let end = i;
    let j = i;
    while (j < toks.length && !ordinal) {
      if (j > i && !JOINS_NUMBER_WORDS.test(text.slice(endOf(j - 1), at(j)))) break;
      const tok = toks[j][0];
      const form = numberWord(tok);
      if (form === undefined) {
        if ((tok.toLowerCase() === 'and' || tok === '&') && j + 1 < toks.length
          && (numberWord(toks[j + 1][0]) !== undefined || (scaled && /^\d+$/.test(toks[j + 1][0])))) {
          j++;
          continue;
        }
        if (scaled && /^\d+$/.test(tok) && tok.length <= 2) {
          current += parseInt(tok, 10);
          end = j;
        }
        break;
      }
      if (SCALE_WORDS.has(form)) {
        if (form === 'hundred') {
          current = (current || 1) * 100;
          hundred = true;
        } else {
          total += (current || 1) * 1000;
          current = 0;
        }
        scaled = true;
      } else {
        const value = NUMBER_WORDS.get(form) ?? ORDINAL_WORDS.get(form) ?? 0;
        ordinal = ORDINAL_WORDS.has(form);
        // A year said in pairs (`Eighteen thirty-eight`): a teen, then tens.
        current = current >= 10 && current <= 19 && value % 10 === 0 && !scaled
          ? current * 100 + value
          : current + value;
      }
      end = j;
      j++;
    }
    const number = total + current;
    const after = end + 1 < toks.length ? toks[end + 1][0] : '';
    const before = i > 0 ? toks[i - 1][0] : '';
    const isYear = scaled || number >= 1000;
    let read: boolean;
    if (isYear && SCALE_WORDS.has(numberWord(toks[end][0]) ?? '') && /^[A-Za-z]+$/.test(after) && !isMonth(after)) {
      read = false;                     // `Eighteen Hundred Eorty`: the year goes on in a word not read
    } else if (total && current && !hundred) {
      read = false;                     // `one thousand Seuen and thirty fiue`: its hundreds were left out
    } else if (!isYear && !ordinal && /^\d+$/.test(before) && text.slice(endOf(i - 1), at(i)).trim() === '') {
      read = false;                     // `14ten August`: the German ending of the number before it
    } else if (ordinal && (YEAR_WORDS.has(after.toLowerCase()) || DAY_OF_THE_WEEK.test(text.slice(endOf(end))))) {
      read = false;                     // a weekday or an age, not a date
    } else {
      read = isYear || ordinal || DAY_OR_MONTH_WORDS.has(after.toLowerCase()) || isMonth(after) || isMonth(before);
    }
    if (read && !days && !isYear && !MONTH_NUMBER_WORDS.includes(after.toLowerCase())) read = false;
    if (read) {
      out += text.slice(pos, at(i)) + String(number);
      pos = endOf(end);
    }
    i = end + 1;
  }
  return out + text.slice(pos);
}

// The month a Roman numeral names, as the number `iso` reads.
function romanMonth(numeral: string): string {
  return String(ROMAN_MONTHS.indexOf(numeral.toLowerCase()) + 1);
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
  // GEDCOM's interpreted date, `INT 29 Sep 1874 (second-last day of month)`, is an estimate. Without the phrase,
  // the books' `int.` is a marriage's intentions (`Int. 1751`), and the word is dropped.
  if (trailingParen) text = text.replace(/^int\b\.?/i, 'est');

  text = text.replace(LETTER_FOR_DIGIT, (token: string) => token.replace(/[IlO]/g, (c: string) => DIGIT_OF_LETTER[c]));
  text = text.replace(LETTER_DAY_AFTER_MONTH, (match: string, word: string, gap: string, day: string) =>
    (isMonth(word) ? `${word}${gap}${day.replace(/[IlO]/g, (c: string) => DIGIT_OF_LETTER[c])}` : match));
  text = text.replace(NO_LATER_OR_EARLIER, (_match: string, word: string) =>
    (word.toLowerCase() === 'later' ? 'bef' : 'aft'));
  for (const [rx, day, month] of NAMED_DAYS) text = text.replace(rx, `${day} ${numToMonth(month)}`);
  // A number word that is the day is read only where the date gives its month too: a day with no month goes up as
  // `8 1663`, which reads as August (C's rule: then the year alone).
  const wordsRead = numbersInWords(text);
  text = givesAMonth(wordsRead) ? wordsRead : numbersInWords(text, false);

  // Part of a year, before the question mark is read: a `?` there is a missing digit (`190?-`).
  text = partOfAYear(text) ?? text;

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

  // A Quaker numbered month (`15 7 mo 1725`), before anything else reads its numbers.
  text = quakerDate(text);

  // Convert yyyy-mm-dd / yyyy/mm/dd / yyyy.mm.dd embedded dates
  const iso = (_match: string, y: string, m: string, d: string): string => {
    const yy = parseInt(y, 10);
    const mm = parseInt(m, 10);
    const dd = parseInt(d, 10);
    if (yy >= 1000 && yy <= 2200 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      // A day the month does not have, with every part a number: only the year is sure.
      if (!dayFits(dd, mm)) return `${yy}`;
      const mon = numToMonth(mm);
      if (mon) return `${dd} ${mon} ${yy}`;
    }
    return _match;
  };
  text = text.replace(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/g, iso);

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
  const ambiguous = (_match: string, a: string, b: string, y: string): string => {
    const aa = parseInt(a, 10);
    const bb = parseInt(b, 10);
    const yy = parseInt(y, 10);
    if (yy < 1000 || yy > 2200) return _match;

    const aIsDay = aa >= 1 && aa <= 31;
    const bIsDay = bb >= 1 && bb <= 31;
    const aIsMonth = aa >= 1 && aa <= 12;
    const bIsMonth = bb >= 1 && bb <= 12;

    if (aa > 12 && bIsMonth) {
      // dd-mm-yyyy. A day the month does not have, with every part a number: only the year is sure.
      if (!dayFits(aa, bb)) return `${yy}`;
      const mon = numToMonth(bb);
      return mon ? `${aa} ${mon} ${yy}` : _match;
    } else if (bb > 12 && aIsMonth) {
      // mm-dd-yyyy
      if (!dayFits(bb, aa)) return `${yy}`;
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
  };
  text = text.replace(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/g, ambiguous);

  // An all-number date with separators the two patterns above do not read: a space beside a separator
  // or in place of one (`17. 11. 1960`, `23 8 1924`, `2- 8-1875`, `1772, 9, 30`), or a comma, a bar or
  // a middle dot (`7, 17, 1913`, `24 | 6 | 1754`, `24·1·1889`); and a month written as a Roman numeral
  // (`19.vi.1697`, `1737 II.17.`); and one number before a year (`11/1922`). Read by the same two
  // readers, and the last as the month or not at all, but only where no month is named:
  // beside a month name, two of the numbers are a day and something else (`Nov 9 9. 1722`,
  // `29 Jan 1734-5 1735`, `Jan 5/6 1785`), so those are left as they were. A month written as a two-letter
  // code (`1848 DE 27`) is read first, and only here, where no other month is named.
  let monthNamed = monthNamedIn(text);
  if (!monthNamed) {
    const before = text;
    text = text.replace(TWO_LETTER_MONTH, (code: string) => TWO_LETTER_MONTHS.get(code.toLowerCase()) as string);
    monthNamed = text !== before;
  }
  if (!monthNamed) {
    text = text.replace(SPACED_YEAR_FIRST, iso);
    text = text.replace(ROMAN_MONTH_YEAR_FIRST, (_match: string, y: string, r: string, d: string) => iso(_match, y, romanMonth(r), d));
    text = text.replace(ROMAN_MONTH_DAY_FIRST, (_match: string, d: string, r: string, y: string) => iso(_match, y, romanMonth(r), d));
    text = text.replace(SPACED_ALL_NUMBER, ambiguous);
    text = text.replace(MONTH_AND_YEAR, monthAndYear);
  }

  // Convert dd-Mon-yyyy (dashes between day/month/year with alpha month) → spaces
  text = text.replace(/(\d{1,2})-([a-zA-Z]+)-(\d{4})/g, '$1 $2 $3');

  // A dash inside one date is a separator (see WORD_DASH_NUMBER). A number after a word and a dash is
  // part of the same date only where it is not the day of the next one (`30 Aug - 11 Sept 1820`); a day
  // before a dash and a month, only where no month comes before it (`Jan 5-Feb 6, 1850`).
  text = text.replace(WORD_DASH_NUMBER, (match: string, word: string, dot: string, offset: number, whole: string) => {
    const next = whole.slice(offset + match.length).match(DAY_THEN_MONTH);
    return next && isMonth(next[1]) ? match : `${word}${dot} `;
  });
  text = text.replace(NUMBER_DASH_MONTH, (match: string, day: string, word: string, offset: number, whole: string) =>
    (isMonth(word) && !monthNamedIn(whole.slice(0, offset)) ? `${day} ${word}` : match));
  text = text.replace(MONTH_DAY_DASH_YEAR, (match: string, word: string, day: string, year: string) =>
    (isMonth(word) ? `${word}${day} ${year}` : match));

  // Handle abbreviated year ranges: 1875-80 → 1875-1880 (BEFORE dash processing)
  text = text.replace(/(\d{4})-(\d{1,3})(?!\d)/g, (_match, base, suffix) => {
    const baseYear = parseInt(base, 10);
    const suffixNum = parseInt(suffix, 10);
    if (baseYear >= 1000 && baseYear <= 2200 && suffix.length < 4) {
      // Check it's not already a full year range converted above
      const suffixLen = suffix.length;
      const expanded = Math.floor(baseYear / Math.pow(10, suffixLen)) * Math.pow(10, suffixLen) + suffixNum;
      return `${base}-${expanded}`;
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

  // A date before a `to` is where the range starts, as it is before a dash (`1898 to 1900`).
  if (!/\b(from|frm|bet|btw|between)\b/i.test(text) && DATE_BEFORE_TO.test(text)) {
    text = 'from ' + text;
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
          // Double modifier — keep the first (primary), unless the first says only that the date is not exact
          // and the second that it is before or after (`prob. before 1814`), as a range drops an approximation.
          if (APPROXIMATIONS.has(parts.modifier) && OPEN_ENDS.has(mod)) parts.modifier = mod;
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

  // A day the month does not have, with the month printed as a word (`31 Nov. 1706`): the month is
  // sure and the day is the likely misreading, so the month and the year are kept.
  if (parts.day !== undefined && parts.month && !dayFits(parts.day, MONTH_NUM.get(parts.month) ?? 0)) {
    parts.day = undefined;
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
// The qualifiers that say a date is not exact. A range already says so, and GEDCOM has none inside
// one (`about 1750-55` is `Bet 1750 and 1755`). Before and after change what the range means, so stay.
const APPROXIMATIONS = new Set(['Abt', 'Est', 'Cal']);
// The qualifiers that say on which side of the date it fell.
const OPEN_ENDS = new Set(['Bef', 'Aft']);

function fillRangeGaps(date1: DateParts, date2: DateParts): void {
  for (const date of [date1, date2]) {
    if (date.modifier && APPROXIMATIONS.has(date.modifier)) date.modifier = undefined;
  }
  // `Oct 16-23, 1910`: two days of one month, whose month is printed once, before them, and the year
  // once, after them. The second day takes the month only then, while the first has no year of its own.
  const yearPrintedOnce = !date1.year;
  // If date1 missing year but date2 has year, copy year
  if (!date1.year && date2.year) {
    date1.year = date2.year;
  }
  // If date1 missing month but date2 has month and date1 has day, copy month
  if (!date1.month && date2.month && date1.day) {
    date1.month = date2.month;
  }
  if (yearPrintedOnce && !date2.month && date1.month && date2.day) {
    date2.month = date1.month;
  }
  // If date1 has a pending number (stored nowhere yet) but no day, and date1 has no month...
  // This is handled in the parser when a number is left in pendingNums
}
