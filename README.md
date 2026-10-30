# tiny-utf-16-bom-handler

Detects, adds, and removes UTF-16 byte order marks and converts between UTF-16LE and UTF-16BE.

```js
import {
  detectBOM,
  addBOM,
  removeBOM,
  convertEndian,
  ENDIANNESS_BIG,
  ENDIANNESS_LITTLE,
} from 'tiny-utf-16-bom-handler';

const data = new Uint8Array([0x00, 0x48, 0x00, 0x69]); // "Hi" in UTF-16BE, no BOM
const withBom = addBOM(data, ENDIANNESS_BIG);
// withBom: [0xFE, 0xFF, 0x00, 0x48, 0x00, 0x69]

const endianness = detectBOM(withBom); // ENDIANNESS_BIG
const stripped = removeBOM(withBom);   // [0x00, 0x48, 0x00, 0x69]

const asLE = convertEndian(withBom, ENDIANNESS_LITTLE);
// asLE: [0xFF, 0xFE, 0x48, 0x00, 0x69, 0x00]
```

## Why this exists

Working with UTF-16 files means managing a two-byte BOM that tells readers which way each
byte pair is ordered. Doing this by hand is fiddly: the BOM bytes themselves swap when you
convert endianness, re-adding a BOM that is already there inserts a spurious empty code unit,
and an odd byte count after the BOM is a sign of a truncated read, not something to silently
truncate further. This library handles those three things and nothing else.

The deliberate trade-off: it operates on raw `Uint8Array` bytes only. It does not decode to
or from JS strings. That would pull in a full UTF-16 codec, at which point `TextDecoder` is
already the right tool. By staying at the byte level the library stays tiny and its behaviour
is easy to verify.

## The edge you will hit

If your buffer has an odd number of bytes after any BOM, `convertEndian` throws rather than
dropping the trailing byte. A lone trailing byte in UTF-16 is malformed data — usually a
truncated read from a stream — and silently dropping it would mask the real bug. Catch the
error and fix your upstream.

## Exports

- `BOM_BE`, `BOM_LE` — the two BOM byte sequences as `Uint8Array`.
- `ENDIANNESS_BIG` (`1`), `ENDIANNESS_LITTLE` (`2`), `BOM_UNKNOWN` (`0`) — markers returned by `detectBOM`.
- `detectBOM(bytes)` — returns one of the three markers above.
- `addBOM(bytes, endianness)` — returns a new `Uint8Array` with the requested BOM prepended; a matching existing BOM is not doubled.
- `removeBOM(bytes)` — returns a new `Uint8Array` with any leading BOM stripped.
- `convertEndian(bytes, to)` — returns a new `Uint8Array` with each byte pair swapped; a leading BOM is preserved and itself swapped.

All functions take a `Uint8Array` and return a fresh `Uint8Array` (or throw). Inputs are never mutated.
