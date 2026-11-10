import type { HTMLInputAttributes } from 'svelte/elements';

/**
 * What a search box's input carries so that it reads as a search, not a sign-in field. Android's
 * autofill (and the password managers behind it, NordPass and the like) take a lone text field
 * whose hint mentions a username ("Search name or @username") for a login and pop their menu as it
 * gets focus; browsers' own autofill and the password managers' extensions do the same on the web.
 * A search type and input mode, autocomplete off and each manager's own opt-out (1Password's
 * `data-1p-ignore`, LastPass's `data-lpignore`, Bitwarden's `data-bwignore`, Dashlane's
 * `data-form-type`) tell them it isn't one. Spread it on the input, which mustn't have a `name` or
 * `id` that looks like a username, nor sit in a `<form>`; `type="search"` brings the browser's own
 * clear button, which the field hides (`::-webkit-search-cancel-button`) where it draws its own.
 */
export const SEARCH_INPUT_ATTRIBUTES = {
  type: 'search',
  inputmode: 'search',
  enterkeyhint: 'search',
  autocomplete: 'off',
  'data-1p-ignore': '',
  'data-lpignore': 'true',
  'data-bwignore': '',
  'data-form-type': 'other',
} as const satisfies HTMLInputAttributes;
