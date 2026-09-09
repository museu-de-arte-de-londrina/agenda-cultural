import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSafeUrl, parseImageSource, ALLOWED_URL_PROTOCOLS } from '../schema/config.schema.js';
import { contrastRatio, bestContrast } from '../lib/color.js';

const DANGEROUS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)  ',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'http://example.com',
  'ftp://example.com/x',
  '//example.com/x',
  'not a url',
  '',
  '   ',
];

test('parseSafeUrl rejeita esquemas fora da allowlist', () => {
  for (const value of DANGEROUS) {
    assert.equal(parseSafeUrl(value), null, `deveria rejeitar: ${JSON.stringify(value)}`);
  }
});

test('parseSafeUrl rejeita valores que não são texto', () => {
  for (const value of [null, undefined, 42, {}, ['https://example.com']]) {
    assert.equal(parseSafeUrl(value), null);
  }
});

test('parseSafeUrl aceita https, mailto e tel', () => {
  assert.equal(parseSafeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(parseSafeUrl('mailto:ada@example.com'), 'mailto:ada@example.com');
  assert.equal(parseSafeUrl('tel:+5543999999999'), 'tel:+5543999999999');
});

test('a allowlist tem exatamente três esquemas', () => {
  assert.deepEqual([...ALLOWED_URL_PROTOCOLS], ['https:', 'mailto:', 'tel:']);
});

test('parseImageSource aceita caminho relativo e https, e nada mais', () => {
  assert.equal(parseImageSource('assets/avatar.svg'), 'assets/avatar.svg');
  assert.equal(parseImageSource('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');

  assert.equal(parseImageSource('//evil.example.com/a.png'), null, 'protocol-relative');
  assert.equal(parseImageSource('http://example.com/a.png'), null, 'http puro');
  assert.equal(parseImageSource('javascript:alert(1)'), null);
  assert.equal(parseImageSource('data:image/svg+xml,<svg onload=alert(1)>'), null);
  assert.equal(parseImageSource('..\\..\\windows\\system32'), null, 'barra invertida');
});

test('contraste: os fundos escolhidos para o accent passam em AA', () => {
  assert.equal(Math.round(contrastRatio('#ffffff', '#000000')), 21);
  for (const accent of ['#2563eb', '#fde047', '#000000', '#ffffff', '#7c3aed']) {
    const fg = bestContrast(accent, ['#ffffff', '#0b1120']);
    assert.ok(contrastRatio(accent, fg) >= 4.5, `${accent} + ${fg} ficou abaixo de AA`);
  }
});
