import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import QRCode from 'qrcode';

import { buildCalendar } from './lib/calendar.js';
import site from './src/_data/site.js';

/**
 * A printable QR code for the page itself, generated from seo.base_url so it
 * can never point at a stale address: change the address, rebuild, and the
 * code follows. Written straight to the output directory because Eleventy
 * templates emit text, and one of these two files is binary.
 *
 * Skipped when base_url is unset, because a QR code for an address we do not
 * know would be worse than none.
 */
async function writeQrCodes(outputDir, config) {
  const url = config.seo.base_url;
  if (!url) return;

  await mkdir(outputDir, { recursive: true });
  const options = { margin: 2, errorCorrectionLevel: 'M' };

  const svg = await QRCode.toString(url, { ...options, type: 'svg' });
  await writeFile(join(outputDir, 'qrcode.svg'), svg);

  const png = await QRCode.toBuffer(url, { ...options, type: 'png', width: 1024 });
  await writeFile(join(outputDir, 'qrcode.png'), png);
}

/**
 * Calendar files: one per event, so a visitor can save the thing they are
 * looking at, plus a whole-agenda feed that can be subscribed to.
 *
 * Written here rather than as templates because they share the agenda the
 * page already built, and because the per-event files are one output per
 * item rather than one per page.
 */
async function writeCalendars(outputDir, config) {
  const events = config.agenda.flatMap((day) => day.events);
  if (events.length === 0) return;

  const host = config.seo.base_url ? new URL(config.seo.base_url).host : 'agenda-cultural';
  const options = { name: config.profile.name, host, location: config.profile.location };

  await writeFile(join(outputDir, 'agenda.ics'), buildCalendar(events, options));

  const eventDir = join(outputDir, 'eventos');
  await mkdir(eventDir, { recursive: true });
  await Promise.all(
    events.map((event) =>
      writeFile(join(eventDir, `${event.slug}.ics`), buildCalendar([event], options)),
    ),
  );
}

export default function (eleventyConfig) {
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    const config = await site();
    await writeQrCodes(dir.output, config);
    await writeCalendars(dir.output, config);
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
