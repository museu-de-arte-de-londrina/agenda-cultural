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

try {
  const config = await loadConfigFile(target);
  const label = typeof target === 'string' ? target : 'config.yaml';
  console.log(`✓ ${label} válido — ${config.links.length} link(s), ${config.social.length} rede(s) social(is).`);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
