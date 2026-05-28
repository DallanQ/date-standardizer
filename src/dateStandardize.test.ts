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
