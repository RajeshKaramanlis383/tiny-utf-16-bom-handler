/**
 * tiny-utf-16-bom-handler — detect, add, and remove UTF-16 byte order marks
 * and convert between UTF-16LE and UTF-16BE.
 *
 * Interpretation chosen: this library operates on raw bytes. A "UTF-16 string"
 * is a Uint8Array whose byte-pairs encode UTF-16 code units. It does not decode
 * to or from JS strings, because that would require a full UTF-16 codec and the
 * the reader would be better served by TextDecoder for that job. This keeps the
 * library tiny and focused on the BOM and endianness problem.
 */

/** Big-endian BOM as bytes: 0xFE 0xFF. */
export const BOM_BE = new Uint8Array([0xfe, 0xff]);

/** Little-endian BOM as bytes: 0xFF 0xFE. */
export const BOM_LE = new Uint8Array([0xff, 0xfe]);

/** Sentinel: no BOM present, endianness cannot be inferred from the buffer. */
export const BOM_UNKNOWN = 0;

/** Big-endian marker returned by detectBOM and convertEndian. */
export const ENDIANNESS_BIG = 1;

/** Little-endian marker returned by detectBOM and convertEndian. */
export const ENDIANNESS_LITTLE = 2;

/**
 * Detect a UTF-16 BOM at the start of `bytes`.
 *
 * Returns one of:
 *   ENDIANNESS_BIG    — starts with 0xFE 0xFF (UTF-16BE)
 *   ENDIANNESS_LITTLE — starts with 0xFF 0xFE (UTF-16LE)
 *   BOM_UNKNOWN       — no BOM, or buffer too short to contain one
 *
 * Why return an enum rather than a boolean: callers that want to strip the
 * BOM also need to know the endianness to interpret the remaining bytes
 * correctly, so returning both pieces of information in one call avoids
 * re-parsing the same two bytes twice.
 */
export function detectBOM(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('detectBOM expects a Uint8Array');
  }
  if (bytes.length < 2) {
    return BOM_UNKNOWN;
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return ENDIANNESS_BIG;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return ENDIANNESS_LITTLE;
  }
  return BOM_UNKNOWN;
}

/**
 * Prefix `bytes` with the BOM matching `endianness`.
 *
 * `endianness` must be ENDIANNESS_BIG or ENDIANNESS_LITTLE.
 * Returns a new Uint8Array; the input is never mutated.
 *
 * If `bytes` already starts with the requested BOM it is returned unchanged
 * (as a copy), because re-adding a BOM would produce an empty code unit at
 * the start of the decoded text — a silent data-corruption bug.
 */
export function addBOM(bytes, endianness) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('addBOM expects a Uint8Array');
  }
  if (endianness !== ENDIANNESS_BIG && endianness !== ENDIANNESS_LITTLE) {
    throw new TypeError('addBOM: endianness must be ENDIANNESS_BIG or ENDIANNESS_LITTLE');
  }
  const bom = endianness === ENDIANNESS_BIG ? BOM_BE : BOM_LE;
  const existing = detectBOM(bytes);
  if (existing === (endianness === ENDIANNESS_BIG ? ENDIANNESS_BIG : ENDIANNESS_LITTLE)) {
    return Uint8Array.from(bytes);
  }
  const out = new Uint8Array(bom.length + bytes.length);
  out.set(bom, 0);
  out.set(bytes, bom.length);
  return out;
}

/**
 * Strip a leading BOM from `bytes` if present.
 *
 * Returns a new Uint8Array with the first two bytes removed when a BOM is
 * detected; otherwise returns a copy of the input unchanged. The input is
 * never mutated.
 */
export function removeBOM(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('removeBOM expects a Uint8Array');
  }
  if (detectBOM(bytes) === BOM_UNKNOWN) {
    return Uint8Array.from(bytes);
  }
  return bytes.subarray(2);
}

/**
 * Convert `bytes` from one endianness to the other.
 *
 * `to` must be ENDIANNESS_BIG or ENDIANNESS_LITTLE.
 * If `bytes` carries a BOM it is preserved (and itself swapped) so that the
 * returned buffer still self-describes its endianness.
 *
 * An odd-length buffer (after a BOM, if any) is an error: UTF-16 code units
 * are two bytes, so a trailing lone byte is malformed. Rather than silently
 * dropping it, we throw, because a silent drop would hide a real bug in the
 * caller's data pipeline.
 */
export function convertEndian(bytes, to) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('convertEndian expects a Uint8Array');
  }
  if (to !== ENDIANNESS_BIG && to !== ENDIANNESS_LITTLE) {
    throw new TypeError('convertEndian: to must be ENDIANNESS_BIG or ENDIANNESS_LITTLE');
  }
  const existing = detectBOM(bytes);
  const hasBOM = existing !== BOM_UNKNOWN;
  const body = hasBOM ? bytes.subarray(2) : bytes;
  if (body.length % 2 !== 0) {
    throw new Error('convertEndian: byte length after any BOM is odd; malformed UTF-16');
  }
  const result = new Uint8Array(bytes.length);
  if (hasBOM) {
    // Swap the BOM bytes too so the output still self-describes endianness.
    result[0] = bytes[1];
    result[1] = bytes[0];
  }
  for (let i = 0; i < body.length; i += 2) {
    result[hasBOM ? 2 + i : i] = body[i + 1];
    result[hasBOM ? 2 + i + 1 : i + 1] = body[i];
  }
  return result;
}
