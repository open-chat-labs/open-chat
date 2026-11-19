// When MessageComposer's GIF tab asks its host for a search (`onGifSearch`): once per change, so reopening the
// picker or re-picking a category doesn't refetch what's already shown, but again when the last load of that
// search failed, which is the only way to retry it (a grid with nothing in it can't be scrolled for more).

import type { ComposerGifs } from './types';

/** Whether to ask the host for `query`, given the search it was last asked for and how that one's load stands
 *  (`gifs.status`, for the search last asked for). */
export function asksForGifs(query: string, asked: string | undefined, status: ComposerGifs['status'] | undefined): boolean {
  return query !== asked || status === 'failed';
}
