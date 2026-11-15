import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_HORIZON, HORIZONS, MAX_AIR_HORIZON, MAX_HORIZON, parseHorizon } from './horizon.ts'

test('parseHorizon: missing or empty gives the default', () => {
  assert.equal(parseHorizon(undefined), DEFAULT_HORIZON)
  assert.equal(parseHorizon(''), DEFAULT_HORIZON)
  assert.equal(DEFAULT_HORIZON, 3)
})

test('parseHorizon: accepts whole numbers 1..MAX_HORIZON, as strings or numbers', () => {
  for (const h of HORIZONS) assert.equal(parseHorizon(String(h)), h)
  assert.equal(parseHorizon('1'), 1)
  assert.equal(parseHorizon('14'), 14)
  assert.equal(parseHorizon(5), 5)
  assert.equal(MAX_HORIZON, 14)
  assert.ok(MAX_AIR_HORIZON < MAX_HORIZON)
})

test('parseHorizon: rejects out-of-range, fractional and non-numeric values', () => {
  for (const bad of ['0', '15', '2.5', 'abc', ' ', '-3', 0, 15, 2.5, ['3', '7']]) {
    assert.throws(() => parseHorizon(bad), /days must be a whole number from 1 to 14/, `should reject ${JSON.stringify(bad)}`)
  }
})
