/**
 * Institutional branding.
 *
 * The logo falls back to a monogram if it is missing or fails to load, so
 * a moved file never leaves a broken icon in the header of every page.
 *
 * This points at PIEMR's own CloudFront distribution, the same one the
 * institute's website uses. It is an SVG, so it is rendered unoptimized —
 * Next's image optimizer would otherwise need `dangerouslyAllowSVG`,
 * which relaxes a protection worth keeping. Served through an <img>, an
 * SVG cannot execute scripts, so this is both simpler and safer.
 *
 * To host it yourself instead (more robust — nothing outside this app can
 * then break it), save the file as `public/piemr-logo.svg` and set
 * PIEMR_LOGO to '/piemr-logo.svg'.
 */

export const PIEMR_LOGO: string | null =
  'https://d3md8ar2i5icyz.cloudfront.net/wp-content/uploads/2022/11/logo_updated.svg';

/** Shown when no logo is set, or when the file fails to load. */
export const PIEMR_MONOGRAM = 'PI';

/**
 * Official Smart India Hackathon mark.
 *
 * Not bundled: it is a government mark, and this repository should not
 * carry a copy of one that may be superseded. SIH refreshes its identity
 * each edition, so an old file here would quietly become wrong.
 *
 * TO ADD IT
 *   1. Save the current edition's logo as `public/sih-logo.png`
 *      (transparent PNG, about 400px on the long edge).
 *   2. Set SIH_LOGO below to '/sih-logo.png'.
 *
 * Until then the hero shows a text lockup instead, which is accurate and
 * carries no risk of displaying a stale mark.
 */
export const SIH_LOGO: string | null = null;

/** Edition shown in the hero lockup. Update it each year. */
export const SIH_EDITION = 'Smart India Hackathon 2026';
