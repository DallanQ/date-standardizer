# date-standardizer

Genealogical date standardizer. Converts free-form date strings into a canonical
`D Mon YYYY` format, and provides helpers for analyzing the standardized output.

Handles the messy variety of dates found in genealogical data (GEDCOM imports,
user entry, historical records): multiple languages, circa/about/estimated
qualifiers, before/after bounds, ranges, quarters, split (double-dated) years,
BC/BCE, and more.

## Features

- **Single dates** → `D Mon YYYY` (e.g. `"28 SEP 1974"` → `"28 Sep 1974"`,
  `"February 3, 1904"` → `"3 Feb 1904"`)
- **Multilingual month names** — English, Dutch, French, German, Spanish,
  Norwegian/Danish, Portuguese, Italian, Polish, and transliterated Russian,
  with accent normalization (`"février"` → `Feb`)
- **Qualifiers** — `circa`/`ca`/`approx`/`vers` → `Abt`, plus `Cal`
  (calculated), `Est` (estimated), `Bef` (before), `Aft` (after)
- **Ranges** — `Bet X and Y`; `From X to Y` collapses to `Bet X and Y`;
  standalone `From X` → `Aft X`, `To X` → `Bef X`; abbreviated `1875-80` →
  `Bet 1875 and 1880`
- **Special cases** — quarters (`Q1 1850`, `3rd quarter 1923`), split years for
  the Julian/Gregorian transition (`28 Feb 1623/24`), BC/BCE, ambiguous numeric
  dates (`3/9/1978` → `9 Mar 1978 or 3 Sep 1978`), and `YYYYMMDD` (`19000914` →
  `14 Sep 1900`)
- **Special phrases** — `(in infancy)`, `(young)`, `(stillborn)`

## Usage

```ts
import { stdDate } from './src/dateStandardize';
import {
  earliestYear,
  latestYear,
  minDaysDiff,
  maxDaysDiff,
} from './src/dateHelpers';

stdDate('February 3, 1904');   // "3 Feb 1904"
stdDate('circa 1850');         // "Abt 1850"
stdDate('from 1875 to 1880');  // "Bet 1875 and 1880"

// Helpers operate on standardized output, not raw strings.
// Modifiers apply fudge factors (Abt ±1yr, Est ±10yrs, Bef/Aft ±10yrs).
earliestYear('Abt 1850');                // 1849
latestYear('Est 1850');                  // 1860
minDaysDiff('1 Jan 1850', '5 Jan 1850'); // 4
maxDaysDiff('1 Jan 1850', '5 Jan 1850'); // 4
```

## API

| Function | Description |
| --- | --- |
| `stdDate(raw: string): string` | Standardize a free-form date string. |
| `earliestYear(std: string): number \| null` | Earliest plausible year for a standardized date. |
| `latestYear(std: string): number \| null` | Latest plausible year for a standardized date. |
| `minDaysDiff(std1, std2): number \| null` | Minimum days between two standardized dates. |
| `maxDaysDiff(std1, std2): number \| null` | Maximum days between two standardized dates. |

## Development

```bash
npm install
npm test          # run the vitest suite (210+ cases)
npm run test:watch
npm run lint      # eslint
npm run typecheck # tsc --noEmit
```

## License

ISC
