import { derived } from 'svelte/store';
import { locale } from 'svelte-i18n';

const rtlStore = derived(locale, $locale => $locale === 'ar');
export { rtlStore };