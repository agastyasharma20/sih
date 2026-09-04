/**
 * PIEMR leadership for the Smart India Hackathon.
 *
 * Edit this file to change names, titles, photos or copy — it is the only
 * place these appear.
 *
 * PHOTOS — two ways, both fine:
 *
 *   a) LOCAL (preferred). Save a square JPG/PNG into `public/leadership/`
 *      and set `photo` to '/leadership/<filename>'. Nothing outside this
 *      app can then break the image.
 *
 *   b) REMOTE. Paste an https URL — on piemr.edu.in, right-click the
 *      photo and "Copy image address". Only piemr.edu.in and sih.gov.in
 *      are permitted (see next.config.mjs); add any other host there
 *      first or the image will not render.
 *
 * Either way, if the image is missing or fails to load, a styled initials
 * badge is shown instead — the card never breaks.
 *
 * Photos are cropped square and centred, so a portrait headshot works
 * without editing.
 *
 * BIOGRAPHIES. Every line below is drawn from a public source, cited
 * against each person. Please have each of them confirm their own entry
 * before the site is announced — a title or affiliation that is out of
 * date is the kind of error people notice first.
 */

export interface LeaderProfile {
  name: string;
  title: string;
  role: string;
  /** '/leadership/<file>' under public/, an https URL, or null for the
   *  initials badge. */
  photo: string | null;
  bio: string;
  highlights: string[];
  /** Public page this entry was compiled from, shown as "Profile". */
  profileUrl?: string;
}

export const LEADERSHIP: LeaderProfile[] = [
  {
    name: 'Prof. (Dr.) Manojkumar Deshpande',
    title: 'Senior Director, PIEMR',
    role: 'Patron',
    photo: null, // → '/leadership/manojkumar-deshpande.jpg' or an https URL
    bio:
      'Senior Director of the Prestige Institute of Engineering Management & Research, ' +
      'Indore, where he leads the institute’s academic direction and its participation ' +
      'in national innovation programmes such as the Smart India Hackathon.',
    highlights: [
      'PhD from MPSTME, NMIMS University; M.Tech from NIELIT Aurangabad; BE from SSGMCE Shegaon',
      'Previously Professor and Dean at Symbiosis University of Applied Sciences, Indore',
      'Formerly Professor and Associate Dean at NMIMS',
      'Research interests: Artificial Intelligence, Software Engineering and Industry 4.0',
    ],
    profileUrl: 'https://piemr.edu.in/faculty-list/prof-dr-manojkumar-deshpande/',
  },
  {
    name: 'Sadhana Tiwari',
    // Her own PIEMR page uses "Er. Sadhana Tiwari". Confirm the correct
    // honorific with her before this goes public.
    title: 'SIH Single Point of Contact (SPOC), PIEMR',
    role: 'SIH SPOC',
    photo: null, // → '/leadership/sadhana-tiwari.jpg' or an https URL
    bio:
      'The institute’s Single Point of Contact for the Smart India Hackathon. The SPOC ' +
      'runs the internal round, registers PIEMR’s shortlisted teams on the national ' +
      'portal, and is the point of contact for participants throughout.',
    highlights: [
      'Faculty at Prestige Institute of Engineering Management & Research, Indore',
      'Research interests: Internet of Things, Biospeckle and Artificial Intelligence',
      'Runs team registration, the internal hackathon, and the national-round submission',
    ],
    profileUrl: 'https://sites.google.com/piemr.edu.in/ersadhanatiwari/home',
  },
];

const HONORIFICS = /^(prof|dr|er|mr|ms|mrs|shri|smt|adv|capt)\.?$/i;

/**
 * Initials for the fallback badge: first letter of the first and last
 * meaningful name parts.
 *
 * Honorifics are dropped as whole words rather than by pattern, because
 * real names carry them in awkward shapes — "Prof. (Dr.) Manojkumar
 * Deshpande" has to yield MD, not "(D".
 */
export function initialsFor(name: string): string {
  const parts = name
    .replace(/[().,]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length > 0 && !HONORIFICS.test(part));

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
