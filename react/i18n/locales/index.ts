/**
 * Bundled locales. This is a separate entry point
 * (`@kuraykaraaslan/kui-player/locales`) so importing one does not drag the
 * others — and so a player left in English carries none of them.
 */
export { tr } from './tr.js';
export { de } from './de.js';
export { es } from './es.js';
export { fr } from './fr.js';
export { ar } from './ar.js';
// `en` is not re-exported here on purpose: it lives in the React entry, and
// pulling it through this one would ship a second copy of the i18n module.
export type { Dictionary, PartialDictionary } from '../index.js';
