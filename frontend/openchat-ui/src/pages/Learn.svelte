<!-- Learn page, mounted directly on its route (outside the app shell) and its own theme root (`mode`, `accent`).
     Sub-pages: Roadmap (expandable timeline), Whitepaper and Architecture (docs with an "On this page" index),
     Blog (list, then an article) and FAQs (searchable accordion). Content comes from `content` (placeholder copy by
     default; see learnContent.ts for the shapes a host loads from markdown / JSON).
     Which sub-page shows: the host decides through `page` (and `post`) when it routes its own paths (/roadmap,
     /blog/:slug …); without `page` the URL hash does (#faq, #blog/<slug>), so deep links work either way. A host that
     sets `page` also gives learnPageHref, its paths for the links (hash links otherwise); there onNavigate takes the
     click instead of the link when given. A doc sub-page the content doesn't have shows the roadmap.
     Sign in / Create account open AuthDialog with the host's `auth` callbacks, as on Landing. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { useT } from '../lib/i18n';
  import Icon from '../lib/components/Icon.svelte';
  import Logo from '../lib/components/Logo.svelte';
  import AuthDialog from '../features/components/AuthDialog.svelte';
  import { PageAuthState, type PageAuth } from './pageAuth.svelte';
  import { cssUrl } from '../lib/cssUrl';
  import { prefersReducedMotion } from './heroBackground';
  import { learnFromHash, learnHashHref, learnPagesOf, placeholderLearnContent, type LearnContent, type LearnPage, type RoadmapItem } from './learnContent';
  import type { PageAccent, PageMode } from './types';

  interface CommonProps {
    mode?: PageMode;
    accent?: PageAccent;
    /** The logo and "Back to home" link. */
    homeHref?: string;
    /** Where a successful sign-in goes when there is no onEnterApp. */
    appHref?: string;
    exploreHref?: string;
    learnHref?: string;
    /** Called on every sub-page or post change: a click, and in hash mode Back / Forward or an edited hash too (not the sub-page it opens on). When the host sets `page`, it handles the click (no link navigation). */
    onNavigate?: (page: LearnPage, post?: string) => void;
    content?: LearnContent;
    /** AuthDialog's host callbacks (onMethod, onSignup, onRequestEmailLink, checkUsername …). onMethod and onSignup return a promise; when it resolves the page enters the app, even if the dialog was closed meanwhile (once per sign-in). */
    auth?: PageAuth;
    /** Called after a successful sign-in instead of navigating to appHref. */
    onEnterApp?: () => void;
  }

  /** The URL hash picks the sub-page; links are learnHref + '#page' ('#blog/<slug>'). */
  interface HashRouted {
    page?: undefined;
    post?: undefined;
    /** Ignored: hash links work without the host's routes. */
    learnPageHref?: (page: LearnPage, post?: string) => string;
  }

  /** The host routes its own paths and says which sub-page shows. */
  interface HostRouted {
    /** The sub-page to show. */
    page: LearnPage;
    /** With page 'blog': the open post's slug. */
    post?: string;
    /** The host's path for a sub-page (or a blog post). Required: a hash link would land on a route that ignores the hash. */
    learnPageHref: (page: LearnPage, post?: string) => string;
  }

  type Routing = HashRouted | HostRouted;
  type Props = CommonProps & Routing;

  let {
    mode = 'dark',
    accent = 'pink',
    homeHref = '/',
    appHref = '/home',
    exploreHref = '/communities',
    learnHref = '/learn',
    page,
    post,
    learnPageHref,
    onNavigate,
    content = placeholderLearnContent,
    auth,
    onEnterApp,
  }: Props = $props();
  const t = useT();

  const COVERS = ['var(--cover-amber)', 'var(--cover-teal)', 'var(--cover-violet)', 'var(--cover-plum)', 'var(--cover-slate)'];
  const SHARE_COLOURS = ['var(--accent)', 'var(--category-c)', 'var(--category-a)', 'var(--ink-4)'];

  // the hash route, used when the host doesn't set `page`
  let fromHash = $state<{ page: LearnPage; post?: string }>({ page: 'roadmap' });
  const tabs = $derived(learnPagesOf(content));
  // a doc the content doesn't have (a deep link, or a stale link from Landing) falls back to the roadmap
  const current = $derived.by(() => {
    const p = page ?? fromHash.page;
    return tabs.includes(p) ? p : 'roadmap';
  });
  const openSlug = $derived(page !== undefined ? post : fromHash.post);

  let faqQuery = $state('');
  // FAQ open state, keyed by group and question (the same question can sit in two groups)
  const faqOpen = $state<Record<string, boolean>>({});
  const roadOpen = $state<Record<string, boolean>>({});

  const authState = new PageAuthState(() => ({ auth, onEnterApp, appHref }));

  const doc = $derived(current === 'whitepaper' || current === 'architecture' ? content.docs[current] : undefined);
  const openPost = $derived(current === 'blog' && openSlug ? (content.posts.find((p) => p.slug === openSlug) ?? null) : undefined);

  const roadNext = $derived(content.roadmap.filter((r) => r.status === 'next'));
  // done items grouped by year, years in the order they first appear in the content
  const roadYears = $derived.by(() => {
    const years = new Map<string, RoadmapItem[]>();
    for (const item of content.roadmap) {
      if (item.status !== 'done') continue;
      const year = item.year ?? '';
      const items = years.get(year);
      if (items) items.push(item);
      else years.set(year, [item]);
    }
    return [...years].map(([year, items]) => ({ year, items }));
  });
  const roadKey = (r: RoadmapItem) => `${r.year}/${r.when}/${r.title}`;

  const faqSearch = $derived(faqQuery.trim().toLowerCase());
  // while searching every match starts open; closing one only lasts for that query, so faqOpen is untouched
  let faqClosedInSearch = $derived.by((): Record<string, boolean> => {
    void faqSearch;
    return {};
  });
  const faqGroups = $derived(
    content.faq
      .map((g) => ({
        title: g.title,
        items: g.items.filter((it) => !faqSearch || `${it.q} ${it.a}`.toLowerCase().includes(faqSearch)).map((it) => ({ ...it, key: JSON.stringify([g.title, it.q]) })),
      }))
      .filter((g) => g.items.length),
  );

  // in hash mode the links are hash links, so a click and an opened-in-new-tab link land on the same sub-page
  const linkFor = (p: LearnPage, slug?: string) => (page !== undefined && learnPageHref ? learnPageHref(p, slug) : learnHashHref(learnHref, p, slug));

  function go(e: MouseEvent, p: LearnPage, slug?: string) {
    // a modified or non-primary click (new tab, new window …) is the browser's, on the link's own href
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (page !== undefined) {
      // host-routed: the host navigates (and scrolls, as its router does) when it takes the click, otherwise the link does
      if (!onNavigate) return;
      e.preventDefault();
      onNavigate(p, slug);
      return;
    }
    e.preventDefault();
    fromHash = { page: p, post: slug };
    const hash = learnHashHref('', p, slug);
    // a fragment navigation, as the link itself would make: the browser adds the entry (the current one keeps its state)
    // and a host router sees the hashchange. Learn's own hashchange read then finds the sub-page already showing.
    if (location.hash !== hash) location.hash = hash;
    onNavigate?.(p, slug);
    window.scrollTo?.(0, 0);
  }

  function toggleFaq(key: string) {
    if (faqSearch) faqClosedInSearch = { ...faqClosedInSearch, [key]: !faqClosedInSearch[key] };
    else faqOpen[key] = !faqOpen[key];
  }

  // the open doc's sections, for the index: looked up here rather than by id in the document, where the host's own
  // ids could match the content's
  const sectionEls: HTMLElement[] = $state([]);

  function jumpTo(i: number) {
    sectionEls[i]?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // the hash routes only while the host doesn't set `page`, which it may start or stop doing after mount
  const hashRouted = $derived(page === undefined);
  $effect(() => {
    if (!hashRouted) return;
    // no hash (back to the entry the page opened on) is the roadmap; an unknown one leaves the sub-page as it is.
    // A change tells the host (Back / Forward, an edited hash); the sub-page the page opens on doesn't, and a click's
    // own hashchange finds its sub-page already showing (go() told the host).
    const read = (notify: boolean) => {
      const next = learnFromHash(location.hash) ?? (location.hash.replace(/^#/, '') ? null : { page: 'roadmap' as const });
      if (!next || (next.page === fromHash.page && next.post === fromHash.post)) return;
      fromHash = next;
      if (notify) onNavigate?.(next.page, next.post);
    };
    const follow = () => read(true);
    untrack(() => read(false));
    window.addEventListener('hashchange', follow);
    window.addEventListener('popstate', follow);
    return () => {
      window.removeEventListener('hashchange', follow);
      window.removeEventListener('popstate', follow);
    };
  });
</script>

<div class="page" data-oc-page="learn" data-mode={mode} data-accent={accent}>
  <header class="top">
    <div class="top-inner">
      <a class="brand" href={homeHref}><Logo size={30} /><span class="brand-name">OpenChat</span></a>
      <nav class="tabs" aria-label={t('ui.learn.navLabel')}>
        {#each tabs as p}
          <a class="tab" class:on={p === current} href={linkFor(p)} aria-current={p === current ? 'page' : undefined} onclick={(e) => go(e, p)}>{t(`ui.learn.tabs.${p}`)}</a>
        {/each}
      </nav>
      <div class="auth">
        <button class="sign-in" onclick={() => authState.open('login')}>{t('ui.landing.signIn')}</button>
        <button class="create" onclick={() => authState.open('signup')}>{t('ui.landing.createAccount')}</button>
      </div>
    </div>
  </header>

  <main class="main">
    {#if doc}
      <div class="doc">
        <aside class="toc">
          <span class="toc-heading">{t('ui.learn.onThisPage')}</span>
          {#each doc.sections as s, i}
            <button class="toc-item" onclick={() => jumpTo(i)}><span class="num">{String(i + 1).padStart(2, '0')}</span>{s.title}</button>
          {/each}
        </aside>
        <article class="doc-body">
          <div class="doc-head">
            <span class="kicker">{doc.kicker}</span>
            <h1 class="h1">{doc.title}</h1>
            <p class="doc-lede">{doc.lede}</p>
          </div>
          {#if doc.stats?.length}
            <div class="stats">
              {#each doc.stats as st}
                <div class="stat"><span class="stat-value">{st.value}</span><span class="stat-label">{st.label}</span></div>
              {/each}
            </div>
          {/if}
          {#each doc.sections as sec, i}
            <section class="doc-section" id="learn-{sec.id}" bind:this={sectionEls[i]}>
              <h2 class="h2"><span class="h2-num">{String(i + 1).padStart(2, '0')}</span>{sec.title}</h2>
              {#each sec.paras as p}<p class="para">{p}</p>{/each}
              {#if sec.figure === 'allocation' && doc.allocation?.length}
                <figure class="figure" aria-label={t('ui.learn.allocation')}>
                  <div class="share-bar">
                    {#each doc.allocation as a, j}<span style:width="{a.share}%" style:background={SHARE_COLOURS[j % SHARE_COLOURS.length]}></span>{/each}
                  </div>
                  <div class="share-legend">
                    {#each doc.allocation as a, j}
                      <span class="share-item"
                        ><span class="share-swatch" style:background={SHARE_COLOURS[j % SHARE_COLOURS.length]}></span><span class="share-value">{a.share}%</span>{a.label}</span
                      >
                    {/each}
                  </div>
                </figure>
              {/if}
              {#if sec.figure === 'canisters' && doc.canisters?.length}
                <figure class="figure">
                  <figcaption class="figure-caption">{t('ui.learn.canisters')}</figcaption>
                  <div class="canisters">
                    {#each doc.canisters as c}
                      <div class="canister" class:core={c.core}><span class="canister-name">{c.name}</span><span class="canister-role">{c.role}</span></div>
                    {/each}
                  </div>
                </figure>
              {/if}
              {#if sec.list?.length}
                <ul class="bullets">
                  {#each sec.list as li}<li><span class="bullet"></span><span>{li}</span></li>{/each}
                </ul>
              {/if}
              {#if sec.code}<pre class="code">{sec.code}</pre>{/if}
            </section>
          {/each}
          <div class="doc-foot">{doc.foot}{#if doc.source}<a class="link" href={doc.source.href}>{doc.source.label}</a>{/if}</div>
        </article>
      </div>
    {:else if current === 'blog' && openPost !== undefined}
      <article class="article">
        <a class="back" href={linkFor('blog')} onclick={(e) => go(e, 'blog')}><Icon icon="back" flip />{t('ui.learn.blog.allPosts')}</a>
        {#if openPost}
          <h1 class="h1 article-title">{openPost.title}</h1>
          <span class="byline"><span class="author">{openPost.author ?? t('ui.learn.blog.team')}</span><span class="sep"></span>{openPost.date ?? t('ui.learn.blog.recent')}</span>
          <div
            class="article-cover"
            style:background={openPost.cover ? `center/cover ${cssUrl(openPost.cover)}` : COVERS[content.posts.indexOf(openPost) % COVERS.length]}
          ></div>
          {#each openPost.body as b}<p class="article-para">{b}</p>{/each}
        {:else}
          <p class="article-para">{t('ui.learn.blog.notFound')}</p>
        {/if}
      </article>
    {:else if current === 'blog'}
      <div class="wide stack-40">
        <div class="intro">
          <span class="kicker">{t('ui.learn.blog.kicker')}</span>
          <h1 class="h1">{t('ui.learn.blog.title')}</h1>
          <p class="intro-sub">{t('ui.learn.blog.sub')}</p>
        </div>
        <div class="posts">
          {#each content.posts as p, i}
            <a class="post" href={linkFor('blog', p.slug)} onclick={(e) => go(e, 'blog', p.slug)}>
              <span class="post-cover" style:background={p.cover ? `center/cover ${cssUrl(p.cover)}` : COVERS[i % COVERS.length]}></span>
              <span class="post-text">
                <span class="post-title">{p.title}</span>
                <span class="post-excerpt">{p.excerpt}</span>
                <span class="byline small"><span class="author">{p.author ?? t('ui.learn.blog.team')}</span><span class="sep"></span>{p.date ?? t('ui.learn.blog.recent')}</span>
              </span>
            </a>
          {/each}
        </div>
      </div>
    {:else if current === 'roadmap'}
      <div class="roadmap stack-56">
        <div class="intro">
          <span class="kicker">{t('ui.learn.roadmap.kicker')}</span>
          <h1 class="h1">{t('ui.learn.roadmap.title')}</h1>
          <p class="intro-sub">{t('ui.learn.roadmap.sub')}</p>
        </div>
        {#if roadNext.length}
          <section class="road-section">
            <span class="road-heading"><span class="road-dot ring"></span>{t('ui.learn.roadmap.upNext')}</span>
            <div class="next">
              {#each roadNext as n}
                <div class="next-card"><span class="next-kicker">{t('ui.learn.roadmap.future')}</span><span class="next-title">{n.title}</span></div>
              {/each}
            </div>
          </section>
        {/if}
        <section class="road-section">
          <span class="road-heading spaced"><span class="road-dot"></span>{t('ui.learn.roadmap.planned')}</span>
          {#each roadYears as y}
            <div class="year">
              <span class="year-label">{y.year}</span>
              <div class="year-items">
                <span class="year-line"></span>
                {#each y.items as it}
                  {@const key = roadKey(it)}
                  {@const open = !!it.detail && !!roadOpen[key]}
                  <div class="road-item">
                    <span class="item-dot" class:milestone={it.milestone}></span>
                    <button class="item-button" class:expandable={!!it.detail} disabled={!it.detail} aria-expanded={it.detail ? open : undefined} onclick={() => (roadOpen[key] = !roadOpen[key])}>
                      <span class="item-when">{it.when}</span>
                      <span class="item-title" class:milestone={it.milestone}>{it.title}</span>
                      {#if it.detail}<span class="item-chev" class:open><Icon icon="chevron-down" size={18} /></span>{/if}
                    </button>
                    {#if open && it.detail}
                      <div class="item-detail">
                        {#each it.detail.paras ?? [] as pp}<p class="para">{pp}</p>{/each}
                        {#if it.detail.points?.length}
                          <ul class="points">
                            {#each it.detail.points as pt}
                              <li>
                                <span class="bullet"></span>
                                {#if pt.href}<a class="point-link" href={pt.href} target="_blank" rel="noopener">{pt.label}<span class="ext-glyph"><Icon icon="external" size={12} /></span></a>{:else}<span class="point-text">{pt.label}</span>{/if}
                              </li>
                            {/each}
                          </ul>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      </div>
    {:else if current === 'faq'}
      <div class="faq stack-36">
        <div class="intro">
          <span class="kicker">{t('ui.learn.faq.kicker')}</span>
          <h1 class="h1">{t('ui.learn.faq.title')}</h1>
        </div>
        <label class="search">
          <Icon icon="search" size={18} color="var(--ink-3)" />
          <input class="search-input" type="search" bind:value={faqQuery} placeholder={t('ui.learn.faq.search')} aria-label={t('ui.learn.faq.search')} />
        </label>
        {#if faqSearch && !faqGroups.length}
          <span class="faq-empty">{t('ui.learn.faq.empty', { query: faqQuery.trim() })}</span>
        {/if}
        {#each faqGroups as g}
          <section class="faq-group">
            <h2 class="faq-heading">{g.title}</h2>
            {#each g.items as q}
              {@const open = faqSearch ? !faqClosedInSearch[q.key] : !!faqOpen[q.key]}
              <div class="question">
                <button class="question-button" aria-expanded={open} onclick={() => toggleFaq(q.key)}
                  ><span class="question-text">{q.q}</span><span class="item-chev" class:open><Icon icon="chevron-down" size={18} /></span></button
                >
                {#if open}<p class="answer">{q.a}</p>{/if}
              </div>
            {/each}
          </section>
        {/each}
      </div>
    {/if}
  </main>

  <footer class="footer">
    <div class="footer-inner">
      <span class="footer-brand"><Logo size={18} />{t('ui.learn.footer.governed')}</span>
      <span class="footer-links">
        <a class="link" href={exploreHref}>{t('ui.learn.footer.explore')}</a>
        <a class="link" href={homeHref}>{t('ui.learn.footer.home')}</a>
      </span>
    </div>
  </footer>

  {#if authState.kind}<AuthDialog {...authState.dialog} />{/if}
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--surface-0);
    color: var(--ink);
    font-family: var(--font-sans);
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font: inherit;
  }

  .link {
    font-weight: var(--weight-semibold);
    color: var(--accent);
  }

  /* ── header ── */
  .top {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    justify-content: center;
    padding: 0 var(--space-24);
    background: color-mix(in srgb, var(--surface-0) 85%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line-1);
  }

  .top-inner {
    width: 100%;
    max-width: 1200px;
    min-height: 68px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-24);
  }

  .brand {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    color: var(--ink);
  }



  .brand-name {
    font: var(--weight-bold) var(--text-2xl) / 1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .tabs {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }

  .tab {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .tab:hover {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .tab.on {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .auth {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .sign-in,
  .create {
    height: 40px;
    padding: 0 var(--space-14);
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    white-space: nowrap;
  }

  .sign-in {
    background: transparent;
    color: var(--ink);
  }

  .sign-in:hover {
    background: var(--overlay-1);
  }

  .create {
    padding: 0 var(--space-18);
    background: var(--accent);
    color: var(--on-accent);
  }

  .create:hover {
    filter: brightness(1.08);
  }

  /* ── shared ── */
  .main {
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 56px var(--space-24) 96px;
  }

  .stack-36 {
    gap: 36px;
  }

  .stack-40 {
    gap: 40px;
  }

  .stack-56 {
    gap: 56px;
  }

  .intro {
    max-width: 680px;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
  }

  .kicker {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .h1 {
    margin: 0;
    font: 800 clamp(36px, 4.6vw, 56px) / 1.05 var(--font-sans);
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .intro-sub,
  .doc-lede {
    margin: 0;
    font: var(--weight-regular) var(--text-lg) / 1.6 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .para {
    margin: 0;
    font: var(--weight-regular) var(--text-base) / 1.75 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .bullets,
  .points {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .bullets li,
  .points li {
    display: flex;
    align-items: baseline;
    gap: var(--space-12);
    font: var(--weight-regular) var(--text-base) / 1.6 var(--font-sans);
    color: var(--ink-2);
  }

  .bullet {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 2px;
    background: var(--accent);
    transform: translateY(-2px);
  }

  .item-chev {
    flex: none;
    display: flex;
    color: var(--ink-3);
    transition: transform 160ms var(--ease-standard);
  }

  .item-chev.open {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .item-chev {
      transition: none;
    }
  }

  /* ── docs ── */
  .doc {
    width: 100%;
    max-width: 1200px;
    display: grid;
    grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
    gap: 48px;
    align-items: start;
  }

  .toc {
    position: sticky;
    top: 100px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .toc-heading {
    padding: 0 var(--space-10) var(--space-10);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .toc-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    padding: var(--space-8) var(--space-10);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    text-align: start;
    font: var(--weight-medium) var(--text-md) / 1.35 var(--font-sans);
    color: var(--ink-3);
  }

  .toc-item:hover {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .num {
    flex: none;
    font: var(--weight-medium) var(--text-xs) / 1.35 var(--font-mono);
    color: var(--ink-4);
  }

  .doc-body {
    min-width: 0;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 56px;
  }

  .doc-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-12);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-18);
    border-radius: var(--radius-lg);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .stat-value {
    font: 800 26px / 1 var(--font-sans);
    letter-spacing: -0.03em;
  }

  .stat-label {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
  }

  .doc-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    scroll-margin-top: 96px;
  }

  .h2 {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-14);
    font: var(--weight-bold) clamp(24px, 2.6vw, 30px) / 1.2 var(--font-sans);
    letter-spacing: -0.02em;
  }

  .h2-num {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--accent);
  }

  .figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-14);
    padding: 20px;
    border-radius: var(--radius-lg);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .share-bar {
    display: flex;
    gap: var(--space-2);
    height: 14px;
    overflow: hidden;
    border-radius: var(--radius-pill);
  }

  .share-legend {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-10) 20px;
  }

  .share-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-10);
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-2);
  }

  .share-swatch {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }

  .share-value {
    flex: none;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-mono);
    color: var(--ink);
  }

  .figure-caption {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .canisters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-8);
  }

  .canister {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-12) var(--space-14);
    border-radius: 10px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .canister.core {
    background: color-mix(in oklch, var(--accent) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .canister-name {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .canister-role {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-3);
  }

  .code {
    margin: 0;
    padding: var(--space-16) var(--space-18);
    overflow-x: auto;
    border-radius: var(--radius-md);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: var(--weight-medium) var(--text-md) / 1.6 var(--font-mono);
    color: var(--ink);
  }

  .doc-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-12);
    padding-top: var(--space-24);
    border-top: 1px solid var(--line-1);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
  }

  /* ── blog ── */
  .wide {
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
  }

  .posts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: var(--space-16);
  }

  .post {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    color: var(--ink);
  }

  .post:hover {
    box-shadow: inset 0 0 0 1px var(--line-3);
  }

  .post-cover {
    display: block;
    height: 150px;
  }

  .post-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: 20px var(--space-22) var(--space-22);
  }

  .post-title {
    font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .post-excerpt {
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .byline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6) var(--space-10);
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-3);
  }

  .byline.small {
    margin-top: var(--space-4);
    font-size: var(--text-sm);
  }

  .author {
    font-weight: var(--weight-semibold);
    color: var(--accent);
  }

  .sep {
    width: 3px;
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--ink-4);
  }

  .article {
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
  }

  .back {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 36px;
    padding: 0 var(--space-12) 0 var(--space-8);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .back:hover {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .article-title {
    font-size: clamp(32px, 4vw, 48px);
    line-height: 1.08;
  }

  .article-cover {
    height: 280px;
    border-radius: var(--radius-xl);
  }

  .article-para {
    margin: 0;
    font: var(--weight-regular) var(--text-lg) / 1.75 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  /* ── roadmap ── */
  .roadmap {
    width: 100%;
    max-width: 960px;
    display: flex;
    flex-direction: column;
  }

  .road-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .road-heading {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .road-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .road-dot.ring {
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .next {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: var(--space-12);
  }

  .next-card {
    min-height: 120px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 28px;
    padding: 20px;
    border-radius: var(--radius-lg);
    border: 1px dashed color-mix(in oklch, var(--accent) 45%, transparent);
    background: color-mix(in oklch, var(--accent) 5%, transparent);
  }

  .next-kicker {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .next-title {
    font: var(--weight-bold) var(--text-xl) / 1.25 var(--font-sans);
    letter-spacing: -0.015em;
    text-wrap: balance;
  }

  .year {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: var(--space-8) 32px;
    align-items: start;
  }

  .year-label {
    position: sticky;
    top: 88px;
    font: 800 clamp(32px, 4vw, 44px) / 1 var(--font-sans);
    letter-spacing: -0.04em;
    color: var(--ink);
  }

  .year-items {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: var(--space-4) 0 40px 28px;
  }

  .year-line {
    position: absolute;
    inset-inline-start: 5px;
    top: 0;
    bottom: 0;
    width: 2px;
    border-radius: 2px;
    background: var(--line-2);
  }

  .road-item {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .item-dot {
    position: absolute;
    inset-inline-start: -28px;
    top: 21px;
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    border-radius: var(--radius-pill);
    background: var(--surface-0);
    box-shadow:
      0 0 0 4px var(--surface-0),
      inset 0 0 0 2px var(--accent);
  }

  .item-dot.milestone {
    background: var(--accent);
    box-shadow:
      0 0 0 4px var(--surface-0),
      0 0 0 6px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .item-button {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-6) var(--space-16);
    margin-inline-start: -8px;
    padding: var(--space-14) var(--space-12) var(--space-14) var(--space-8);
    border: 0;
    border-radius: 10px;
    background: transparent;
    text-align: start;
    color: var(--ink);
  }

  .item-button.expandable {
    cursor: pointer;
  }

  .item-button.expandable:hover {
    background: var(--overlay-1);
  }

  .item-button:disabled {
    cursor: default;
    color: var(--ink);
  }

  .item-when {
    flex: none;
    min-width: 52px;
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .item-title {
    flex: 1 1 240px;
    font: var(--weight-semibold) clamp(19px, 2vw, 24px) / 1.3 var(--font-sans);
    letter-spacing: -0.015em;
    text-wrap: balance;
  }

  .item-title.milestone {
    font-weight: var(--weight-bold);
  }

  .item-button .item-chev {
    align-self: center;
  }

  .item-detail {
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-4) 0 20px 68px;
  }

  .points li {
    line-height: 1.5;
    color: var(--ink);
  }

  .point-link {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-6);
    font-weight: var(--weight-medium);
    color: var(--accent);
  }

  .point-text {
    color: var(--ink);
  }

  .ext-glyph {
    flex: none;
    display: flex;
    transform: translateY(1px);
  }

  /* ── faq ── */
  .faq {
    width: 100%;
    max-width: 820px;
    display: flex;
    flex-direction: column;
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: 52px;
    padding: 0 var(--space-16);
    border-radius: var(--radius-lg);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: var(--weight-regular) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
  }

  .search-input::placeholder {
    color: var(--ink-4);
  }

  .faq-empty {
    font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
    color: var(--ink-3);
  }

  .faq-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .faq-heading {
    margin: 0 0 var(--space-6);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .question {
    border-radius: var(--radius-lg);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .question-button {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: var(--space-16);
    padding: var(--space-14) var(--space-18);
    border: 0;
    border-radius: var(--radius-lg);
    background: transparent;
    cursor: pointer;
    text-align: start;
    font: var(--weight-semibold) var(--text-base) / 1.4 var(--font-sans);
    color: var(--ink);
  }

  .question-text {
    flex: 1;
  }

  .answer {
    margin: 0;
    padding: 0 var(--space-18) var(--space-18);
    font: var(--weight-regular) var(--text-base) / 1.7 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  /* ── footer ── */
  .footer {
    display: flex;
    justify-content: center;
    padding: 32px var(--space-24);
    border-top: 1px solid var(--line-1);
  }

  .footer-inner {
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-16);
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  .footer-brand,
  .footer-links {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .footer-links {
    gap: var(--space-18);
  }

  @media (max-width: 860px) {
    .doc {
      grid-template-columns: minmax(0, 1fr);
    }

    .toc {
      position: static;
    }
  }

  @media (max-width: 640px) {
    .top,
    .main,
    .footer {
      padding-inline: var(--space-16);
    }

    .top-inner {
      gap: var(--space-8) var(--space-12);
      padding: var(--space-12) 0;
    }

    /* one row of tabs that scrolls sideways */
    .tabs {
      order: 3;
      flex-basis: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tab {
      flex: none;
    }

    .auth {
      margin-inline-start: auto;
    }

    .main {
      padding-top: 40px;
    }

    .year {
      grid-template-columns: minmax(0, 1fr);
    }

    .year-label {
      position: static;
    }

    .item-detail {
      padding-inline-start: var(--space-8);
    }
  }
</style>
