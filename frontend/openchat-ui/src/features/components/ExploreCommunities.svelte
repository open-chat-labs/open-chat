<!-- Explore communities: hero search, language filter, "Popular on OpenChat" (featured + cards, communities you haven't
     joined) and the full table with sort and paging. Typing switches to search results (best match + more results,
     name matches ranked first). guest adds a sticky sign-in banner. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useT } from '../../lib/i18n';

  type Swatch = 'sunset' | 'amber' | 'blue' | 'teal' | 'plum' | 'violet' | 'rose';

  const GRAD: Record<Swatch, string> = {
    sunset: 'linear-gradient(140deg,#FFB03D,#FF5672)',
    amber: 'linear-gradient(140deg,#FFC061,#F58A2E)',
    blue: 'linear-gradient(140deg,#5CB8FF,#2F6BFF)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FA6B8)',
    plum: 'linear-gradient(140deg,#E27BFF,#9B3FD9)',
    violet: 'linear-gradient(140deg,#8B7BFF,#5B3FD9)',
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
  // rows per page in the table; the real list is paged from the backend
  const PAGE = 6;
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
    /** The table's Preview button. */
    onJoin?: (key: string) => void;
    onCreate?: () => void;
    onSignIn?: () => void;
    /** Defaults to onSignIn. */
    onCreateAccount?: () => void;
  }

  let { communities, joinedKeys = [], guest = false, onOpen, onJoin, onCreate, onSignIn, onCreateAccount }: Props = $props();
  const t = useT();

  // A translated sentence split around its {placeholders}, so part of it can be styled or clickable without breaking
  // the sentence up for translators: text segments alternate with placeholder names.
  const MARK = '\u0001';
  function segments(key: string, names: string[]): { text?: string; name?: string }[] {
    const params = Object.fromEntries(names.map((n) => [n, MARK + n + MARK]));
    return t(key, params)
      .split(MARK)
      .map((part, i) => (i % 2 ? { name: part } : { text: part }))
      .filter((seg) => seg.name || seg.text);
  }

  let query = $state('');
  let sort = $state(0);
  let focused = $state(false);
  let langs = $state<string[]>([]);
  let langOpen = $state(false);
  let shown = $state(PAGE);

  onMount(() => {
    // the in-menu backdrop only covers this component; presses anywhere else close it too
    const away = (e: PointerEvent) => {
      if (langOpen && !(e.target as Element).closest?.('[data-ex-lang]')) langOpen = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && langOpen) langOpen = false;
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  });

  // the filter compares these values; they render through t(), so keys and plain names both work
  const langOf = (c: ExploreCommunity) => c.language || 'ui.exploreCommunities.english';
  const q = $derived(query.trim().toLowerCase());
  const SORTS: ((a: ExploreCommunity, b: ExploreCommunity) => number)[] = [
    (a, b) => b.members - a.members,
    (a, b) => (b.active || 0) - (a.active || 0),
    (a, b) => (b.created || 0) - (a.created || 0),
  ];
  const list = $derived(
    communities
      .filter((c) => (!langs.length || langs.includes(langOf(c))) && (!q || `${c.name} ${c.about || ''}`.toLowerCase().includes(q)))
      .sort(SORTS[sort]),
  );
  // search ranks name matches above description matches, then by size
  const score = (c: ExploreCommunity) => (q && c.name.toLowerCase().includes(q) ? 2 : 0) + (q && c.name.toLowerCase().startsWith(q) ? 1 : 0);
  const found = $derived(q ? list.slice().sort((a, b) => score(b) - score(a) || b.members - a.members) : []);

  const isJoined = (c: ExploreCommunity) => joinedKeys.includes(c.key);
  const isPrivate = (c: ExploreCommunity) => c.visibility === 'Private';
  const channelCount = (c: ExploreCommunity) => c.channelCount ?? (c.channels ?? []).length;
  const avatarOf = (c: ExploreCommunity) => (c.pin && GRAD[c.pin]) || (c.color && GRAD[c.color]) || GRAD.teal;
  const coverOf = (c: ExploreCommunity) => (c.cover && COVER[c.cover]) || (c.pin && COVER[c.pin]) || COVER.plum;
  const open = (c: ExploreCommunity) => {
    if (isJoined(c) || !isPrivate(c)) onOpen?.(c.key);
  };

  // popular: biggest public communities you haven't joined
  const top = $derived(q ? [] : list.filter((c) => !isJoined(c) && !isPrivate(c)).sort((a, b) => b.members - a.members).slice(0, 4));
  const languages = $derived(
    Array.from(new Set(communities.map(langOf)))
      .map((l) => ({ label: l, count: communities.filter((c) => langOf(c) === l).length }))
      .sort((a, b) => b.count - a.count),
  );
  const langLabel = $derived(!langs.length ? t('ui.exploreCommunities.anyLanguage') : langs.length === 1 ? t(langs[0]) : t('ui.exploreCommunities.languagesCount', { count: langs.length }));
  const emptyTitle = $derived(q ? t('ui.exploreCommunities.noMatch', { query }) : t('ui.exploreCommunities.noneInLanguages'));
  const rows = $derived(list.slice(0, shown));

  function toggleLang(l: string) {
    shown = PAGE;
    langs = langs.includes(l) ? langs.filter((k) => k !== l) : [...langs, l];
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
      <div class="lang-menu" class:centered>
        {#each languages as l}
          {@const on = langs.includes(l.label)}
          <div class="lang-option" onclick={() => toggleLang(l.label)} tabindex="0" role="option" aria-selected={on}>
            <span class="lang-box" class:on><span class="lang-check" class:on></span></span>
            <span class="lang-label">{t(l.label)}</span>
            <span class="lang-count">{l.count}</span>
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
          <div class="name-line"><span class="big-name">{c.name}</span>{#if c.verified}{@render icon('verified', 16, 'var(--status-verified,#3D9BFF)')}{/if}</div>
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
          <span class="preview-cta">{@render icon('eye', 15, 'var(--on-accent,#2E0512)')}{t(joined ? 'ui.exploreCommunities.openCommunity' : 'ui.exploreCommunities.previewCommunity')}</span>
          <span class="cta-hint"
            >{joined
              ? t('ui.exploreCommunities.youreAMember')
              : c.gate
                ? t('ui.exploreCommunities.gateHint', { count: c.gate.items.length })
                : t('ui.exploreCommunities.publicHint')}</span
          >
        {:else}
          <span class="invite-only">{@render icon('lock', 12, 'var(--ink-3,#9A9AA8)')}{t('ui.exploreCommunities.inviteOnlyHint')}</span>
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
      <div class="name-line"><span class="card-name">{c.name}</span>{#if c.verified}{@render icon('verified', 15, 'var(--status-verified,#3D9BFF)')}{/if}</div>
      <span class="card-about">{c.about || t('ui.exploreCommunities.noDescription')}</span>
      <div class="card-foot">
        <span class="stat" title={t('ui.exploreCommunities.membersTitle', { count: c.members, members: fmt(c.members) })}>{@render icon('users', 14, 'var(--ink-3,#9A9AA8)')}{fmt(c.members)}</span><span class="stat" title={t('ui.exploreCommunities.channelsTitle', { count: channelCount(c) })}
          >{@render icon('hash', 14, 'var(--ink-3,#9A9AA8)')}{channelCount(c)}</span
        ><span class="grow"></span>
        <span class="card-cta" class:muted={priv && !joined}>{t(joined ? 'ui.exploreCommunities.openArrow' : priv ? 'ui.exploreCommunities.inviteOnly' : 'ui.exploreCommunities.previewArrow')}</span>
      </div>
    </div>
  </div>
{/snippet}

<div class="explore" data-screen-label="Explore communities">
  {#if q}
    <div class="search-bar">
      <div class="search-row">
        <span class="back" onclick={() => (query = '')} role="button" tabindex="0">{@render icon('back', 15, 'var(--ink-3,#9A9AA8)')}{t('ui.exploreCommunities.explore')}</span>
        <div class="search small" class:focused>
          {@render icon('search', 16, 'var(--ink-3,#9A9AA8)')}
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={query} onfocus={() => (focused = true)} onblur={() => (focused = false)} autofocus placeholder={t('ui.exploreCommunities.searchPlaceholder')} />
          <span class="clear" onclick={() => (query = '')} aria-label={t('ui.exploreCommunities.clear')} role="button" tabindex="0" title={t('ui.exploreCommunities.clear')}>{@render icon('close', 12, 'var(--ink-3,#9A9AA8)')}</span>
        </div>
      </div>
      <div class="results-row">
        <span class="result-count">{t('ui.exploreCommunities.results', { count: found.length })}</span>
        {@render langPicker(false)}
      </div>
    </div>

    <div class="results-wrap">
      <div class="results">
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
            <span class="create" onclick={onCreate} role="button" tabindex="0">{@render icon('plus', 15, 'var(--on-accent,#2E0512)')}{t('ui.exploreCommunities.createCommunity')}</span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="hero">
      <div class="hero-text">
        <span class="hero-title">{t('ui.exploreCommunities.heroTitle')}</span>
        <span class="hero-sub">{t('ui.exploreCommunities.heroSub', { count: communities.length })}</span>
      </div>
      <div class="search large" class:focused>
        {@render icon('search', 18, 'var(--ink-3,#9A9AA8)')}
        <input bind:value={query} onfocus={() => (focused = true)} onblur={() => (focused = false)} placeholder={t('ui.exploreCommunities.searchPlaceholder')} />
        {#if query}
          <span class="clear large" onclick={() => (query = '')} aria-label={t('ui.exploreCommunities.clear')} role="button" tabindex="0" title={t('ui.exploreCommunities.clear')}>{@render icon('close', 13, 'var(--ink-3,#9A9AA8)')}</span>
        {/if}
      </div>
      <div class="hero-filters">
        <span class="hero-note">{t('ui.exploreCommunities.showingIn')}</span>
        {@render langPicker(true)}
        <span class="hero-divider"></span>
        <span class="hero-note">{#each segments('ui.exploreCommunities.orCreate', ['link']) as seg}{#if seg.name}<span class="create-link" onclick={onCreate} role="button" tabindex="0">{t('ui.exploreCommunities.createOwn')}</span>{:else}{seg.text}{/if}{/each}</span>
      </div>
    </div>

    {#if top.length > 0}
      <div class="popular-wrap">
        <div class="popular">
          <div class="popular-head">
            <span class="popular-title">{langs.length === 1 ? t('ui.exploreCommunities.popularIn', { language: t(langs[0]) }) : t('ui.exploreCommunities.popularOnOpenChat')}</span>
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
          <span class="table-title">{t(langs.length ? 'ui.exploreCommunities.filtered' : 'ui.exploreCommunities.allCommunities')} <span class="table-count">· {list.length}</span></span>
          {#if langs.length}
            <span class="clear-filters" onclick={() => (langs = [])} role="button" tabindex="0">{t('ui.exploreCommunities.clearFilters')}</span>
          {/if}
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
        </div>
        <div class="row columns" data-ex-row="">
          <span>{t('ui.exploreCommunities.colCommunity')}</span><span>{t('ui.exploreCommunities.colMembers')}</span><span data-ex-col="">{t('ui.exploreCommunities.colChannels')}</span><span data-ex-col="">{t('ui.exploreCommunities.colLanguage')}</span><span></span>
        </div>
        {#each rows as c}
          {@const joined = isJoined(c)}
          {@const priv = isPrivate(c)}
          <div class="row entry" class:locked={priv && !joined} data-ex-row="" onclick={() => open(c)} role="button" tabindex="0">
            <div class="entry-name">
              <span class="entry-avatar" style:background={avatarOf(c)}></span>
              <div class="entry-text">
                <div class="name-line">
                  <span class="entry-title">{c.name}</span>
                  {#if c.verified}<span class="glyph-wrap" title={t('ui.exploreCommunities.verified')}>{@render icon('verified', 14, 'var(--status-verified,#3D9BFF)')}</span>{/if}
                  {#if priv}<span class="glyph-wrap" title={t('ui.exploreCommunities.private')}>{@render icon('lock', 12, 'var(--ink-3,#9A9AA8)')}</span>{/if}
                </div>
                <span class="entry-about">{c.about || t('ui.exploreCommunities.noDescription')}</span>
              </div>
            </div>
            <span class="mono">{fmt(c.members)}</span>
            <span class="mono" data-ex-col="">{channelCount(c)}</span>
            <span class="entry-lang" data-ex-col="">{t(langOf(c))}</span>
            <div class="entry-action">
              {#if joined}
                <span class="pill joined">{@render icon('check', 12, 'var(--status-online,#2EE6A8)')}{t('ui.exploreCommunities.joined')}</span>
              {:else if priv}
                <span class="pill">{@render icon('lock', 11, 'var(--ink-3,#9A9AA8)')}{t('ui.exploreCommunities.inviteOnly')}</span>
              {:else}
                <span
                  class="preview"
                  onclick={(e) => {
                    e.stopPropagation();
                    onJoin?.(c.key);
                  }}
                  role="button"
                  tabindex="0">{t('ui.exploreCommunities.preview')}</span
                >
              {/if}
            </div>
          </div>
        {/each}
        {#if list.length > shown}
          <div class="more">
            <span class="load-more" onclick={() => (shown += PAGE)} role="button" tabindex="0"
              >{t('ui.exploreCommunities.loadMore', { count: Math.min(PAGE, list.length - shown) })}{@render icon('chevron-down', 13, 'var(--ink,#ECECF1)')}</span
            >
            <span class="shown">{t('ui.exploreCommunities.showing', { shown: Math.min(shown, list.length), total: list.length })}</span>
          </div>
        {/if}
        {#if list.length === 0}
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
        <img class="guest-logo" src="assets/openchat-logo.svg" alt="" width="40" height="40" />
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

<style>
  .explore {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
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
    background: var(--surface-1, #0e0e12);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
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
    color: var(--ink-3, #9a9aa8);
    cursor: pointer;
    user-select: none;
  }

  .back:hover,
  .clear:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .search {
    --search-ring: var(--line-2, rgba(255, 255, 255, 0.14));
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background: var(--overlay-1, rgba(255, 255, 255, 0.06));
  }

  .search.focused {
    --search-ring: var(--accent, #ff5672);
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
    color: var(--ink, #ececf1);
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

  .clear.large {
    width: 28px;
    height: 28px;
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
    color: var(--ink, #ececf1);
  }

  /* language filter */
  .lang {
    position: relative;
    flex: none;
  }

  .lang-button {
    --lang-ink: var(--ink-2, #c9c9d4);
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 36px;
    padding: 0 var(--space-12);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
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
    --lang-ink: var(--accent-bright, #ff8298);
    background: color-mix(in srgb, var(--accent, #ff5672) 12%, transparent);
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .lang-scrim {
    position: fixed;
    inset: 0;
    z-index: 19;
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
    padding: var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #191921);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-panel, 0 8px 24px rgba(0, 0, 0, 0.35));
  }

  .lang-menu.centered {
    inset-inline-end: auto;
    inset-inline-start: 50%;
    transform: translateX(-50%);
  }

  .lang-option {
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
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
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
    box-shadow: inset 0 0 0 1.5px var(--line-3, rgba(255, 255, 255, 0.22));
  }

  .lang-box.on {
    background: var(--accent, #ff5672);
    box-shadow: inset 0 0 0 1.5px var(--accent, #ff5672);
  }

  .lang-check {
    width: 11px;
    height: 11px;
    background: var(--on-accent, #2e0512);
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
    color: var(--ink, #ececf1);
  }

  .lang-count {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4, #7c7c8c);
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
    color: var(--ink-4, #7c7c8c);
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
    color: var(--ink, #ececf1);
  }

  .empty-body {
    max-width: 380px;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
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
    background: var(--surface-2, #141419);
    border: 1px solid var(--line-2, rgba(255, 255, 255, 0.09));
    overflow: hidden;
    cursor: pointer;
  }

  .big-card:hover,
  .card:hover {
    border-color: var(--line-3, rgba(255, 255, 255, 0.2));
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
    color: var(--status-chit, #ffb03d);
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
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .big-name {
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
  }

  .big-meta {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .big-about {
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    text-wrap: pretty;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }

  .big-channels {
    font: var(--weight-medium) var(--text-sm) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    background: var(--accent, #ff5672);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--on-accent, #2e0512);
  }

  .cta-hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .invite-only {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 32px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  /* small card */
  .card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: var(--radius-lg);
    background: var(--surface-2, #141419);
    box-sizing: border-box;
    border: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
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
    border: 4px solid var(--surface-2, #141419);
  }

  .tag {
    margin-top: var(--space-10);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: 24px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .tag.joined {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 14%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .card-name {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
  }

  .card-about {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    border-top: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
    background: var(--overlay-1, rgba(255, 255, 255, 0.02));
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .card-cta {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
  }

  .card-cta.muted {
    color: var(--ink-4, #7c7c8c);
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
    background: radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--accent, #ff5672) 10%, transparent), transparent 70%);
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
    color: var(--ink, #ececf1);
    text-wrap: balance;
  }

  .hero-sub {
    font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    color: var(--ink-3, #9a9aa8);
  }

  .hero-divider {
    width: 1px;
    height: 16px;
    background: var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .create-link {
    font-weight: var(--weight-semibold);
    color: var(--accent, #ff5672);
    cursor: pointer;
  }

  /* home: popular */
  .popular-wrap {
    display: flex;
    justify-content: center;
    padding: 0 var(--space-32) var(--space-26);
    animation: ex-rise 380ms 60ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
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
    color: var(--ink, #ececf1);
  }

  .popular-sub {
    flex: none;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
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
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    overflow: hidden;
  }

  .table-head {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    flex-wrap: wrap;
    padding: var(--space-14) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .table-title {
    flex: 1 1 200px;
    min-width: 0;
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .table-count {
    font-weight: var(--weight-regular);
    color: var(--ink-4, #7c7c8c);
  }

  .clear-filters {
    flex: none;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .sorts {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .sort {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-sm);
    background: transparent;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .sort.on {
    background: var(--overlay-2, rgba(255, 255, 255, 0.1));
    color: var(--ink, #ececf1);
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
    color: var(--ink-4, #6e6e7c);
  }

  .entry {
    align-items: center;
    min-height: 80px;
    padding: var(--space-14) var(--space-18);
    box-sizing: border-box;
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.05));
    cursor: pointer;
  }

  .entry:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
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
    color: var(--ink-3, #9a9aa8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mono,
  .entry-lang {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-2, #c9c9d4);
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
    background: var(--overlay-2, rgba(255, 255, 255, 0.07));
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .pill.joined {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 14%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .preview,
  .load-more {
    display: flex;
    align-items: center;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .preview {
    height: 32px;
    padding: 0 var(--space-14);
  }

  .preview:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-18) var(--space-18) var(--space-22);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.05));
  }

  .load-more {
    gap: var(--space-8);
    height: 38px;
    padding: 0 var(--space-18);
    font-size: var(--text-md);
  }

  .load-more:hover {
    background: var(--overlay-3, rgba(255, 255, 255, 0.13));
  }

  .shown {
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .table-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-32) var(--space-18);
    text-align: center;
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.05));
  }

  .table-empty-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .table-empty-body {
    max-width: 360px;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
    text-wrap: pretty;
  }

  /* guest banner */
  .guest-wrap {
    position: sticky;
    bottom: 0;
    z-index: 6;
    display: flex;
    justify-content: center;
    padding: var(--space-16) var(--space-16) var(--space-18);
    pointer-events: none;
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
    background: color-mix(in oklch, var(--accent, #ff5672) 10%, var(--surface-2, #191921));
    box-shadow:
      inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 30%, transparent),
      0 18px 44px rgba(0, 0, 0, 0.5);
    animation: ex-rise 420ms 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .guest-logo {
    flex: none;
    display: block;
    width: 40px;
    height: 40px;
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
    color: var(--ink, #ececf1);
  }

  .guest-body {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
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
    color: var(--ink, #ececf1);
    cursor: pointer;
    user-select: none;
  }

  .sign-in:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .create-account {
    padding: 0 var(--space-18);
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
  }

  .create-account:hover {
    filter: brightness(1.08);
  }
</style>
