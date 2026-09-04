/**
 * Institutional branding.
 *
 * Both logos and both leadership photos are optional. Where a file is not
 * supplied the UI falls back to a designed placeholder — a monogram or an
 * initials badge — so the site never shows a broken image.
 *
 * TO ADD THE REAL PIEMR LOGO
 *   1. Save it as `public/piemr-logo.png` (transparent PNG or SVG, about
 *      256px on the long edge).
 *   2. Set PIEMR_LOGO below to '/piemr-logo.png'.
 *
 * A local file is preferred over linking to piemr.edu.in: the institute
 * can rearrange its site at any time, and a hot-linked logo would then
 * break on every page here at once. A remote https URL does work if you
 * would rather use one — the loader falls back to the monogram if it
 * fails to load.
 */

export const PIEMR_LOGO: string | null = null;

/** Shown when no logo file is set. */
export const PIEMR_MONOGRAM = 'PI';
