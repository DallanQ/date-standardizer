import { describe, test, expect } from 'vitest';
import {
  normalizeAccents,
  MONTHS,
  MONTH_NUM,
  DAYS_IN_MONTH,
  MONTH_DAY_OFFSETS,
  MODIFIERS,
  QUARTER_WORDS,
  UNKNOWN_PHRASES,
  SPECIAL_PHRASES,
  ORDINAL_SUFFIXES,
  BC_WORDS,
  AD_WORDS,
  WFT_PATTERN,
} from './dateConstants';
import { stdDate } from './dateStandardize';

describe('normalizeAccents', () => {
  test('strips diacritics from French month names', () => {
    expect(normalizeAccents('février')).toBe('fevrier');
    expect(normalizeAccents('décembre')).toBe('decembre');
    expect(normalizeAccents('août')).toBe('aout');
  });

  test('strips diacritics from German month names', () => {
    expect(normalizeAccents('März')).toBe('Marz');
  });

  test('strips diacritics from Dutch words', () => {
    expect(normalizeAccents('vóór')).toBe('voor');
  });

  test('passes ASCII through unchanged', () => {
    expect(normalizeAccents('january')).toBe('january');
    expect(normalizeAccents('Jun')).toBe('Jun');
    expect(normalizeAccents('')).toBe('');
  });
});

describe('MONTHS', () => {
  test('all keys are lowercase', () => {
    for (const key of MONTHS.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  test('English month names map to abbreviations', () => {
    expect(MONTHS.get('january')).toBe('Jan');
    expect(MONTHS.get('february')).toBe('Feb');
    expect(MONTHS.get('march')).toBe('Mar');
    expect(MONTHS.get('april')).toBe('Apr');
    expect(MONTHS.get('may')).toBe('May');
    expect(MONTHS.get('june')).toBe('Jun');
    expect(MONTHS.get('july')).toBe('Jul');
    expect(MONTHS.get('august')).toBe('Aug');
    expect(MONTHS.get('september')).toBe('Sep');
    expect(MONTHS.get('october')).toBe('Oct');
    expect(MONTHS.get('november')).toBe('Nov');
    expect(MONTHS.get('december')).toBe('Dec');
  });

  test('English abbreviations map correctly', () => {
    expect(MONTHS.get('jan')).toBe('Jan');
    expect(MONTHS.get('feb')).toBe('Feb');
    expect(MONTHS.get('mar')).toBe('Mar');
    expect(MONTHS.get('apr')).toBe('Apr');
    expect(MONTHS.get('jun')).toBe('Jun');
    expect(MONTHS.get('jul')).toBe('Jul');
    expect(MONTHS.get('aug')).toBe('Aug');
    expect(MONTHS.get('sep')).toBe('Sep');
    expect(MONTHS.get('sept')).toBe('Sep');
    expect(MONTHS.get('oct')).toBe('Oct');
    expect(MONTHS.get('nov')).toBe('Nov');
    expect(MONTHS.get('dec')).toBe('Dec');
  });

  test('Dutch month names', () => {
    expect(MONTHS.get('januari')).toBe('Jan');
    expect(MONTHS.get('februari')).toBe('Feb');
    expect(MONTHS.get('maart')).toBe('Mar');
    expect(MONTHS.get('mei')).toBe('May');
    expect(MONTHS.get('juni')).toBe('Jun');
    expect(MONTHS.get('juli')).toBe('Jul');
    expect(MONTHS.get('augustus')).toBe('Aug');
    expect(MONTHS.get('oktober')).toBe('Oct');
  });

  test('French month names (accent-normalized)', () => {
    expect(MONTHS.get('janvier')).toBe('Jan');
    expect(MONTHS.get('fevrier')).toBe('Feb');
    expect(MONTHS.get('mars')).toBe('Mar');
    expect(MONTHS.get('avril')).toBe('Apr');
    expect(MONTHS.get('mai')).toBe('May');
    expect(MONTHS.get('juin')).toBe('Jun');
    expect(MONTHS.get('juillet')).toBe('Jul');
    expect(MONTHS.get('aout')).toBe('Aug');
    expect(MONTHS.get('septembre')).toBe('Sep');
    expect(MONTHS.get('octobre')).toBe('Oct');
    expect(MONTHS.get('novembre')).toBe('Nov');
    expect(MONTHS.get('decembre')).toBe('Dec');
  });

  test('German month names (accent-normalized)', () => {
    expect(MONTHS.get('januar')).toBe('Jan');
    expect(MONTHS.get('marz')).toBe('Mar');
    expect(MONTHS.get('mai')).toBe('May');
    expect(MONTHS.get('juni')).toBe('Jun');
    expect(MONTHS.get('juli')).toBe('Jul');
    expect(MONTHS.get('oktober')).toBe('Oct');
    expect(MONTHS.get('dezember')).toBe('Dec');
  });

  test('Spanish month names', () => {
    expect(MONTHS.get('enero')).toBe('Jan');
    expect(MONTHS.get('febrero')).toBe('Feb');
    expect(MONTHS.get('marzo')).toBe('Mar');
    expect(MONTHS.get('abril')).toBe('Apr');
    expect(MONTHS.get('mayo')).toBe('May');
    expect(MONTHS.get('junio')).toBe('Jun');
    expect(MONTHS.get('julio')).toBe('Jul');
    expect(MONTHS.get('agosto')).toBe('Aug');
    expect(MONTHS.get('septiembre')).toBe('Sep');
    expect(MONTHS.get('octubre')).toBe('Oct');
    expect(MONTHS.get('noviembre')).toBe('Nov');
    expect(MONTHS.get('diciembre')).toBe('Dec');
  });

  test('Norwegian/Danish month names', () => {
    expect(MONTHS.get('januar')).toBe('Jan');
    expect(MONTHS.get('februar')).toBe('Feb');
    expect(MONTHS.get('mars')).toBe('Mar');
    expect(MONTHS.get('april')).toBe('Apr');
    expect(MONTHS.get('mai')).toBe('May');
    expect(MONTHS.get('juni')).toBe('Jun');
    expect(MONTHS.get('juli')).toBe('Jul');
    expect(MONTHS.get('august')).toBe('Aug');
    expect(MONTHS.get('september')).toBe('Sep');
    expect(MONTHS.get('oktober')).toBe('Oct');
    expect(MONTHS.get('november')).toBe('Nov');
    expect(MONTHS.get('desember')).toBe('Dec');
  });

  test('Portuguese month names', () => {
    expect(MONTHS.get('janeiro')).toBe('Jan');
    expect(MONTHS.get('fevereiro')).toBe('Feb');
    expect(MONTHS.get('marco')).toBe('Mar');
    expect(MONTHS.get('maio')).toBe('May');
    expect(MONTHS.get('junho')).toBe('Jun');
    expect(MONTHS.get('julho')).toBe('Jul');
    expect(MONTHS.get('agosto')).toBe('Aug');
    expect(MONTHS.get('setembro')).toBe('Sep');
    expect(MONTHS.get('outubro')).toBe('Oct');
    expect(MONTHS.get('novembro')).toBe('Nov');
    expect(MONTHS.get('dezembro')).toBe('Dec');
  });

  test('Italian month names', () => {
    expect(MONTHS.get('gennaio')).toBe('Jan');
    expect(MONTHS.get('febbraio')).toBe('Feb');
    expect(MONTHS.get('marzo')).toBe('Mar');
    expect(MONTHS.get('aprile')).toBe('Apr');
    expect(MONTHS.get('maggio')).toBe('May');
    expect(MONTHS.get('giugno')).toBe('Jun');
    expect(MONTHS.get('luglio')).toBe('Jul');
    expect(MONTHS.get('settembre')).toBe('Sep');
    expect(MONTHS.get('ottobre')).toBe('Oct');
    expect(MONTHS.get('dicembre')).toBe('Dec');
  });

  test('Polish month names', () => {
    expect(MONTHS.get('styczen')).toBe('Jan');
    expect(MONTHS.get('luty')).toBe('Feb');
    expect(MONTHS.get('marzec')).toBe('Mar');
    expect(MONTHS.get('kwiecien')).toBe('Apr');
    expect(MONTHS.get('maj')).toBe('May');
    expect(MONTHS.get('czerwiec')).toBe('Jun');
    expect(MONTHS.get('lipiec')).toBe('Jul');
    expect(MONTHS.get('sierpien')).toBe('Aug');
    expect(MONTHS.get('wrzesien')).toBe('Sep');
    expect(MONTHS.get('pazdziernik')).toBe('Oct');
    expect(MONTHS.get('listopad')).toBe('Nov');
    expect(MONTHS.get('grudzien')).toBe('Dec');
  });

  test('Russian transliterated month names', () => {
    expect(MONTHS.get('yanvar')).toBe('Jan');
    expect(MONTHS.get('fevral')).toBe('Feb');
    expect(MONTHS.get('mart')).toBe('Mar');
    expect(MONTHS.get('aprel')).toBe('Apr');
    expect(MONTHS.get('iyun')).toBe('Jun');
    expect(MONTHS.get('iyul')).toBe('Jul');
    expect(MONTHS.get('avgust')).toBe('Aug');
    expect(MONTHS.get('sentyabr')).toBe('Sep');
    expect(MONTHS.get('oktyabr')).toBe('Oct');
    expect(MONTHS.get('noyabr')).toBe('Nov');
    expect(MONTHS.get('dekabr')).toBe('Dec');
  });
});

describe('MONTH_NUM', () => {
  test('maps 3-letter abbreviations to month numbers', () => {
    expect(MONTH_NUM.get('Jan')).toBe(1);
    expect(MONTH_NUM.get('Feb')).toBe(2);
    expect(MONTH_NUM.get('Mar')).toBe(3);
    expect(MONTH_NUM.get('Apr')).toBe(4);
    expect(MONTH_NUM.get('May')).toBe(5);
    expect(MONTH_NUM.get('Jun')).toBe(6);
    expect(MONTH_NUM.get('Jul')).toBe(7);
    expect(MONTH_NUM.get('Aug')).toBe(8);
    expect(MONTH_NUM.get('Sep')).toBe(9);
    expect(MONTH_NUM.get('Oct')).toBe(10);
    expect(MONTH_NUM.get('Nov')).toBe(11);
    expect(MONTH_NUM.get('Dec')).toBe(12);
  });
});

describe('DAYS_IN_MONTH', () => {
  test('has 13 entries (index 0-12)', () => {
    expect(DAYS_IN_MONTH).toHaveLength(13);
  });

  test('Feb has 29 days (leap year treatment)', () => {
    expect(DAYS_IN_MONTH[2]).toBe(29);
  });

  test('known month lengths', () => {
    expect(DAYS_IN_MONTH[1]).toBe(31);
    expect(DAYS_IN_MONTH[4]).toBe(30);
    expect(DAYS_IN_MONTH[12]).toBe(31);
  });
});

describe('MONTH_DAY_OFFSETS', () => {
  test('has 13 entries', () => {
    expect(MONTH_DAY_OFFSETS).toHaveLength(13);
  });

  test('matches expected cumulative values', () => {
    expect(MONTH_DAY_OFFSETS).toEqual([0, 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]);
  });
});

describe('MODIFIERS', () => {
  test('standard GEDCOM modifiers', () => {
    expect(MODIFIERS.get('abt')).toBe('Abt');
    expect(MODIFIERS.get('bef')).toBe('Bef');
    expect(MODIFIERS.get('aft')).toBe('Aft');
    expect(MODIFIERS.get('cal')).toBe('Cal');
    expect(MODIFIERS.get('est')).toBe('Est');
  });

  test('synonym collapsing — circa/approx variants to Abt', () => {
    expect(MODIFIERS.get('circa')).toBe('Abt');
    expect(MODIFIERS.get('ca')).toBe('Abt');
    expect(MODIFIERS.get('c')).toBe('Abt');
    expect(MODIFIERS.get('cir')).toBe('Abt');
    expect(MODIFIERS.get('about')).toBe('Abt');
    expect(MODIFIERS.get('approx')).toBe('Abt');
    expect(MODIFIERS.get('approximately')).toBe('Abt');
  });

  test('synonym collapsing — Est variants', () => {
    expect(MODIFIERS.get('say')).toBe('Est');
    expect(MODIFIERS.get('probably')).toBe('Est');
    expect(MODIFIERS.get('maybe')).toBe('Est');
    expect(MODIFIERS.get('prob')).toBe('Est');
    expect(MODIFIERS.get('estimated')).toBe('Est');
    expect(MODIFIERS.get('estd')).toBe('Est');
    expect(MODIFIERS.get('int')).toBe('Est');
    expect(MODIFIERS.get('interpreted')).toBe('Est');
    expect(MODIFIERS.get('ansl')).toBe('Est');
    expect(MODIFIERS.get('anslat')).toBe('Est');
  });

  test('range modifiers', () => {
    expect(MODIFIERS.get('bet')).toBe('Bet');
    expect(MODIFIERS.get('between')).toBe('Bet');
    expect(MODIFIERS.get('btw')).toBe('Bet');
    expect(MODIFIERS.get('and')).toBe('and');
    expect(MODIFIERS.get('&')).toBe('and');
    expect(MODIFIERS.get('also')).toBe('and');
    expect(MODIFIERS.get('or')).toBe('or');
  });

  test('From and To preserved as distinct modifiers', () => {
    expect(MODIFIERS.get('from')).toBe('From');
    expect(MODIFIERS.get('frm')).toBe('From');
    expect(MODIFIERS.get('van')).toBe('From');
    expect(MODIFIERS.get('to')).toBe('To');
    expect(MODIFIERS.get('until')).toBe('To');
    expect(MODIFIERS.get('tot')).toBe('To');
  });

  test('symbol modifiers', () => {
    expect(MODIFIERS.get('<')).toBe('Bef');
    expect(MODIFIERS.get('>')).toBe('Aft');
  });

  test('non-English modifiers', () => {
    expect(MODIFIERS.get('voor')).toBe('Bef');
    expect(MODIFIERS.get('avant')).toBe('Bef');
    expect(MODIFIERS.get('na')).toBe('Aft');
    expect(MODIFIERS.get('ett')).toBe('Aft');
    expect(MODIFIERS.get('etter')).toBe('Aft');
    expect(MODIFIERS.get('vers')).toBe('Abt');
    expect(MODIFIERS.get('omstreeks')).toBe('Abt');
    expect(MODIFIERS.get('omstr')).toBe('Abt');
    expect(MODIFIERS.get('omkring')).toBe('Abt');
    expect(MODIFIERS.get('omk')).toBe('Abt');
  });

  test('Cal variants', () => {
    expect(MODIFIERS.get('calculated')).toBe('Cal');
    expect(MODIFIERS.get('calc')).toBe('Cal');
    expect(MODIFIERS.get('calcd')).toBe('Cal');
  });

  test('Bef variants', () => {
    expect(MODIFIERS.get('before')).toBe('Bef');
    expect(MODIFIERS.get('bfr')).toBe('Bef');
    expect(MODIFIERS.get('by')).toBe('Bef');
  });

  test('Aft variants', () => {
    expect(MODIFIERS.get('after')).toBe('Aft');
  });
});

describe('QUARTER_WORDS', () => {
  test('contains expected words', () => {
    expect(QUARTER_WORDS.has('quarter')).toBe(true);
    expect(QUARTER_WORDS.has('qtr')).toBe(true);
    expect(QUARTER_WORDS.has('qrt')).toBe(true);
    expect(QUARTER_WORDS.has('q')).toBe(true);
  });
});

describe('UNKNOWN_PHRASES', () => {
  test('contains expected phrases', () => {
    expect(UNKNOWN_PHRASES.has('unknown')).toBe(true);
    expect(UNKNOWN_PHRASES.has('date unknown')).toBe(true);
    expect(UNKNOWN_PHRASES.has('unk')).toBe(true);
    expect(UNKNOWN_PHRASES.has('unbekannt')).toBe(true);
    expect(UNKNOWN_PHRASES.has('onbekend')).toBe(true);
    expect(UNKNOWN_PHRASES.has('inconnue')).toBe(true);
  });
});

describe('SPECIAL_PHRASES', () => {
  test('maps infancy phrases', () => {
    expect(SPECIAL_PHRASES.get('in infancy')).toBe('(in infancy)');
    expect(SPECIAL_PHRASES.get('died in infancy')).toBe('(in infancy)');
    expect(SPECIAL_PHRASES.get('infant')).toBe('(in infancy)');
    expect(SPECIAL_PHRASES.get('infancy')).toBe('(in infancy)');
  });

  test('maps young/stillborn phrases', () => {
    expect(SPECIAL_PHRASES.get('young')).toBe('(young)');
    expect(SPECIAL_PHRASES.get('died young')).toBe('(young)');
    expect(SPECIAL_PHRASES.get('stillborn')).toBe('(stillborn)');
  });
});

describe('ORDINAL_SUFFIXES', () => {
  test('contains st, nd, rd, th', () => {
    expect(ORDINAL_SUFFIXES.has('st')).toBe(true);
    expect(ORDINAL_SUFFIXES.has('nd')).toBe(true);
    expect(ORDINAL_SUFFIXES.has('rd')).toBe(true);
    expect(ORDINAL_SUFFIXES.has('th')).toBe(true);
  });
});

describe('BC_WORDS', () => {
  test('contains bc and bce', () => {
    expect(BC_WORDS.has('bc')).toBe(true);
    expect(BC_WORDS.has('bce')).toBe(true);
  });
});

describe('AD_WORDS', () => {
  test('contains ad, ac, ce', () => {
    expect(AD_WORDS.has('ad')).toBe(true);
    expect(AD_WORDS.has('ac')).toBe(true);
    expect(AD_WORDS.has('ce')).toBe(true);
  });
});

describe('WFT_PATTERN', () => {
  test('matches wft case-insensitively', () => {
    expect(WFT_PATTERN.test('WFT')).toBe(true);
    expect(WFT_PATTERN.test('wft')).toBe(true);
    expect(WFT_PATTERN.test('Wft')).toBe(true);
  });
});

describe('stdDate', () => {
  describe('basic dates', () => {
    test('day month year', () => { expect(stdDate('28 SEP 1974')).toBe('28 Sep 1974'); });
    test('month day, year', () => { expect(stdDate('Feb 3, 1904')).toBe('3 Feb 1904'); });
    test('month year', () => { expect(stdDate('Sep 1923')).toBe('Sep 1923'); });
    test('year month', () => { expect(stdDate('1923 Feb')).toBe('Feb 1923'); });
    test('year only', () => { expect(stdDate('1875')).toBe('1875'); });
    test('full month name', () => { expect(stdDate('23 October 1856')).toBe('23 Oct 1856'); });
    test('APR 10 1580', () => { expect(stdDate('APR 10 1580')).toBe('10 Apr 1580'); });
    test('ordinals', () => {
      expect(stdDate('Jan 1st, 1901')).toBe('1 Jan 1901');
      expect(stdDate('February 2nd, 1902')).toBe('2 Feb 1902');
      expect(stdDate('3rd March 1903')).toBe('3 Mar 1903');
    });
  });

  describe('non-English months', () => {
    test('French', () => { expect(stdDate('15 février 1850')).toBe('15 Feb 1850'); });
    test('German', () => { expect(stdDate('15 März 1850')).toBe('15 Mar 1850'); });
    test('Polish', () => { expect(stdDate('15 styczen 1900')).toBe('15 Jan 1900'); });
    test('Russian', () => { expect(stdDate('15 yanvar 1900')).toBe('15 Jan 1900'); });
    test('Italian', () => { expect(stdDate('15 gennaio 1900')).toBe('15 Jan 1900'); });
  });

  describe('modifiers', () => {
    test('Abt', () => {
      expect(stdDate('ABT 28 SEP 1974')).toBe('Abt 28 Sep 1974');
      expect(stdDate('about 1850')).toBe('Abt 1850');
      expect(stdDate('approx Feb 1854')).toBe('Abt Feb 1854');
      expect(stdDate('omk 1900')).toBe('Abt 1900');
    });
    test('Abt from circa', () => {
      expect(stdDate('c1978')).toBe('Abt 1978');
      expect(stdDate('ca1978')).toBe('Abt 1978');
      expect(stdDate('circa 1900')).toBe('Abt 1900');
    });
    test('Est', () => {
      expect(stdDate('say 1750')).toBe('Est 1750');
      expect(stdDate('ansl 1525')).toBe('Est 1525');
    });
    test('Cal', () => { expect(stdDate('CAL 15 Jan 1900')).toBe('Cal 15 Jan 1900'); });
    test('Bef', () => {
      expect(stdDate('BEF OCT 1855')).toBe('Bef Oct 1855');
      expect(stdDate('TO 1834')).toBe('Bef 1834');
    });
    test('Aft', () => {
      expect(stdDate('Aft Oct 1855')).toBe('Aft Oct 1855');
      expect(stdDate('FROM 1850')).toBe('Aft 1850');
    });
    test('symbols', () => {
      expect(stdDate('<1850')).toBe('Bef 1850');
      expect(stdDate('>1850')).toBe('Aft 1850');
    });
    test('double modifiers collapse', () => {
      expect(stdDate('BEF ABT 1580')).toBe('Bef 1580');
    });
    test('Int → Est with parenthetical', () => {
      expect(stdDate('Int 29 Sep 1874 (second-last day of month)')).toBe('Est 29 Sep 1874 (second-last day of month)');
    });
  });

  describe('special cases', () => {
    test('unknown', () => {
      expect(stdDate('UNKNOWN')).toBe('');
      expect(stdDate('date unknown')).toBe('');
      expect(stdDate('')).toBe('');
    });
    test('special phrases', () => {
      expect(stdDate('in infancy')).toBe('(in infancy)');
      expect(stdDate('INFANT')).toBe('(in infancy)');
      expect(stdDate('died young')).toBe('(young)');
    });
    test('parenthetical', () => {
      expect(stdDate('BET 28 SEP 1974 AND 5 OCT 1978 (SOME TEXT)')).toBe('Bet 28 Sep 1974 and 5 Oct 1978 (SOME TEXT)');
      expect(stdDate('(at age 16)')).toBe('(at age 16)');
    });
    test('question mark', () => {
      expect(stdDate('aft 1823?')).toBe('Aft 1823 (?)');
    });
    test('BC', () => {
      expect(stdDate('15 Mar 44 BC')).toBe('15 Mar 44 BC');
    });
    test('AD discarded', () => {
      expect(stdDate('AD 1066')).toBe('1066');
    });
    test('WFT rejected', () => { expect(stdDate('WFT Est 1147-1174')).toBe(''); });
    test('YYYYMMDD', () => { expect(stdDate('19000914')).toBe('14 Sep 1900'); });
  });

  describe('ranges', () => {
    test('Bet/and', () => {
      expect(stdDate('BET 28 SEP 1974 AND 5 OCT 1978')).toBe('Bet 28 Sep 1974 and 5 Oct 1978');
      expect(stdDate('BET 1823 AND 17 OCT 1836')).toBe('Bet 1823 and 17 Oct 1836');
      expect(stdDate('BTW 5 Feb 1789 & Mar 1790')).toBe('Bet 5 Feb 1789 and Mar 1790');
    });
    test('From/to → Bet/and', () => {
      expect(stdDate('FROM 1865 - 1900')).toBe('Bet 1865 and 1900');
    });
    test('standalone From → Aft', () => {
      expect(stdDate('FROM 1850')).toBe('Aft 1850');
    });
    test('dash ranges', () => {
      expect(stdDate('1875-1900')).toBe('Bet 1875 and 1900');
      expect(stdDate('Apr 1756-May 1757')).toBe('Bet Apr 1756 and May 1757');
    });
    test('abbreviated year ranges', () => {
      expect(stdDate('1875-80')).toBe('Bet 1875 and 1880');
      expect(stdDate('1920-21')).toBe('Bet 1920 and 1921');
    });
    test('partial ranges fill gaps', () => {
      expect(stdDate('BET 10 OCT AND 15 NOV 1823')).toBe('Bet 10 Oct 1823 and 15 Nov 1823');
      expect(stdDate('BET 10 AND 15 OCT 1943')).toBe('Bet 10 Oct 1943 and 15 Oct 1943');
      expect(stdDate('BET OCT AND NOV 1855')).toBe('Bet Oct 1855 and Nov 1855');
    });
  });

  describe('format conversions', () => {
    test('yyyy-mm-dd', () => { expect(stdDate('1900/09/14')).toBe('14 Sep 1900'); });
    test('mm-dd-yyyy unambiguous', () => {
      expect(stdDate('03/25/1967')).toBe('25 Mar 1967');
      expect(stdDate('14-09-1900')).toBe('14 Sep 1900');
    });
    test('ambiguous → or', () => {
      expect(stdDate('3/9/1978')).toBe('9 Mar 1978 or 3 Sep 1978');
    });
    test('yyyy-mm-dd in ranges', () => {
      expect(stdDate('From 1900/09/14 to 1902/03/08')).toBe('Bet 14 Sep 1900 and 8 Mar 1902');
    });
  });

  describe('double-dating (split years)', () => {
    test('basic', () => {
      expect(stdDate('28 Feb 1623/24')).toBe('28 Feb 1623/24');
      expect(stdDate('28 Feb 1623/4')).toBe('28 Feb 1623/24');
      expect(stdDate('Feb 1623/24')).toBe('Feb 1623/24');
      expect(stdDate('1623/4')).toBe('1623/24');
    });
    test('century rollover', () => {
      expect(stdDate('5 Feb 1699/1700')).toBe('5 Feb 1699/00');
      expect(stdDate('5 Feb 1699/00')).toBe('5 Feb 1699/00');
      expect(stdDate('5 feb 1700/1')).toBe('5 Feb 1700/01');
      expect(stdDate('5 Feb 1689/90')).toBe('5 Feb 1689/90');
    });
    test('with modifiers', () => {
      expect(stdDate('Aft 28 Feb 1623/24')).toBe('Aft 28 Feb 1623/24');
      expect(stdDate('Bef 28 Feb 1623/24')).toBe('Bef 28 Feb 1623/24');
    });
    test('in ranges', () => {
      expect(stdDate('Bet 1 Jan 1632/33 and 5 Feb 1635/36')).toBe('Bet 1 Jan 1632/33 and 5 Feb 1635/36');
    });
    test('invalid after 1752', () => {
      const result = stdDate('1756/57');
      expect(result).not.toContain('/');
    });
  });

  describe('quarters', () => {
    test('Q notation', () => {
      expect(stdDate('Q1 1850')).toBe('Q1 1850');
      expect(stdDate('Q2 1850')).toBe('Q2 1850');
    });
    test('quarter keywords', () => {
      expect(stdDate('1st quarter 1850')).toBe('Q1 1850');
      expect(stdDate('2nd qtr 1850')).toBe('Q2 1850');
    });
  });

  describe('standalone modifiers return empty', () => {
    test('from alone', () => { expect(stdDate('from')).toBe(''); });
    test('bet alone', () => { expect(stdDate('bet')).toBe(''); });
    test('bef alone', () => { expect(stdDate('bef')).toBe(''); });
  });
});
