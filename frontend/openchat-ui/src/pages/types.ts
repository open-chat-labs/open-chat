// Shared prop types for the pages (Landing, Learn).

export type PageMode = 'dark' | 'light';
export type PageAccent = 'pink' | 'orange' | 'blue' | 'green';

/** The accents in picker order. */
export const PAGE_ACCENTS: PageAccent[] = ['pink', 'orange', 'blue', 'green'];

/** A featured community card on the Landing page. */
export interface LandingCommunity {
  name: string;
  about: string;
  members: number;
  /** Avatar image URL; without one the avatar is a gradient in `color`. */
  avatarUrl?: string;
  color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
  /** Banner image URL; without one the card gets a token cover. */
  coverUrl?: string;
  /** Where the card goes (e.g. the community's preview); without it the card isn't a link. */
  href?: string;
}
