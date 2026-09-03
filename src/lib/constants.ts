/** Values that must agree between the browser form and the database. */

export const TEAM_SIZE = 6;
export const MIN_FEMALE_MEMBERS = 1;
export const DEFAULT_EMAIL_DOMAIN = 'piemr.edu.in';

export const BRANCHES = [
  'Computer Science & Engineering',
  'CSE (AI & ML)',
  'CSE (Data Science)',
  'Information Technology',
  'Electronics & Communication',
  'Electrical & Electronics',
  'Mechanical Engineering',
  'Civil Engineering',
  'MBA',
  'MCA',
  'Other',
] as const;

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Post Graduate'] as const;

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
] as const;

/** Live brand marks — linked rather than vendored, since SIH refreshes its
 *  identity each edition and PIEMR updates its own logo independently. */
export const PIEMR_SITE = 'https://piemr.edu.in';
export const SIH_SITE = 'https://sih.gov.in';
