#!/usr/bin/env node
/**
 * Standalone config check: `npm run validate [caminho/para/config.yaml]`.
 *
 * Exits non-zero with a readable report so CI and `npm run build` stop before
 * a broken page is ever rendered.
 */
import process from 'node:process';
import { loadConfigFile, ConfigError } from '../schema/config.schema.js';

const target = process.argv[2] ?? new URL('../config.yaml', import.meta.url);

/**
 * A link pointing at the same URL as one of the contact icons is usually an
 * oversight: the page shows the destination twice. It is not always wrong,
 * since an icon plus a prominent button is a fair choice, so this warns
 * instead of failing the build.
 */
function warnAboutDuplicates(config) {
  const icons = new Map(config.social.map((entry) => [entry.url, entry.platform]));
  const repeated = config.links.filter((link) => icons.has(link.url));
  if (repeated.length === 0) return;

  console.warn(`\n⚠ ${repeated.length} link(s) repetem um ícone de contato do topo:`);
  for (const link of repeated) {
    console.warn(`   "${link.label}" → mesmo destino do ícone "${icons.get(link.url)}"`);
  }
  console.warn('  Remova de links[] ou de social[], a não ser que a repetição seja proposital.');
}

try {
  const config = await loadConfigFile(target);
  const label = typeof target === 'string' ? target : 'config.yaml';
  console.log(
    `✓ ${label} válido: ${config.events.length} evento(s), ${config.links.length} link(s), ${config.social.length} rede(s) social(is).`,
  );
  warnAboutDuplicates(config);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
