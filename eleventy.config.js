import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import QRCode from 'qrcode';

import { loadConfigFile } from './schema/config.schema.js';

const CONFIG = new URL('config.yaml', import.meta.url);

/**
 * A printable QR code for the page itself, generated from seo.base_url so it
 * can never point at a stale address: change the address, rebuild, and the
 * code follows. Written straight to the output directory because Eleventy
 * templates emit text, and one of these two files is binary.
 *
 * Skipped when base_url is unset — a QR code for an address we do not know
 * would be worse than none.
 */
async function writeQrCodes(outputDir) {
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? CONFIG);
  const url = config.seo.base_url;
  if (!url) return;

  await mkdir(outputDir, { recursive: true });
  const options = { margin: 2, errorCorrectionLevel: 'M' };

  const svg = await QRCode.toString(url, { ...options, type: 'svg' });
  await writeFile(join(outputDir, 'qrcode.svg'), svg);

  const png = await QRCode.toBuffer(url, { ...options, type: 'png', width: 1024 });
  await writeFile(join(outputDir, 'qrcode.png'), png);
}

export default function (eleventyConfig) {
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    await writeQrCodes(dir.output);
  });

  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  // Only used for a custom domain; harmless when the file is absent.
  eleventyConfig.addPassthroughCopy('src/CNAME');
  eleventyConfig.addPassthroughCopy('src/theme.js');

  return {
    dir: {
      input: 'src',
      output: '_site',
      data: '_data',
      includes: '_includes',
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
}
