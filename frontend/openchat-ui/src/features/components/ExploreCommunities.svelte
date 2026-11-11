<!-- Explore communities: hero search, language filter, "Popular on OpenChat" (featured + cards, communities you haven't
     joined) and the full table with sort and paging. Typing switches to search results (best match + more results,
     name matches ranked first). guest adds a sticky sign-in banner.
     With onQuery the host does the searching, filtering, sorting and paging: every change (debounced for typing) and
     "Load more" ask it for a page, `communities` is shown as given and `total` drives the counts. A first page counts as
     answered once `communities` is a new array and `loading` is false. Without onQuery the
     list is filtered and paged locally (small, fully loaded lists). -->
<script lang="ts" module>
  export interface ExploreQuery {
    text: string;
    /** Language values as the communities carry them. */
    languages: string[];
    sort: 'members' | 'active' | 'newest';
    offset: number;
    limit: number;
  }

  /** A language the filter offers (onQuery mode): its code is what `ExploreQuery.languages` carries. */
  export interface ExploreLanguage {
    code: string;
    label: string;
    /** Defaults to the code's flag. */
    flag?: string;
  }
</script>

<script lang="ts">
  import { flushSync, onMount, untrack } from 'svelte';
  import { useT } from '../../lib/i18n';
  import { languageFlag } from '../../lib/languages';
  import { cssUrl } from '../../lib/cssUrl';
  import { askTiming, askedFor, homeRefresh, searchViewShown, type ExploreAsk, type ExploreSearch } from '../../lib/exploreAsk';
  import Spinner from '../../lib/components/Spinner.svelte';
  import Translate from '../../lib/components/Translate.svelte';
  import Logo from '../../lib/components/Logo.svelte';
  import { AVATAR_GRADIENTS } from '../../lib/components/Avatar.svelte';

  type Swatch = 'sunset' | 'amber' | 'blue' | 'teal' | 'plum' | 'violet' | 'rose';

  const GRAD: Record<Swatch, string> = {
    // a person's, chat's or community's swatch is Avatar's, as everywhere (one gradient per name)
    ...AVATAR_GRADIENTS,
    sunset: 'linear-gradient(140deg,#FFB03D,#FF5672)',
    rose: 'linear-gradient(140deg,#FF8FA8,#E0456A)',
  };
  const COVER: Record<Swatch, string> = {
    sunset: 'linear-gradient(120deg,#3a1d14,#5a2230 60%,#3b1a2a)',
    amber: 'linear-gradient(120deg,#3a2410,#5a3418)',
    blue: 'linear-gradient(120deg,#11224a,#1f3a72)',
    teal: 'linear-gradient(120deg,#0f3330,#16405a)',
    plum: 'linear-gradient(120deg,#2a1838,#52245a)',
    violet: 'linear-gradient(120deg,#1e1a44,#332a70)',
    rose: 'linear-gradient(120deg,#3b1522,#5a1f36)',
  };
  // rows per page in the table (and the page size asked of the host)
  const PAGE = 6;
  const SORT_KEYS: ExploreQuery['sort'][] = ['members', 'active', 'newest'];
  const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(n));

  export interface ExploreCommunity {
    key: string;
    name: string;
    about?: string;
    members: number;
    /** Sort keys for "Most active" and "Newest". */
    active?: number;
    created?: number;
    /** Language name or resource key; defaults to English. */
    language?: string;
    visibility?: 'Public' | 'Private';
    verified?: boolean;
    /** Avatar colour (pin wins over color); cover falls back to pin. */
    pin?: Swatch;
    color?: Swatch;
    cover?: Swatch;
    /** Avatar image; the colour shows without it. */
    avatarUrl?: string;
    /** Cover (banner) image; the colour shows without it. */
    coverUrl?: string;
    channels?: { title: string; visibility?: 'Public' | 'Private' }[];
    /** Overrides channels.length. */
    channelCount?: number;
    /** Access gate: its items are the join requirements. */
    gate?: { items: unknown[] };
  }

  interface Props {
    communities: ExploreCommunity[];
    joinedKeys?: string[];
    guest?: boolean;
    onOpen?: (key: string) => void;
    /** The table's Preview button: open the community's preview (not a join). */
    onPreview?: (key: string) => void;
    /** Server-side search / filter / sort / paging. Called with offset 0 on every change and offset = loaded count
     *  for "Load more"; the host replaces or appends `communities`. */
    onQuery?: (q: ExploreQuery) => void;
    /** Matching communities in all (onQuery mode); defaults to communities.length. */
    total?: number;
    /** A page is being fetched (onQuery mode). */
    loading?: boolean;
    /** The page last asked for couldn't be loaded (onQuery mode): a first page shows an error with a retry in place of
     *  the page before it, a later one a retry on Load more. The host clears it as it takes the next ask. */
    failed?: boolean;
    /** Show the home list's sorts (Most members, Most active, Newest). A host whose search can't sort hides them. */
    showSort?: boolean;
    /** Languages to offer in the filter (onQuery mode), by code; defaults to the languages of the loaded communities. */
    languageOptions?: ExploreLanguage[];
    /** The search text it opens with (e.g. from the host's URL). Read once; later changes come from the user. */
    initialQuery?: string;
    /** The languages picked when it opens (codes in onQuery mode, as `ExploreQuery.languages`). Read once. */
    initialLanguages?: string[];
    /** Where its list is scrolled to when it opens (from `onScroll` on an earlier visit). Read once. */
    initialScroll?: number;
    /** The list was scrolled, to this offset from the top. */
    onScroll?: (top: number) => void;
    onCreate?: () => void;
    onSignIn?: () => void;
    /** Defaults to onSignIn. */
    onCreateAccount?: () => void;
  }

  let {
    communities,
    joinedKeys = [],
    guest = false,
    onOpen,
    onPreview,
    onQuery,
    total,
    loading = false,
    showSort = true,
    failed = false,
    languageOptions,
    initialQuery = '',
    initialLanguages = [],
    initialScroll = 0,
    onScroll,
    onCreate,
    onSignIn,
    onCreateAccount,
  }: Props = $props();
  const t = useT();

  let query = $state(untrack(() => initialQuery));
  let sort = $state(0);
  let focused = $state(false);
  // the user opened the search (a click or a key in the hero's search, or focusing the search's input): it stays open,
  // emptied too or with a click elsewhere, until they leave it with Back or Esc (searchViewShown)
  let searchOpen = $state(false);
  let searchInput = $state<HTMLInputElement>();
  let langs = $state<string[]>(untrack(() => [...initialLanguages]));
  let langOpen = $state(false);
  let shown = $state(PAGE);
  let root = $state<HTMLElement>();

  onMount(() => {
    if (root && initialScroll > 0) root.scrollTop = initialScroll;
    // the in-menu backdrop only covers this component; presses anywhere else close it too
    const away = (e: PointerEvent) => {
      if (langOpen && !(e.target as Element).closest?.('[data-ex-lang]')) langOpen = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !langOpen) return;
      e.preventDefault(); // keeps an enclosing dialog open
      langOpen = false;
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      clearTimeout(queryTimer);
      clearTimeout(composedTimer);
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  });

  // the filter compares these values; they render through t(), so keys and plain names both work
  const langOf = (c: ExploreCommunity) => c.language || 'ui.exploreCommunities.english';
  // an IME composing a word in the hero's search: until it's composed there's no text yet, for the view (it doesn't
  // swap) or the host (nothing is asked for the partial word)
  let heroComposing = $state(false);
  let heroInput = $state<HTMLInputElement>();
  let composedTimer: ReturnType<typeof setTimeout> | undefined;
  function endHeroComposing(): void {
    clearTimeout(composedTimer);
    heroComposing = false;
  }
  // the search text as it stands
  const text = $derived(heroComposing ? '' : query.trim());
  const q = $derived(text.toLowerCase());
  const searchShown = $derived(searchViewShown(text, searchOpen));

  // opens the search view from the hero's search and moves the focus to its input in the same event, so a phone keeps its
  // keyboard; the hero's input itself never opens it on focus, so Tab goes past it to Popular and the list
  function openSearch(): void {
    // a word the hero was composing is the search's now (Safari's Enter or a click in the hero right after it's
    // composed, before compositionend's timer), and no composition outlives the hero
    endHeroComposing();
    searchOpen = true;
    flushSync();
    searchInput?.focus();
    // text already typed (a paste, an IME's word, an AltGr character …) keeps the caret after it
    searchInput?.setSelectionRange(query.length, query.length);
  }

  // Back or Esc: the search left, the home list asked for at once (nobody is typing); the input is blurred before it
  // goes, so its focus doesn't outlive it
  function leaveSearch(): void {
    endHeroComposing();
    searchInput?.blur();
    focused = false;
    searchOpen = false;
    query = '';
    clearTimeout(queryTimer);
    if (onQuery && !askedFor(lastAsk, { text: '', languages: langs, sort })) ask(0);
  }
  const SORTS: ((a: ExploreCommunity, b: ExploreCommunity) => number)[] = [
    (a, b) => b.members - a.members,
    (a, b) => (b.active || 0) - (a.active || 0),
    (a, b) => (b.created || 0) - (a.created || 0),
  ];
  // onQuery: the host has already searched, filtered and sorted
  const remote = $derived(!!onQuery);
  const list = $derived(
    remote
      ? communities
      : communities.filter((c) => (!langs.length || langs.includes(langOf(c))) && (!q || `${c.name} ${c.about || ''}`.toLowerCase().includes(q))).sort(SORTS[sort]),
  );
  const totalCount = $derived(remote ? (total ?? communities.length) : list.length);

  // every change asks the host for the first page again; typing waits for a pause
  let queryTimer: ReturnType<typeof setTimeout> | undefined;
  let firstQuery = true;
  // what the host was last asked for: until it has answered for the search as it stands (text, languages, sort) the
  // search shows "Searching…", never the previous search's results. The search it opens with (initialQuery,
  // initialLanguages) counts as asked, and `communities` as its answer
  let lastAsk = $state<ExploreAsk>(untrack(() => ({ text: initialQuery.trim(), languages: [...initialLanguages], sort: 0, offset: 0 })));
  // the page shown when a first page was asked for: until `communities` is a new page the host hasn't answered yet
  let askedOn = $state.raw<ExploreCommunity[] | null>(null);
  // the search the page shown answers: the home view keeps what doesn't depend on a new sort while the list refreshes
  let pageSearch = $state<ExploreSearch>(untrack(() => ({ text: initialQuery.trim(), languages: [...initialLanguages], sort: 0 })));
  $effect.pre(() => {
    const page = communities;
    untrack(() => {
      if (lastAsk.offset === 0 && page !== askedOn) pageSearch = { text: lastAsk.text, languages: [...lastAsk.languages], sort: lastAsk.sort };
    });
  });
  // the host reported loading after the ask: once it stops, the ask is answered even if the page didn't change
  // (e.g. a failed fetch that keeps the old page), so the loading state can't get stuck
  let sawLoading = $state(false);
  $effect.pre(() => {
    if (loading) untrack(() => (sawLoading = true));
  });
  const ask = (offset: number) => {
    lastAsk = { text, languages: [...langs], sort, offset };
    if (offset === 0) {
      askedOn = communities;
      sawLoading = false;
    }
    onQuery?.({ text, languages: [...langs], sort: SORT_KEYS[sort], offset, limit: PAGE });
  };
  $effect(() => {
    void text;
    void langs;
    void sort;
    untrack(() => {
      if (firstQuery) {
        firstQuery = false;
        return;
      }
      if (!onQuery) return;
      clearTimeout(queryTimer);
      // a sort, a language or leaving the search is asked for at once; typing waits for a pause; the search already
      // asked for isn't asked again
      const timing = askTiming(lastAsk, { text, languages: langs, sort });
      if (timing === 'now') ask(0);
      else if (timing === 'debounced') queryTimer = setTimeout(() => ask(0), 250);
    });
  });
  // search ranks name matches above description matches, then by size
  const score = (c: ExploreCommunity) => (q && c.name.toLowerCase().includes(q) ? 2 : 0) + (q && c.name.toLowerCase().startsWith(q) ? 1 : 0);
  const found = $derived(q ? (remote ? list : list.slice().sort((a, b) => score(b) - score(a) || b.members - a.members)) : []);
  // onQuery: the shown page belongs to an older text (debounce not fired yet, or the first page still loading)
  // the shown page belongs to an older ask: a different text, or the first page asked for and not answered (still the
  // same `communities`, or the host says it's loading)
  const firstPagePending = $derived(lastAsk.offset === 0 && (loading || (communities === askedOn && !sawLoading)));
  // the last ask is for the search as it stands: the same text, languages and sort
  const askedAsShown = $derived(askedFor(lastAsk, { text, languages: langs, sort }));
  const searching = $derived(remote && !!q && (!askedAsShown || firstPagePending));
  // onQuery: the home list still holds an older query's page (just after clearing the search, or a sort / language
  // change the host hasn't answered yet); it shows a loading state instead of passing that page off as "All communities"
  const homeStale = $derived(remote && !q && (!askedAsShown || firstPagePending));
  // while it is: the list refreshes in place; the hero's count and Popular wait only for other languages or text
  const home = $derived(homeRefresh(pageSearch, { text, languages: langs, sort }, homeStale));
  // onQuery: the host couldn't load the page last asked for (`failed`), for the search as it stands. A first page leaves
  // the page before it, which mustn't pass as its answer: an error with a retry shows in its place. A later page keeps
  // the list, and Load more becomes the retry
  const firstPageFailed = $derived(remote && failed && !loading && askedAsShown && lastAsk.offset === 0);
  const moreFailed = $derived(remote && failed && !loading && askedAsShown && lastAsk.offset > 0);

  const isJoined = (c: ExploreCommunity) => joinedKeys.includes(c.key);
  const isPrivate = (c: ExploreCommunity) => c.visibility === 'Private';
  const channelCount = (c: ExploreCommunity) => c.channelCount ?? (c.channels ?? []).length;
  const avatarOf = (c: ExploreCommunity) =>
    c.avatarUrl ? `center/cover no-repeat ${cssUrl(c.avatarUrl)}` : (c.pin && GRAD[c.pin]) || (c.color && GRAD[c.color]) || GRAD.teal;
  const coverOf = (c: ExploreCommunity) =>
    c.coverUrl ? `center/cover no-repeat ${cssUrl(c.coverUrl)}` : (c.cover && COVER[c.cover]) || (c.pin && COVER[c.pin]) || COVER.plum;
  const open = (c: ExploreCommunity) => {
    if (isJoined(c) || !isPrivate(c)) onOpen?.(c.key);
  };

  // Popular's languages: the page's while the list refreshes for other ones (it still shows that page, dimmed)
  const popularLangs = $derived(home.top ? pageSearch.languages : langs);
  // popular: biggest public communities you haven't joined
  // kept while the list refreshes for a new sort or languages (dimmed until the answer, so it isn't mounted again and its
  // intro doesn't replay); never from a page left by a search
  const top = $derived(q || home.list === 'loading' || firstPageFailed ? [] : list.filter((c) => !isJoined(c) && !isPrivate(c)).sort((a, b) => b.members - a.members).slice(0, 4));
  // per-language counts only mean something when the whole list is here; when the host pages the results they're hidden
  // the host's options are picked by code and shown by label; the communities' own languages are both
  const languages = $derived.by(() => {
    const opts = languageOptions
      ? languageOptions.map((l) => ({ value: l.code, label: l.label, flag: l.flag ?? languageFlag(l.code) }))
      : Array.from(new Set(communities.map(langOf))).map((l) => ({ value: l, label: l, flag: languageFlag(l) }));
    if (remote) return opts.map((o) => ({ ...o, count: null as number | null }));
    return opts.map((o) => ({ ...o, count: communities.filter((c) => langOf(c) === o.value).length as number | null })).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  });
  const langName = (value: string) => t(languages.find((l) => l.value === value)?.label ?? value);
  const langLabel = $derived(!langs.length ? t('ui.exploreCommunities.anyLanguage') : langs.length === 1 ? langName(langs[0]) : t('ui.exploreCommunities.languagesCount', { count: langs.length }));
  const emptyTitle = $derived(q ? t('ui.exploreCommunities.noMatch', { query }) : t('ui.exploreCommunities.noneInLanguages'));
  const rows = $derived(remote ? list : list.slice(0, shown));
  const hasMore = $derived(remote ? list.length < totalCount : list.length > shown);

  function loadMore() {
    if (remote) {
      if (!loading) ask(list.length);
    } else shown += PAGE;
  }

  // a first page that failed, asked for again as things stand
  function retryFirstPage() {
    if (!loading) ask(0);
  }

  function toggleLang(l: string) {
    shown = PAGE;
    langs = langs.includes(l) ? langs.filter((k) => k !== l) : [...langs, l];
  }

  // the open language menu takes the room from its top to the pane's foot (over the guest banner, see .menu-open) and
  // scrolls past that: a long list on a short pane would otherwise run off the pane, out of reach under the sticky
  // search bar. Opened with less than a few options' room (a hero near the foot), the pane first scrolls it up to have
  // them, as far as it can: the scrim keeps the pane from scrolling while the menu is open. Kept to the room as the menu
  // moves with it open: the pane resizing, or its content shrinking under a language just picked (its scroll clamped)
  const MENU_MARGIN = 12;
  const MENU_MIN = 120;
  function fitToPane(menu: HTMLElement) {
    const pane = root;
    if (!pane) return;
    const room = () => Math.floor(pane.getBoundingClientRect().bottom - menu.getBoundingClientRect().top - MENU_MARGIN);
    // how far the pane's content alone scrolls: the menu, absolute in the pane, adds to its overflow, so it's measured
    // out of the layout. The pane's scroll is kept within that, in one step, before the menu is capped: past it, the
    // capped menu would hold the overflow open and each cap then clamp the pane back a step per scroll event
    const contentScroll = () => {
      menu.style.display = 'none';
      const most = pane.scrollHeight - pane.clientHeight;
      menu.style.display = '';
      return Math.max(0, most);
    };
    const fit = () => {
      const most = contentScroll();
      if (pane.scrollTop > most) pane.scrollTop = most;
      menu.style.maxHeight = `${Math.max(0, room())}px`;
    };
    const short = MENU_MIN - room();
    if (short > 0) pane.scrollTop = Math.min(pane.scrollTop + short, contentScroll());
    fit();
    window.addEventListener('resize', fit);
    pane.addEventListener('scroll', fit, { passive: true });
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : undefined;
    resized?.observe(pane);
    return () => {
      window.removeEventListener('resize', fit);
      pane.removeEventListener('scroll', fit);
      resized?.disconnect();
    };
  }
</script>

{#snippet icon(name: string, size: number, ink: string)}<span class="glyph" style:width="{size}px" style:height="{size}px" style:background={ink} style:mask="var(--icon-{name}) center/contain no-repeat"
  ></span>{/snippet}

{#snippet langPicker(centered: boolean)}
  <div class="lang" data-ex-lang="">
    <span class="lang-button" class:compact={!centered} class:active={langs.length > 0} onclick={() => (langOpen = !langOpen)} role="button" tabindex="0"
      >{langLabel}{@render icon('chevron-down', 12, 'currentColor')}</span
    >
    {#if langOpen}
      <div class="lang-scrim" onclick={() => (langOpen = false)} role="presentation"></div>
      <div class="lang-menu" class:centered {@attach fitToPane}>
        {#each languages as l}
          {@const on = langs.includes(l.value)}
          <div class="lang-option" onclick={() => toggleLang(l.value)} tabindex="0" role="option" aria-selected={on}>
            <span class="lang-box" class:on><span class="lang-check" class:on></span></span>
            <span class="lang-flag" aria-hidden="true">{l.flag}</span>
            <span class="lang-label">{t(l.label)}</span>
            {#if l.count != null}<span class="lang-count">{l.count}</span>{/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet bigCard(c: ExploreCommunity, kicker: string)}
  {@const joined = isJoined(c)}
  <div class="big-card" class:locked={isPrivate(c) && !joined} onclick={() => open(c)} role="button" tabindex="0">
    <span style:background={coverOf(c)}></span>
    <div class="big-body">
      <span class="kicker">{t(kicker)}</span>
      <div class="big-identity">
        <span class="big-avatar" style:background={avatarOf(c)}></span>
        <div class="big-names">
          <div class="name-line"><span class="big-name">{c.name}</span>{#if c.verified}{@render icon('verified', 16, 'var(--status-verified)')}{/if}</div>
          <span class="big-meta">{t('ui.exploreCommunities.bigMeta', { count: c.members, members: fmt(c.members), channels: channelCount(c), language: t(langOf(c)) })}</span>
        </div>
      </div>
      <span class="big-about">{c.about || t('ui.exploreCommunities.noDescription')}</span>
      <span class="big-channels"
        >{(c.channels ?? [])
          .filter((ch) => ch.visibility !== 'Private')
          .slice(0, 5)
          .map((ch) => `# ${ch.title}`)
          .join('   ')}</span
      >
      <div class="big-actions">
        {#if joined || !isPrivate(c)}
          <span class="preview-cta">{@render icon('eye', 15, 'var(--on-accent)')}{t(joined ? 'ui.exploreCommunities.openCommunity' : 'ui.exploreCommunities.previewCommunity')}</span>
          <span class="cta-hint"
            >{joined
              ? t('ui.exploreCommunities.youreAMember')
              : c.gate
                ? t('ui.exploreCommunities.gateHint', { count: c.gate.items.length })
                : t('ui.exploreCommunities.publicHint')}</span
          >
        {:else}
          <span class="invite-only">{@render icon('lock', 12, 'var(--ink-3)')}{t('ui.exploreCommunities.inviteOnlyHint')}</span>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#snippet card(c: ExploreCommunity)}
  {@const joined = isJoined(c)}
  {@const priv = isPrivate(c)}
  <div class="card" class:locked={priv && !joined} onclick={() => open(c)} role="button" tabindex="0">
    <span class="card-cover" style:background={coverOf(c)}></span>
    <div class="card-body">
      <div class="card-top">
        <span class="card-avatar" style:background={avatarOf(c)}></span>
        {#if joined || priv || c.gate}
          <span class="tag" class:joined
            >{@render icon(joined ? 'check' : priv ? 'lock' : 'gate', 11, 'currentColor')}{t(joined ? 'ui.exploreCommunities.joined' : priv ? 'ui.exploreCommunities.inviteOnly' : 'ui.exploreCommunities.gated')}</span
          >
        {/if}
      </div>
      <div class="name-line"><span class="card-name">{c.name}</span>{#if c.verified}{@render icon('verified', 15, 'var(--status-verified)')}{/if}</div>
      <span class="card-about">{c.about || t('ui.exploreCommunities.noDescription')}</span>
      <div class="card-foot">
        <span class="stat" title={t('ui.exploreCommunities.membersTitle', { count: c.members, members: fmt(c.members) })}>{@render icon('users', 14, 'var(--ink-3)')}{fmt(c.members)}</span><span class="stat" title={t('ui.exploreCommunities.channelsTitle', { count: channelCount(c) })}
          >{@render icon('hash', 14, 'var(--ink-3)')}{channelCount(c)}</span
        ><span class="grow"></span>
        <span class="card-cta" class:muted={priv && !joined}>{t(joined ? 'ui.exploreCommunities.openArrow' : priv ? 'ui.exploreCommunities.inviteOnly' : 'ui.exploreCommunities.previewArrow')}</span>
      </div>
    </div>
  </div>
{/snippet}

<div class="explore" data-screen-label="Explore communities" bind:this={root} onscroll={() => root && onScroll?.(root.scrollTop)}>
  {#if searchShown}
    <div class="search-bar" class:menu-open={langOpen}>
      <div class="search-row">
        <span
          class="back"
          onclick={leaveSearch}
          role="button"
          tabindex="0">{@render icon('back', 15, 'var(--ink-3)')}{t('ui.exploreCommunities.explore')}</span
        >
        <div class="search small" class:focused>
          {@render icon('search', 16, 'var(--ink-3)')}
          <input
            bind:this={searchInput}
            bind:value={query}
            onfocus={() => {
              focused = true;
              searchOpen = true;
            }}
            onblur={() => (focused = false)}
            onkeydown={(e) => {
              // Esc leaves the search (cleared, back to the home view); with the language menu open it only closes that
              if (e.key !== 'Escape' || langOpen) return;
              e.preventDefault();
              leaveSearch();
            }}
            placeholder={t('ui.exploreCommunities.searchPlaceholder')}
          />
          {#if query}
            <!-- clearing keeps the search open: the input keeps its focus -->
            <span
              class="clear"
              onclick={() => {
                query = '';
                searchInput?.focus();
              }}
              aria-label={t('ui.exploreCommunities.clear')}
              role="button"
              tabindex="0"
              title={t('ui.exploreCommunities.clear')}>{@render icon('close', 12, 'var(--ink-3)')}</span
            >
          {/if}
        </div>
      </div>
      <div class="results-row">
        <span class="result-count"
          >{!q
            ? ''
            : searching
              ? t('ui.exploreCommunities.searching')
              : firstPageFailed
                ? t('ui.exploreCommunities.loadFailed')
                : t('ui.exploreCommunities.results', { count: remote ? totalCount : found.length })}</span
        >
        {@render langPicker(false)}
      </div>
    </div>

    <div class="results-wrap">
      <div class="results">
        {#if !q}
          <div class="empty" role="status">
            <span class="empty-title">{t('ui.exploreCommunities.typeToSearch')}</span>
          </div>
        {:else if searching}
          <div class="empty" role="status" aria-busy="true">
            <span class="empty-title">{t('ui.exploreCommunities.searching')}</span>
          </div>
        {:else if firstPageFailed}
          <div class="empty" role="alert">
            <span class="empty-title">{t('ui.exploreCommunities.loadFailed')}</span>
            <span class="empty-body">{t('ui.exploreCommunities.loadFailedBody')}</span>
            <span class="create" onclick={retryFirstPage} role="button" tabindex="0">{t('ui.common.retry')}</span>
          </div>
        {:else}
        {#if found.length > 0}
          {@render bigCard(found[0], 'ui.exploreCommunities.bestMatch')}
        {/if}

        {#if found.length > 1}
          <span class="section-label">{t('ui.exploreCommunities.moreResults')}</span>
          <div class="card-grid">
            {#each found.slice(1) as c}{@render card(c)}{/each}
          </div>
        {/if}

        {#if found.length === 0}
          <div class="empty">
            <span class="empty-title">{emptyTitle}</span>
            <span class="empty-body">{t('ui.exploreCommunities.emptyBody')}</span>
            <span class="create" onclick={onCreate} role="button" tabindex="0">{@render icon('plus', 15, 'var(--on-accent)')}{t('ui.exploreCommunities.createCommunity')}</span>
          </div>
        {/if}
        {#if remote && hasMore && found.length > 0}
          <div class="more">
            <span class="load-more" onclick={loadMore} role="button" tabindex="0" aria-busy={loading}
              >{loading ? t('ui.exploreCommunities.loading') : moreFailed ? t('ui.common.retry') : t('ui.exploreCommunities.loadMore', { count: Math.min(PAGE, totalCount - found.length) })}{@render icon('chevron-down', 13, 'var(--ink)')}</span
            >
            <span class="shown" role={moreFailed ? 'alert' : undefined}>{moreFailed ? t('ui.exploreCommunities.loadMoreFailed') : t('ui.exploreCommunities.showing', { shown: found.length, total: totalCount })}</span>
          </div>
        {/if}
        {/if}
      </div>
    </div>
  {:else}
    <div class="hero" class:menu-open={langOpen}>
      <div class="hero-text">
        <span class="hero-title">{t('ui.exploreCommunities.heroTitle')}</span>
        <span class="hero-sub"
          >{home.top
            ? t('ui.exploreCommunities.loading')
            : firstPageFailed
              ? t('ui.exploreCommunities.loadFailed')
              : t('ui.exploreCommunities.heroSub', { count: remote ? totalCount : communities.length })}</span
        >
      </div>
      <div class="search large" class:focused>
        {@render icon('search', 18, 'var(--ink-3)')}
        <!-- a click or a key opens the search view, which takes the focus over; focus alone (Tab) doesn't -->
        <input
          bind:this={heroInput}
          bind:value={query}
          autocomplete="off"
          onfocus={() => (focused = true)}
          onblur={() => (focused = false)}
          onclick={openSearch}
          onkeydown={(e) => {
            if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) openSearch();
          }}
          oninput={(e) => {
            // text that comes without a beforeinput (autofill, a password manager or an extension, some dictation)
            // has reached `query` and swapped the view already: the search takes it, and the focus, as above
            if (!heroComposing && !(e instanceof InputEvent && e.isComposing) && query.trim()) openSearch();
          }}
          onbeforeinput={(e) => {
            // text from anywhere else (AltGr or Option characters, a paste, a drop) opens the search with it, before
            // the hero's input can take it: text in the hero would swap the view and take the input (and its focus)
            // away mid-keystroke. An IME's word waits for compositionend
            if (heroComposing || e.isComposing || e.inputType === 'insertCompositionText') return;
            const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
            if (!data) return;
            e.preventDefault();
            query += data;
            openSearch();
          }}
          oncompositionstart={() => {
            heroComposing = true;
            clearTimeout(queryTimer);
            clearTimeout(composedTimer);
          }}
          oncompositionend={() => {
            // a word composed in the search opens it; a composition ended by leaving the input (a click elsewhere) or
            // cancelled leaves nothing behind, so the view doesn't swap under the user's click. A click elsewhere ends
            // the composition while the input still has the focus and blurs it right after, in the same task, so
            // which one it was is only known once that task is done; until then the word stays uncomposed
            // one that comes after the search opened (a browser committing on the hero's blur or removal) is
            // ignored: the word is the search's already
            if (searchOpen || !heroInput?.isConnected) return;
            clearTimeout(composedTimer);
            composedTimer = setTimeout(() => {
              if (document.activeElement === heroInput && query.trim()) openSearch();
              else {
                query = '';
                heroComposing = false;
              }
            });
          }}
          placeholder={t('ui.exploreCommunities.searchPlaceholder')}
        />
      </div>
      <div class="hero-filters">
        <span class="hero-note">{t('ui.exploreCommunities.showingIn')}</span>
        {@render langPicker(true)}
        <span class="hero-divider"></span>
        <span class="hero-note"><Translate key="ui.exploreCommunities.orCreate">{#snippet link()}<span class="create-link" onclick={onCreate} role="button" tabindex="0">{t('ui.exploreCommunities.createOwn')}</span>{/snippet}</Translate></span>
      </div>
    </div>

    {#if top.length > 0}
      <div class="popular-wrap" class:refreshing={home.top}>
        <div class="popular">
          <div class="popular-head">
            <span class="popular-title"
              >{popularLangs.length === 1 ? t('ui.exploreCommunities.popularIn', { language: langName(popularLangs[0]) }) : t('ui.exploreCommunities.popularOnOpenChat')}</span
            >
            <span class="popular-sub">{t('ui.exploreCommunities.popularSub')}</span>
          </div>
          {@render bigCard(top[0], 'ui.exploreCommunities.featured')}
          <div class="popular-container" data-ex-popular="">
            <div class="popular-grid" data-ex-popular-grid="">
              {#each top.slice(1) as c}{@render card(c)}{/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <div class="table-wrap">
      <div class="table">
        <div class="table-head">
          <span class="table-title"
            >{t(langs.length ? 'ui.exploreCommunities.filtered' : 'ui.exploreCommunities.allCommunities')}
            {#if !home.top}<span class="table-count">· {firstPageFailed ? '–' : totalCount}</span>{/if}
            {#if home.list !== 'ready'}<span class="table-spinner"><Spinner size={14} tone="ink" label="ui.exploreCommunities.loading" /></span>{/if}</span
          >
          {#if langs.length}
            <span class="clear-filters" onclick={() => (langs = [])} role="button" tabindex="0">{t('ui.exploreCommunities.clearFilters')}</span>
          {/if}
          {#if showSort}
            <div class="sorts">
              {#each ['ui.exploreCommunities.sortMembers', 'ui.exploreCommunities.sortActive', 'ui.exploreCommunities.sortNewest'] as label, i}
                <span
                  class="sort"
                  class:on={sort === i}
                  onclick={() => {
                    sort = i;
                    shown = PAGE;
                  }}
                  role="button"
                  tabindex="0">{t(label)}</span
                >
              {/each}
            </div>
          {/if}
        </div>
        <div class="row columns" data-ex-row="">
          <span>{t('ui.exploreCommunities.colCommunity')}</span><span>{t('ui.exploreCommunities.colMembers')}</span><span data-ex-col="">{t('ui.exploreCommunities.colChannels')}</span><span data-ex-col="">{t('ui.exploreCommunities.colLanguage')}</span><span></span>
        </div>
        {#each firstPageFailed || home.list === 'loading' ? [] : rows as c}
          {@const joined = isJoined(c)}
          {@const priv = isPrivate(c)}
          <div class="row entry" class:locked={priv && !joined} class:refreshing={home.list === 'refreshing'} data-ex-row="" onclick={() => open(c)} role="button" tabindex="0">
            <div class="entry-name">
              <span class="entry-avatar" style:background={avatarOf(c)}></span>
              <div class="entry-text">
                <div class="name-line">
                  <span class="entry-title">{c.name}</span>
                  {#if c.verified}<span class="glyph-wrap" title={t('ui.exploreCommunities.verified')}>{@render icon('verified', 14, 'var(--status-verified)')}</span>{/if}
                  {#if priv}<span class="glyph-wrap" title={t('ui.exploreCommunities.private')}>{@render icon('lock', 12, 'var(--ink-3)')}</span>{/if}
                </div>
                <span class="entry-about">{c.about || t('ui.exploreCommunities.noDescription')}</span>
              </div>
            </div>
            <span class="mono">{fmt(c.members)}</span>
            <span class="mono" data-ex-col="">{channelCount(c)}</span>
            <span class="entry-lang" data-ex-col="">{t(langOf(c))}</span>
            <div class="entry-action">
              {#if joined}
                <span class="pill joined">{@render icon('check', 12, 'var(--status-online)')}{t('ui.exploreCommunities.joined')}</span>
              {:else if priv}
                <span class="pill">{@render icon('lock', 11, 'var(--ink-3)')}{t('ui.exploreCommunities.inviteOnly')}</span>
              {:else}
                <span
                  class="preview"
                  onclick={(e) => {
                    e.stopPropagation();
                    onPreview?.(c.key);
                  }}
                  role="button"
                  tabindex="0">{t('ui.exploreCommunities.preview')}</span
                >
              {/if}
            </div>
          </div>
        {/each}
        {#if hasMore && !homeStale && !firstPageFailed}
          <div class="more">
            <span class="load-more" onclick={loadMore} role="button" tabindex="0" aria-busy={loading}
              >{loading ? t('ui.exploreCommunities.loading') : moreFailed ? t('ui.common.retry') : t('ui.exploreCommunities.loadMore', { count: Math.min(PAGE, totalCount - rows.length) })}{@render icon('chevron-down', 13, 'var(--ink)')}</span
            >
            <span class="shown" role={moreFailed ? 'alert' : undefined}>{moreFailed ? t('ui.exploreCommunities.loadMoreFailed') : t('ui.exploreCommunities.showing', { shown: rows.length, total: totalCount })}</span>
          </div>
        {/if}
        {#if home.list === 'loading' || (home.list === 'refreshing' && rows.length === 0)}
          <div class="table-empty" role="status" aria-busy="true">
            <span class="table-empty-title">{t('ui.exploreCommunities.loading')}</span>
          </div>
        {:else if firstPageFailed}
          <div class="table-empty" role="alert">
            <span class="table-empty-title">{t('ui.exploreCommunities.loadFailed')}</span>
            <span class="table-empty-body">{t('ui.exploreCommunities.loadFailedBody')}</span>
            <span class="load-more" onclick={retryFirstPage} role="button" tabindex="0">{t('ui.common.retry')}</span>
          </div>
        {:else if list.length === 0}
          <div class="table-empty">
            <span class="table-empty-title">{emptyTitle}</span>
            <span class="table-empty-body">{t('ui.exploreCommunities.tableEmptyBody')}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if guest}
    <div class="guest-wrap">
      <div class="guest" data-screen-label="Guest banner">
        <Logo size={40} />
        <div class="guest-text">
          <span class="guest-title">{t('ui.exploreCommunities.guestTitle')}</span>
          <span class="guest-body">{t('ui.exploreCommunities.guestBody')}</span>
        </div>
        <div class="guest-actions">
          <span class="sign-in" onclick={onSignIn} role="button" tabindex="0">{t('ui.exploreCommunities.signIn')}</span>
          <span class="create-account" onclick={onCreateAccount ?? onSignIn} role="button" tabindex="0">{t('ui.exploreCommunities.createAccount')}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .explore {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    /* a column, so the guest banner takes the space under content shorter than the pane
       (margin-block-start: auto) and sits at its foot in every view, not straight after the content */
    display: flex;
    flex-direction: column;
  }

  .explore > * {
    flex-shrink: 0;
  }

  .glyph {
    flex: none;
    display: block;
  }

  .glyph-wrap {
    flex: none;
    display: flex;
  }

  .grow {
    flex: 1;
  }

  /* search mode */
  .search-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-18) var(--space-32) var(--space-14);
    background: var(--surface-1);
    border-block-end: 1px solid var(--line-1);
    animation: ex-bar-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: var(--space-14);
  }

  .back {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 36px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
  }

  .back:hover,
  .clear:hover {
    background: var(--overlay-2);
  }

  .search {
    --search-ring: var(--line-2);
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background: var(--overlay-1);
  }

  .search.focused {
    --search-ring: var(--accent);
  }

  .search.small {
    flex: 1;
    min-width: 0;
    gap: var(--space-10);
    height: 46px;
    padding: 0 var(--space-16);
    border-radius: var(--radius-lg);
    box-shadow: inset 0 0 0 1px var(--search-ring);
  }

  .search.large {
    width: 100%;
    max-width: 640px;
    gap: var(--space-12);
    height: 56px;
    padding: 0 var(--space-18);
    border-radius: var(--radius-xl);
    box-shadow:
      inset 0 0 0 1px var(--search-ring),
      0 10px 30px rgba(0, 0, 0, 0.3);
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
  }

  .search.large input {
    font-size: var(--text-lg);
  }

  .clear {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-pill);
    cursor: pointer;
  }


  .results-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex-wrap: wrap;
  }

  .result-count {
    flex: 1 1 auto;
    padding-inline-start: calc(var(--space-10) + 21px);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  /* language filter */
  .lang {
    position: relative;
    flex: none;
  }

  .lang-button {
    --lang-ink: var(--ink-2);
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 36px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--lang-ink);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .lang-button.compact {
    height: 32px;
    border-radius: var(--radius-pill);
  }

  .lang-button.active {
    --lang-ink: var(--accent-bright);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .lang-scrim {
    position: fixed;
    inset: 0;
    z-index: 19;
  }

  .lang-flag {
    flex: none;
    width: 22px;
    text-align: center;
    font: 400 17px/1 var(--font-sans);
  }

  .lang-menu {
    position: absolute;
    inset-inline-end: 0;
    top: calc(100% + 6px);
    z-index: 20;
    width: 220px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* max-height: the room to the pane's foot (fitToPane) */
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-panel);
  }

  .lang-menu.centered {
    inset-inline-end: auto;
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }

  .lang-option {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 38px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-sm);
    cursor: pointer;
    user-select: none;
  }

  .lang-option:hover {
    background: var(--overlay-1);
  }

  .lang-box {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 5px;
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--line-3);
  }

  .lang-box.on {
    background: var(--accent);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .lang-check {
    width: 11px;
    height: 11px;
    background: var(--on-accent);
    mask: var(--icon-check) center/contain no-repeat;
    opacity: 0;
  }

  .lang-check.on {
    opacity: 1;
  }

  .lang-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .lang-count {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  /* results */
  .results-wrap {
    display: flex;
    justify-content: center;
    padding: var(--space-22) var(--space-32) var(--space-32);
  }

  .results {
    width: 100%;
    max-width: 1080px;
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    animation: ex-rise 380ms 80ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .section-label {
    padding-inline: var(--space-4);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-16);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-32) var(--space-18);
    text-align: center;
  }

  .empty-title {
    font: var(--weight-semibold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .empty-body {
    max-width: 380px;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .create {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 38px;
    margin-top: var(--space-6);
    padding: 0 var(--space-16);
    border-radius: var(--radius-md);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent);
    cursor: pointer;
    user-select: none;
  }

  .create:hover {
    filter: brightness(1.08);
  }

  /* big (featured / best match) card */
  .big-card {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    min-height: 240px;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    overflow: hidden;
    cursor: pointer;
  }

  .big-card:hover,
  .card:hover {
    border-color: var(--line-3);
  }

  .big-card.locked,
  .card.locked,
  .entry.locked {
    cursor: default;
  }

  .big-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-22) var(--space-24);
  }

  .kicker {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--status-chit);
  }

  .big-identity {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    min-width: 0;
  }

  .big-avatar {
    flex: none;
    width: 54px;
    height: 54px;
    border-radius: 18px;
  }

  .big-names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .big-name,
  .card-name,
  .entry-title {
    min-width: 0;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .big-name {
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
  }

  .big-meta {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  .big-about {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }

  .big-channels {
    font: var(--weight-medium) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3);
  }

  .big-actions {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    margin-top: auto;
    flex-wrap: wrap;
  }

  .preview-cta {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 38px;
    padding: 0 var(--space-16);
    border-radius: var(--radius-md);
    background: var(--accent);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent);
  }

  .cta-hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .invite-only {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 32px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  /* small card */
  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-sizing: border-box;
    border: 1px solid var(--line-1);
    overflow: hidden;
    cursor: pointer;
  }

  .card-cover {
    flex: none;
    height: 120px;
  }

  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: 0 var(--space-16) var(--space-16);
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-10);
  }

  .card-avatar {
    flex: none;
    width: 60px;
    height: 60px;
    box-sizing: border-box;
    margin-top: -30px;
    border-radius: 20px;
    border: 4px solid var(--surface-2);
  }

  .tag {
    margin-top: var(--space-10);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: 24px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .tag.joined {
    background: color-mix(in oklch, var(--status-online) 14%, transparent);
    color: var(--status-online);
  }

  .card-name {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
  }

  .card-about {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    min-height: 3em;
    margin-bottom: var(--space-10);
    text-wrap: pretty;
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 52px;
    margin: auto calc(var(--space-16) * -1) calc(var(--space-16) * -1);
    padding: 0 var(--space-16);
    box-sizing: border-box;
    border-top: 1px solid var(--line-1);
    background: var(--overlay-1);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .card-cta {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
  }

  .card-cta.muted {
    color: var(--ink-4);
  }

  /* home: hero */
  .hero {
    position: relative;
    z-index: 4;
    animation: ex-hero-in 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-24);
    padding: 56px var(--space-32) var(--space-26);
    background: radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--accent) 10%, transparent), transparent 70%);
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    text-align: center;
  }

  .hero-title {
    font: var(--weight-bold) 34px/1.15 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--ink);
    text-wrap: balance;
  }

  .hero-sub {
    font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
    color: var(--ink-3);
  }

  .hero-filters {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    flex-wrap: wrap;
    justify-content: center;
  }

  .hero-note {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .hero-divider {
    width: 1px;
    height: 16px;
    background: var(--line-2);
  }

  .create-link {
    font-weight: var(--weight-semibold);
    color: var(--accent);
    cursor: pointer;
  }

  /* home: popular */
  .popular-wrap {
    display: flex;
    justify-content: center;
    padding: 0 var(--space-32) var(--space-26);
    animation: ex-rise 380ms 60ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    transition: opacity var(--duration-fast);
  }

  /* other languages asked for: Popular stays, dimmed, until the host answers */
  .popular-wrap.refreshing {
    opacity: 0.5;
  }

  .popular {
    width: 100%;
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .popular-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    padding-inline: var(--space-4);
  }

  .popular-title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .popular-sub {
    flex: none;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .popular-container {
    container-type: inline-size;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .popular-grid {
    display: grid;
    gap: var(--space-14);
  }

  /* home: table */
  .table-wrap {
    display: flex;
    justify-content: center;
    padding: 0 var(--space-32) var(--space-32);
  }

  .table {
    width: 100%;
    max-width: 1000px;
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    box-shadow: inset 0 0 0 1px var(--line-1);
    overflow: hidden;
  }

  .table-head {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    flex-wrap: wrap;
    padding: var(--space-14) var(--space-18);
    border-block-end: 1px solid var(--line-1);
  }

  .table-title {
    flex: 1 1 200px;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .table-count {
    font-weight: var(--weight-regular);
    color: var(--ink-4);
  }

  .table-spinner {
    display: inline-flex;
    margin-inline-start: var(--space-8);
    vertical-align: -2px;
  }

  .clear-filters {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .sorts {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .sort {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-sm);
    background: transparent;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .sort.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 100px 90px 110px 110px;
    gap: var(--space-12);
  }

  .columns {
    padding: var(--space-10) var(--space-18);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .entry {
    align-items: center;
    min-height: 80px;
    padding: var(--space-14) var(--space-18);
    box-sizing: border-box;
    border-block-start: 1px solid var(--line-1);
    cursor: pointer;
    transition: opacity var(--duration-fast);
  }

  .entry:hover {
    background: var(--overlay-1);
  }

  /* the list refreshing for a new sort or languages: the rows stay, dimmed, until the host answers */
  .entry.refreshing {
    opacity: 0.5;
  }

  .entry-name {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
  }

  .entry-avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }

  .entry-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .entry-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
  }

  .entry-about {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mono,
  .entry-lang {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-2);
  }

  .entry-lang {
    font-family: var(--font-sans);
  }

  .entry-action {
    justify-self: end;
    display: flex;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: 30px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .pill.joined {
    background: color-mix(in oklch, var(--status-online) 14%, transparent);
    color: var(--status-online);
  }

  .preview,
  .load-more {
    display: flex;
    align-items: center;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .preview {
    height: 32px;
    padding: 0 var(--space-14);
  }

  .preview:hover {
    background: var(--overlay-3);
  }

  .more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-18) var(--space-18) var(--space-22);
    border-block-start: 1px solid var(--line-1);
  }

  .load-more {
    gap: var(--space-8);
    height: 38px;
    padding: 0 var(--space-18);
    font-size: var(--text-md);
  }

  .load-more:hover {
    background: var(--overlay-3);
  }

  .shown {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .table-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-32) var(--space-18);
    text-align: center;
    border-block-start: 1px solid var(--line-1);
  }

  .table-empty-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .table-empty-body {
    max-width: 360px;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  /* guest banner */
  .guest-wrap {
    position: sticky;
    bottom: 0;
    margin-block-start: auto;
    z-index: 6;
    display: flex;
    justify-content: center;
    padding: var(--space-16) var(--space-16) var(--space-18);
    pointer-events: none;
  }

  /* the bar or hero with the language menu open goes over the banner (z-index 6), so the menu's last options aren't
     under it (a press on them would hit Sign in); its scrim covers the banner too, so a press there only closes it */
  .search-bar.menu-open,
  .hero.menu-open {
    z-index: 7;
  }

  .guest {
    pointer-events: auto;
    width: 100%;
    max-width: 1080px;
    display: flex;
    align-items: center;
    gap: var(--space-16);
    flex-wrap: wrap;
    padding: 20px 20px 20px 24px;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--accent) 10%, var(--surface-2));
    box-shadow:
      inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent),
      0 18px 44px rgba(0, 0, 0, 0.5);
    animation: ex-rise 420ms 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }


  .guest-text {
    flex: 1 1 260px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .guest-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .guest-body {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .guest-actions {
    flex: none;
    display: flex;
    gap: var(--space-8);
  }

  .sign-in,
  .create-account {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 var(--space-16);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .sign-in:hover {
    background: var(--overlay-2);
  }

  .create-account {
    padding: 0 var(--space-18);
    background: var(--accent);
    color: var(--on-accent);
  }

  .create-account:hover {
    filter: brightness(1.08);
  }
</style>
