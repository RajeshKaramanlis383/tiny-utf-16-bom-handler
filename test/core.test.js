import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOM_BE,
  BOM_LE,
  BOM_UNKNOWN,
  ENDIANNESS_BIG,
  ENDIANNESS_LITTLE,
  detectBOM,
  addBOM,
  removeBOM,
  convertEndian,
} from '../src/index.js';

const beBom = new Uint8Array([0xfe, 0xff]);
const leBom = new Uint8Array([0xff, 0xfe]);
// "Hi" in UTF-16BE: 0x00 0x48 0x00 0x69
const hiBE = new Uint8Array([0x00, 0x48, 0x00, 0x69]);
// "Hi" in UTF-16LE: 0x48 0x00 0x69 0x00
const hiLE = new Uint8Array([0x48, 0x00, 0x69, 0x00]);

test('detectBOM recognises big-endian BOM', () => {
  assert.equal(detectBOM(beBom), ENDIANNESS_BIG);
});

test('detectBOM recognises little-endian BOM', () => {
  assert.equal(detectBOM(leBom), ENDIANNESS_LITTLE);
});

test('detectBOM returns BOM_UNKNOWN when no BOM is present', () => {
  assert.equal(detectBOM(hiBE), BOM_UNKNOWN);
  assert.equal(detectBOM(hiLE), BOM_UNKNOWN);
});

test('detectBOM returns BOM_UNKNOWN for buffers shorter than 2 bytes', () => {
  assert.equal(detectBOM(new Uint8Array([])), BOM_UNKNOWN);
  assert.equal(detectBOM(new Uint8Array([0xfe])), BOM_UNKNOWN);
});

test('detectBOM ignores bytes that merely start with a BOM-like first byte', () => {
  assert.equal(detectBOM(new Uint8Array([0xfe, 0x00])), BOM_UNKNOWN);
  assert.equal(detectBOM(new Uint8Array([0xff, 0x00])), BOM_UNKNOWN);
});

test('detectBOM throws on non-Uint8Array input', () => {
  assert.throws(() => detectBOM([0xfe, 0xff]), TypeError);
});

test('addBOM prepends a big-endian BOM', () => {
  const out = addBOM(hiBE, ENDIANNESS_BIG);
  assert.deepEqual(Array.from(out), [0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
  assert.equal(detectBOM(out), ENDIANNESS_BIG);
});

test('addBOM prepends a little-endian BOM', () => {
  const out = addBOM(hiLE, ENDIANNESS_LITTLE);
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
  assert.equal(detectBOM(out), ENDIANNESS_LITTLE);
});

test('addBOM does not double-add a matching BOM', () => {
  const out = addBOM(beBom, ENDIANNESS_BIG);
  assert.deepEqual(Array.from(out), [0xfe, 0xff]);
});

test('addBOM does not mutate the input', () => {
  const input = new Uint8Array(hiBE);
  addBOM(input, ENDIANNESS_BIG);
  assert.deepEqual(Array.from(input), [0x00, 0x48, 0x00, 0x69]);
});

test('addBOM rejects an invalid endianness value', () => {
  assert.throws(() => addBOM(hiBE, BOM_UNKNOWN), TypeError);
});

test('removeBOM strips a leading big-endian BOM', () => {
  const out = removeBOM(new Uint8Array([0xfe, 0xff, 0x00, 0x48]));
  assert.deepEqual(Array.from(out), [0x00, 0x48]);
});

test('removeBOM strips a leading little-endian BOM', () => {
  const out = removeBOM(new Uint8Array([0xff, 0xfe, 0x48, 0x00]));
  assert.deepEqual(Array.from(out), [0x48, 0x00]);
});

test('removeBOM leaves a BOM-less buffer unchanged', () => {
  const out = removeBOM(hiBE);
  assert.deepEqual(Array.from(out), [0x00, 0x48, 0x00, 0x69]);
});

test('removeBOM does not mutate the input', () => {
  const input = new Uint8Array([0xfe, 0xff, 0x00, 0x48]);
  removeBOM(input);
  assert.deepEqual(Array.from(input), [0xfe, 0xff, 0x00, 0x48]);
});

test('convertEndian swaps byte pairs and preserves the BOM', () => {
  const withBE = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
  const out = convertEndian(withBE, ENDIANNESS_LITTLE);
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
  assert.equal(detectBOM(out), ENDIANNESS_LITTLE);
});

test('convertEndian round-trips back to the original bytes', () => {
  const original = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0xff, 0x20]);
  const swapped = convertEndian(original, ENDIANNESS_LITTLE);
  const back = convertEndian(swapped, ENDIANNESS_BIG);
  assert.deepEqual(Array.from(back), Array.from(original));
});

test('convertEndian swaps a BOM-less buffer', () => {
  const out = convertEndian(hiBE, ENDIANNESS_LITTLE);
  assert.deepEqual(Array.from(out), [0x48, 0x00, 0x69, 0x00]);
});

test('convertEndian throws on an odd-length body after BOM', () => {
  const bad = new Uint8Array([0xfe, 0xff, 0x00]);
  assert.throws(() => convertEndian(bad, ENDIANNESS_LITTLE), /odd/);
});

test('convertEndian throws on an odd-length BOM-less buffer', () => {
  assert.throws(() => convertEndian(new Uint8Array([0x00, 0x48, 0x69]), ENDIANNESS_LITTLE), /odd/);
});

test('convertEndian rejects an invalid target endianness', () => {
  assert.throws(() => convertEndian(hiBE, BOM_UNKNOWN), TypeError);
});
