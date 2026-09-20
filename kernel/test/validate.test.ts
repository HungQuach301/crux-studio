import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, assertValid, unsupportedKeywords } from '../src/validate.ts';

test('bắt thiếu trường bắt buộc', () => {
  const result = validate({}, { type: 'object', required: ['a'] });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.path, '$.a');
});

test('additionalProperties: false chặn trường lạ', () => {
  const schema = { type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } };
  assert.equal(validate({ a: 'x' }, schema).valid, true);
  assert.equal(validate({ a: 'x', b: 1 }, schema).valid, false);
});

test('phân biệt integer với number', () => {
  assert.equal(validate(1.5, { type: 'integer' }).valid, false);
  assert.equal(validate(1.5, { type: 'number' }).valid, true);
  assert.equal(validate(2, { type: 'number' }).valid, true);
});

test('const khoá được một giá trị — đây là cách I5 được thực thi', () => {
  const schema = { type: 'string', const: 'private' };
  assert.equal(validate('private', schema).valid, true);
  assert.equal(validate('public', schema).valid, false);
});

test('kiểu liên hợp và null', () => {
  const schema = { type: ['string', 'null'] };
  assert.equal(validate(null, schema).valid, true);
  assert.equal(validate('x', schema).valid, true);
  assert.equal(validate(3, schema).valid, false);
});

test('ràng buộc mảng và chuỗi', () => {
  assert.equal(validate([], { type: 'array', minItems: 1 }).valid, false);
  assert.equal(validate('ab', { type: 'string', minLength: 3 }).valid, false);
  assert.equal(validate('2026-09-20T00:00:00.000Z', { type: 'string', format: 'date-time' }).valid, true);
  assert.equal(validate('20/09/2026', { type: 'string', format: 'date-time' }).valid, false);
});

test('$ref nội bộ', () => {
  const schema = {
    definitions: { id: { type: 'string', minLength: 2 } },
    type: 'object',
    properties: { a: { $ref: '#/definitions/id' } },
  };
  assert.equal(validate({ a: 'xy' }, schema).valid, true);
  assert.equal(validate({ a: 'x' }, schema).valid, false);
});

test('assertValid ném lỗi có đường dẫn', () => {
  assert.throws(
    () => assertValid({}, { type: 'object', required: ['a'] }, 'Thử'),
    /Thử không hợp lệ[\s\S]*\$\.a/,
  );
});

test('phát hiện từ khoá chưa hỗ trợ — không để ràng buộc nào im lặng bị bỏ qua', () => {
  assert.deepEqual(unsupportedKeywords({ type: 'object', oneOf: [] }), ['oneOf']);
  assert.deepEqual(unsupportedKeywords({ type: 'object', properties: { a: { allOf: [] } } }), ['allOf']);
  assert.deepEqual(unsupportedKeywords({ type: 'string', minLength: 1 }), []);
});
