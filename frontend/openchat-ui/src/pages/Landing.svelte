<!-- Landing page for signed-out visitors, mounted directly on its route (outside the app shell). It is its own theme
     root: `mode` and `accent` set data-mode / data-accent, and the header's theme controls override them on the page
     until the host passes new values (onModeChange / onAccentChange report each pick, e.g. to save it).
     Sections: hero (hexagon backdrop, product shot), native apps, features, communities, governance, final call to
     action, footer. Links point at the host's routes (homeHref, exploreHref, learnHref or learnPageHref …).
     Sign in / Create account open AuthDialog with the host's `auth` callbacks; a successful sign-in calls onEnterApp
     (or goes to appHref). -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { useT } from '../lib/i18n';
  import Translate from '../lib/components/Translate.svelte';
  import Avatar from '../lib/components/Avatar.svelte';
  import AuthDialog from '../features/components/AuthDialog.svelte';
  import { HeroBackground, type HeroStyle } from './heroBackground';
  import { PageAuthState, type PageAuth } from './pageAuth.svelte';
  import { LEARN_PAGES, learnHashHref, type LearnPage } from './learnContent';
  import { PAGE_ACCENTS, type LandingCommunity, type PageAccent, type PageMode } from './types';

  interface Props {
    mode?: PageMode;
    accent?: PageAccent;
    /** Hero backdrop: ripples, a drifting band, or none. Reduced motion always gets one still frame. */
    heroBg?: HeroStyle;
    /** The logo link. */
    homeHref?: string;
    /** Where a successful sign-in goes when there is no onEnterApp. */
    appHref?: string;
    exploreHref?: string;
    learnHref?: string;
    /** Link to a Learn sub-page; defaults to learnHref + '#page'. Map your own paths (/roadmap, /faq …) here. */
    learnPageHref?: (page: LearnPage) => string;
    /** The Learn sub-pages to link in the menu and footer; pass learnPagesOf(content) when the host's Learn content leaves a doc out. */
    learnPages?: LearnPage[];
    /** Featured communities for the Communities section; without any, only its heading and Browse link show. */
    communities?: LandingCommunity[];
    /** Android Play Store build; without it that choice isn't a link. */
    playStoreHref?: string;
    /** Android full (APK) build; without it that choice isn't a link. */
    apkHref?: string;
    /** "See open proposals"; hidden without it. */
    proposalsHref?: string;
    termsHref?: string;
    privacyHref?: string;
    /** AuthDialog's host callbacks (onMethod, onSignup, onRequestEmailLink, checkUsername …). */
    auth?: PageAuth;
    /** Called after a successful sign-in instead of navigating to appHref. */
    onEnterApp?: () => void;
    onModeChange?: (mode: PageMode) => void;
    onAccentChange?: (accent: PageAccent) => void;
  }

  let {
    mode = 'dark',
    accent = 'pink',
    heroBg = 'pulse',
    homeHref = '/',
    appHref = '/home',
    exploreHref = '/communities',
    learnHref = '/learn',
    learnPageHref,
    learnPages = LEARN_PAGES,
    communities = [],
    playStoreHref,
    apkHref,
    proposalsHref,
    termsHref = '/terms',
    privacyHref = '/privacy',
    auth,
    onEnterApp,
    onModeChange,
    onAccentChange,
  }: Props = $props();
  const t = useT();

  const FEATURES = [
    { key: 'communities', icon: 'community' },
    { key: 'crypto', icon: 'currency' },
    { key: 'noPhone', icon: 'key' },
    { key: 'gates', icon: 'gate' },
    { key: 'calls', icon: 'video', diamond: true },
    { key: 'bots', icon: 'bot' },
  ];
  const STEPS = ['propose', 'vote', 'ship'];
  const SECTIONS = ['features', 'communities', 'governance'];
  const COVERS = ['var(--cover-amber)', 'var(--cover-teal)', 'var(--cover-violet)', 'var(--cover-plum)'];
  const SHOT_CHANNELS = [
    { key: 'proposals', color: 'violet', on: true },
    { key: 'announcements', color: 'amber', on: false },
    { key: 'general', color: 'blue', on: false },
  ] as const;

  // the header's theme controls override the props until the host passes a new value
  let modeOverride = $derived.by((): PageMode | null => {
    void mode;
    return null;
  });
  let accentOverride = $derived.by((): PageAccent | null => {
    void accent;
    return null;
  });
  const shownMode = $derived(modeOverride ?? mode);
  const shownAccent = $derived(accentOverride ?? accent);

  let learnOpen = $state(false);
  let accentOpen = $state(false);
  let learnMenu: HTMLElement | undefined = $state();
  let accentMenu: HTMLElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();

  const authState = new PageAuthState(() => ({ auth, onEnterApp, appHref }));

  const learnLink = (page: LearnPage) => (learnPageHref ? learnPageHref(page) : learnHashHref(learnHref, page));
  // 62504 → '62.5K'; the unit is chosen after rounding, so 999950 is '1M', not '1000K'
  const fmt = (n: number) => {
    if (n < 1e3) return String(n);
    let v = n;
    for (const unit of ['K', 'M', 'B']) {
      v /= 1e3;
      const rounded = +v.toFixed(1);
      if (rounded < 1e3 || unit === 'B') return `${rounded}${unit}`;
    }
    return String(n);
  };

  function toggleMode() {
    const next: PageMode = shownMode === 'dark' ? 'light' : 'dark';
    modeOverride = next;
    onModeChange?.(next);
  }

  function pickAccent(next: PageAccent) {
    accentOverride = next;
    accentOpen = false;
    onAccentChange?.(next);
  }

  function openAuth(kind: 'login' | 'signup') {
    learnOpen = accentOpen = false;
    authState.open(kind);
  }

  // menus close on a press outside them, and on Esc
  onMount(() => {
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (learnOpen && !learnMenu?.contains(target)) learnOpen = false;
      if (accentOpen && !accentMenu?.contains(target)) accentOpen = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (learnOpen || accentOpen)) learnOpen = accentOpen = false;
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  });

  let backdrop: HeroBackground | null = null;
  $effect(() => {
    if (!canvas) return;
    backdrop = HeroBackground.create(canvas, () => ({ style: heroBg, light: shownMode === 'light' }));
    return () => {
      backdrop?.destroy();
      backdrop = null;
    };
  });
  // the backdrop reads its colours from the theme root, so it re-reads them once a new mode or accent has applied
  $effect(() => {
    void shownMode;
    void shownAccent;
    void heroBg;
    const timer = setTimeout(() => backdrop?.resize(), 0);
    return () => clearTimeout(timer);
  });
</script>

{#snippet glyph(name: string, cls = '')}<span class="glyph {cls}" style:mask="var(--icon-{name}) center/contain no-repeat" aria-hidden="true"></span>{/snippet}

<div class="page" data-oc-page="landing" data-mode={shownMode} data-accent={shownAccent}>
  <header class="top">
    <div class="top-inner">
      <a class="brand" href={homeHref}>
        <img class="logo" src="assets/openchat-logo.svg" alt="" width="30" height="30" />
        <span class="brand-name">OpenChat</span>
      </a>
      <nav class="nav" aria-label={t('ui.landing.nav.label')}>
        {#each SECTIONS as s}
          <a class="nav-link section-link" href="#{s}">{t(`ui.landing.nav.${s}`)}</a>
        {/each}
        <div class="menu-anchor" bind:this={learnMenu}>
          <button
            class="nav-link learn-button"
            class:open={learnOpen}
            aria-haspopup="menu"
            aria-expanded={learnOpen}
            onclick={() => {
              learnOpen = !learnOpen;
              accentOpen = false;
            }}>{t('ui.landing.nav.learn')}{@render glyph('chevron-down', 'chev')}</button
          >
          {#if learnOpen}
            <div class="menu learn-menu" role="menu">
              {#each learnPages as p}
                <a class="learn-item" href={learnLink(p)} role="menuitem" onclick={() => (learnOpen = false)}>
                  <span class="learn-label">{t(`ui.learn.tabs.${p}`)}</span>
                  <span class="learn-hint">{t(`ui.landing.learnHints.${p}`)}</span>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </nav>
      <div class="theme">
        <div class="menu-anchor" bind:this={accentMenu}>
          <button
            class="theme-button accent-button"
            class:open={accentOpen}
            aria-haspopup="menu"
            aria-expanded={accentOpen}
            aria-label={t('ui.landing.theme.accent')}
            onclick={() => {
              accentOpen = !accentOpen;
              learnOpen = false;
            }}><span class="accent-dot"></span>{@render glyph('chevron-down', 'chev')}</button
          >
          {#if accentOpen}
            <div class="menu accent-menu" role="menu">
              <span class="menu-heading">{t('ui.landing.theme.accentHeading')}</span>
              {#each PAGE_ACCENTS as a}
                <button class="accent-item" role="menuitemradio" aria-checked={a === shownAccent} onclick={() => pickAccent(a)}>
                  <span class="swatch" data-mode={shownMode} data-accent={a}></span>
                  <span class="accent-name">{t(`ui.landing.theme.${a}`)}</span>
                  {@render glyph('check', a === shownAccent ? 'check on' : 'check')}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <span class="theme-rule"></span>
        <button
          class="theme-button mode-button"
          aria-label={t(shownMode === 'dark' ? 'ui.landing.theme.toLight' : 'ui.landing.theme.toDark')}
          title={t(shownMode === 'dark' ? 'ui.landing.theme.toLight' : 'ui.landing.theme.toDark')}
          onclick={toggleMode}>{@render glyph(shownMode === 'dark' ? 'sun' : 'moon', 'mode-glyph')}</button
        >
      </div>
      <div class="auth">
        <button class="sign-in" onclick={() => openAuth('login')}>{t('ui.landing.signIn')}</button>
        <button class="create" onclick={() => openAuth('signup')}>{t('ui.landing.createAccount')}</button>
      </div>
    </div>
  </header>

  <section class="hero">
    <canvas class="hero-canvas" bind:this={canvas} aria-hidden="true"></canvas>
    <span class="badge rise"><span class="badge-dot"></span>{t('ui.landing.hero.badge')}</span>
    <h1 class="hero-title rise">
      <Translate key="ui.landing.hero.title">
        {#snippet highlight()}<span class="hero-highlight">{t('ui.landing.hero.highlight')}</span>{/snippet}
      </Translate>
    </h1>
    <p class="hero-sub rise">{t('ui.landing.hero.sub')}</p>
    <div class="hero-actions rise">
      <a class="cta primary" href={exploreHref}>{t('ui.landing.hero.explore')}{@render glyph('arrow', 'cta-glyph')}</a>
      <a class="cta ghost" href="#download">{@render glyph('smartphone', 'cta-glyph')}{t('ui.landing.hero.nativeApp')}</a>
    </div>
    <div class="shot-wrap rise late" role="img" aria-label={t('ui.landing.shot.label')}>
      <div class="shot" aria-hidden="true">
        <div class="shot-rail">
          <span class="rail-home"></span>
          <span class="rail-on"><Avatar size={30} shape="squircle" color="amber" /></span>
          <Avatar size={30} shape="squircle" color="blue" />
          <Avatar size={30} shape="squircle" color="teal" />
        </div>
        <div class="shot-app">
          <div class="shot-list">
            <div class="shot-community">
              <Avatar size={36} shape="squircle" color="amber" />
              <div class="shot-text">
                <span class="shot-name">{t('ui.landing.shot.community')}</span>
                <span class="shot-meta">{@render glyph('globe', 'shot-meta-glyph')}{t('ui.landing.shot.communityMeta')}</span>
              </div>
              {@render glyph('kebab', 'shot-icon')}
            </div>
            <div class="shot-search">{@render glyph('search', 'shot-search-glyph')}<span>{t('ui.landing.shot.search')}</span></div>
            <span class="shot-heading">{t('ui.landing.shot.channels')}</span>
            {#each SHOT_CHANNELS as c}
              <div class="shot-channel" class:on={c.on}>
                <Avatar size={30} color={c.color} />
                <div class="shot-text">
                  <span class="shot-channel-name">{t(`ui.landing.shot.${c.key}`)}</span>
                  <span class="shot-preview">{t(`ui.landing.shot.${c.key}Preview`)}</span>
                </div>
              </div>
            {/each}
          </div>
          <div class="shot-chat">
            <div class="shot-header">
              <Avatar size={32} color="violet" />
              <div class="shot-text grow">
                <span class="shot-name small">{t('ui.landing.shot.proposals')}</span>
                <span class="shot-meta">{t('ui.landing.shot.channelMeta')}</span>
              </div>
              {#each ['search', 'pin', 'users', 'kebab'] as icon}<span class="shot-tool">{@render glyph(icon, 'shot-icon')}</span>{/each}
            </div>
            <div class="shot-messages">
              <span class="shot-day">{t('ui.landing.shot.today')}</span>
              <div class="shot-message">
                <Avatar size={30} color="plum" />
                <div class="shot-message-body">
                  <span class="shot-sender">{t('ui.landing.shot.sender')}</span>
                  <div class="proposal">
                    <div class="proposal-top">
                      <span class="proposal-kicker">{t('ui.landing.shot.proposalKicker')}</span>
                      <span class="proposal-open">{t('ui.landing.shot.proposalOpen')}</span>
                    </div>
                    <span class="proposal-title">{t('ui.landing.shot.proposalTitle')}</span>
                    <div class="proposal-tally">
                      <div class="tally-bar"><span class="yes"></span><span class="no"></span></div>
                      <span class="tally-text">82 / 18</span>
                    </div>
                    <div class="proposal-votes">
                      <span class="vote adopt">{t('ui.landing.shot.adopt')}</span>
                      <span class="vote reject">{t('ui.landing.shot.reject')}</span>
                    </div>
                    <span class="shot-time">10:42</span>
                  </div>
                </div>
              </div>
              <div class="shot-reply">
                <span>{t('ui.landing.shot.reply')}</span>
                <span class="shot-reply-time">10:44{@render glyph('check-double', 'ticks')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="hero-fade" aria-hidden="true"></div>
  </section>

  <section class="band" id="download">
    <div class="inner stack-32">
      <div class="intro">
        <span class="kicker">{t('ui.landing.apps.kicker')}</span>
        <h2 class="h2">{t('ui.landing.apps.title')}</h2>
        <p class="lede">{t('ui.landing.apps.sub')}</p>
      </div>
      <div class="apps">
        <div class="app-card android">
          <div class="app-head">
            <span class="app-icon">{@render glyph('smartphone', 'app-glyph')}</span>
            <span class="app-name">{t('ui.landing.apps.android')}</span>
            <span class="app-pill">{t('ui.landing.apps.betaOpen')}</span>
          </div>
          <div class="app-copy">
            <span class="app-lead">{t('ui.landing.apps.whichBuild')}</span>
            <span class="app-note">{t('ui.landing.apps.pickOne')}</span>
          </div>
          <div class="builds">
            {#each [{ href: playStoreHref, key: 'playStore' }, { href: apkHref, key: 'full' }] as b}
              <svelte:element this={b.href ? 'a' : 'div'} class="build" class:link={!!b.href} href={b.href}>
                <span class="build-title">{t(`ui.landing.apps.${b.key}`)}{#if b.href}{@render glyph('arrow', 'build-glyph')}{/if}</span>
                <span class="build-body">{t(`ui.landing.apps.${b.key}Body`)}</span>
              </svelte:element>
            {/each}
          </div>
        </div>
        <div class="app-card ios">
          <div class="app-head">
            <span class="app-icon">{@render glyph('smartphone', 'app-glyph')}</span>
            <span class="app-name">{t('ui.landing.apps.iphone')}</span>
            <span class="app-pill">{t('ui.landing.apps.comingSoon')}</span>
          </div>
          <div class="app-copy">
            <span class="app-lead">{t('ui.landing.apps.iosBuilding')}</span>
            <span class="app-note">
              <Translate key="ui.landing.apps.safari">
                {#snippet site()}<strong class="site">oc.app</strong>{/snippet}
              </Translate>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="band features-band" id="features">
    <div class="inner stack-40">
      <div class="intro narrow">
        <span class="kicker">{t('ui.landing.features.kicker')}</span>
        <h2 class="h2">{t('ui.landing.features.title')}</h2>
      </div>
      <div class="features">
        {#each FEATURES as f}
          <div class="feature">
            <span class="feature-icon">{@render glyph(f.icon, 'feature-glyph')}</span>
            <div class="feature-head">
              <span class="feature-title">{t(`ui.landing.features.${f.key}Title`)}</span>
              {#if f.diamond}<span class="feature-tag">{@render glyph('gem', 'tag-glyph')}{t('ui.landing.features.diamond')}</span>{/if}
            </div>
            <span class="feature-body">{t(`ui.landing.features.${f.key}Body`)}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="band communities-band" id="communities">
    <div class="inner stack-32">
      <div class="communities-head">
        <div class="intro grow">
          <span class="kicker">{t('ui.landing.communities.kicker')}</span>
          <h2 class="h2">{t('ui.landing.communities.title')}</h2>
        </div>
        <a class="browse" href={exploreHref}>{t('ui.landing.communities.browse')}{@render glyph('arrow', 'cta-glyph')}</a>
      </div>
      {#if communities.length}
        <div class="community-wrap">
          <div class="community-grid">
            {#each communities as c, i}
              <svelte:element this={c.href ? 'a' : 'div'} class="community" class:link={!!c.href} href={c.href}>
                <span class="community-cover" style:background={c.coverUrl ? `center/cover url("${encodeURI(c.coverUrl)}")` : COVERS[i % COVERS.length]}></span>
                <div class="community-body">
                  <span class="community-avatar">
                    {#if c.avatarUrl}<img src={c.avatarUrl} alt="" width="48" height="48" />{:else}<Avatar size={48} shape="squircle" color={c.color ?? 'amber'} />{/if}
                  </span>
                  <span class="community-name">{c.name}</span>
                  <span class="community-about">{c.about}</span>
                  <span class="community-members">{@render glyph('users', 'members-glyph')}{t('ui.landing.communities.members', { count: c.members, members: fmt(c.members) })}</span>
                </div>
              </svelte:element>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>

  <section class="band governance-band" id="governance">
    <div class="governance">
      <div class="governance-copy">
        <span class="kicker">{t('ui.landing.governance.kicker')}</span>
        <h2 class="h2">{t('ui.landing.governance.title')}</h2>
        <p class="governance-body">{t('ui.landing.governance.body')}</p>
        {#if proposalsHref}<a class="proposals" href={proposalsHref}>{t('ui.landing.governance.proposals')}{@render glyph('arrow', 'cta-glyph')}</a>{/if}
      </div>
      <ol class="steps">
        {#each STEPS as s, i}
          <li class="step">
            <span class="step-number">{i + 1}</span>
            <div class="step-copy">
              <span class="step-title">{t(`ui.landing.governance.${s}Title`)}</span>
              <span class="step-body">{t(`ui.landing.governance.${s}Body`)}</span>
            </div>
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <section class="band final">
    <div class="final-inner">
      <h2 class="final-title">{t('ui.landing.cta.title')}</h2>
      <p class="lede">{t('ui.landing.cta.body')}</p>
      <div class="final-actions">
        <button class="cta primary big" onclick={() => openAuth('signup')}>{t('ui.landing.cta.create')}{@render glyph('arrow', 'cta-glyph')}</button>
        <a class="final-explore" href={exploreHref}>{t('ui.landing.cta.explore')}</a>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="inner stack-36">
      <div class="footer-top">
        <div class="footer-brand">
          <span class="footer-name"><img class="logo small" src="assets/openchat-logo.svg" alt="" width="22" height="22" />OpenChat</span>
          <span class="footer-tagline">{t('ui.landing.footer.tagline')}</span>
        </div>
        <div class="footer-group">
          <span class="footer-heading">{t('ui.landing.footer.product')}</span>
          {#each SECTIONS as s}<a class="footer-link" href="#{s}">{t(`ui.landing.nav.${s}`)}</a>{/each}
          <a class="footer-link" href="#download">{t('ui.landing.footer.nativeApps')}</a>
        </div>
        <div class="footer-group">
          <span class="footer-heading">{t('ui.landing.footer.learn')}</span>
          {#each learnPages as p}<a class="footer-link" href={learnLink(p)}>{t(`ui.learn.tabs.${p}`)}</a>{/each}
        </div>
        <div class="footer-group">
          <span class="footer-heading">{t('ui.landing.footer.legal')}</span>
          <a class="footer-link" href={termsHref}>{t('ui.landing.footer.terms')}</a>
          <a class="footer-link" href={privacyHref}>{t('ui.landing.footer.privacy')}</a>
        </div>
      </div>
      <span class="footer-note">{t('ui.landing.footer.governed')}</span>
    </div>
  </footer>

  {#if authState.kind}<AuthDialog {...authState.dialog} />{/if}
</div>

<style>
  .page {
    min-height: 100vh;
    background: var(--surface-0);
    color: var(--ink);
    font-family: var(--font-sans);
    overflow-x: hidden;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font: inherit;
  }

  .glyph {
    flex: none;
    display: inline-block;
    width: 16px;
    height: 16px;
    background: currentColor;
  }

  /* ── header ── */
  .top {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    justify-content: center;
    padding: 0 var(--space-24);
    background: color-mix(in srgb, var(--surface-0) 82%, transparent);
    backdrop-filter: blur(12px);
    border-block-end: 1px solid var(--line-1);
  }

  .top-inner {
    width: 100%;
    max-width: 1200px;
    min-height: 68px;
    display: flex;
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

  .logo {
    display: block;
    width: 30px;
    height: 30px;
  }

  .logo.small {
    width: 22px;
    height: 22px;
  }

  .brand-name {
    font: var(--weight-bold) var(--text-2xl) / 1 var(--font-sans);
    letter-spacing: -0.01em;
  }

  .nav {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 36px;
    padding: 0 var(--space-12);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .nav-link:hover,
  .learn-button.open {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .chev {
    width: 12px;
    height: 12px;
    transition: transform var(--duration-fast) var(--ease-standard);
  }

  .open .chev {
    transform: rotate(180deg);
  }

  .menu-anchor {
    position: relative;
  }

  .menu {
    position: absolute;
    top: calc(100% + 8px);
    z-index: calc(var(--z-sticky) + 1);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-6);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
  }

  .learn-menu {
    inset-inline-start: 0;
    width: 260px;
  }

  .learn-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-10) var(--space-12);
    border-radius: var(--radius-md);
    color: var(--ink);
  }

  .learn-item:hover {
    background: var(--overlay-1);
  }

  .learn-label {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
  }

  .learn-hint {
    font: var(--weight-regular) var(--text-sm) / 1.35 var(--font-sans);
    color: var(--ink-3);
  }

  .theme {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 40px;
    padding: 0 var(--space-4);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .theme-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
    height: 32px;
    min-width: 32px;
    padding: 0 var(--space-8);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    color: var(--ink-2);
  }

  .mode-button {
    padding: 0;
  }

  .theme-button:hover,
  .accent-button.open {
    background: var(--overlay-1);
    color: var(--ink);
  }

  .accent-dot {
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .mode-glyph {
    width: 17px;
    height: 17px;
  }

  .theme-rule {
    width: 1px;
    height: 18px;
    margin: 0 var(--space-4);
    background: var(--line-2);
  }

  .accent-menu {
    inset-inline-end: -4px;
    top: calc(100% + 10px);
    width: 176px;
  }

  .menu-heading {
    padding: var(--space-8) var(--space-10) var(--space-6);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .accent-item {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 36px;
    padding: 0 var(--space-10);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
    text-align: start;
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .accent-item:hover {
    background: var(--overlay-1);
  }

  .swatch {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .accent-name {
    flex: 1;
  }

  .check {
    width: 14px;
    height: 14px;
    color: var(--ink-2);
    opacity: 0;
  }

  .check.on {
    opacity: 1;
  }

  .auth {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .sign-in,
  .create {
    display: flex;
    align-items: center;
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

  .create:hover,
  .cta.primary:hover {
    filter: brightness(1.08);
  }

  /* ── hero ── */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-18);
    padding: 124px var(--space-24) 0;
    overflow: hidden;
    isolation: isolate;
    text-align: center;
    background:
      radial-gradient(ellipse 75% 62% at 50% 0%, color-mix(in oklch, var(--accent) 18%, transparent), transparent 70%),
      radial-gradient(ellipse 30% 30% at 85% 70%, color-mix(in oklch, var(--category-a) 12%, transparent), transparent 70%);
  }

  .hero-canvas {
    position: absolute;
    inset: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    pointer-events: none;
    color: var(--ink);
  }

  .rise {
    animation: rise 500ms var(--ease-out) both;
  }

  .hero-title.rise {
    animation-delay: 40ms;
  }

  .hero-sub.rise {
    animation-delay: 80ms;
  }

  .hero-actions.rise {
    animation-delay: 120ms;
  }

  .rise.late {
    animation-duration: 700ms;
    animation-delay: 180ms;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rise {
      animation: none;
    }

    .chev {
      transition: none;
    }
  }

  .badge {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-8) var(--space-14);
    border-radius: var(--radius-pill);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-online);
  }

  .hero-title {
    margin: 0;
    font: 800 clamp(42px, 6vw, 76px) / 1.02 var(--font-sans);
    letter-spacing: -0.045em;
    color: var(--ink);
    text-wrap: balance;
  }

  .hero-highlight {
    background: linear-gradient(90deg, var(--category-c), var(--accent) 55%, color-mix(in oklch, var(--accent), var(--category-a) 55%));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .hero-sub {
    max-width: 600px;
    margin: 0;
    font: var(--weight-regular) clamp(16px, 1.4vw, 19px) / 1.55 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-10);
    margin-bottom: 64px;
  }

  .cta {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 52px;
    padding: 0 var(--space-24);
    border: 0;
    border-radius: var(--radius-lg);
    cursor: pointer;
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
  }

  .cta.primary {
    background: var(--accent);
    color: var(--on-accent);
  }

  .cta.ghost {
    padding: 0 var(--space-22);
    box-shadow: inset 0 0 0 1px var(--line-2);
    color: var(--ink);
  }

  .cta.ghost:hover {
    background: var(--overlay-1);
  }

  .cta.big {
    height: 54px;
    padding: 0 var(--space-26);
  }

  .cta-glyph {
    width: 16px;
    height: 16px;
  }

  .hero-fade {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 2;
    height: 200px;
    background: linear-gradient(to top, var(--surface-0) 8%, color-mix(in srgb, var(--surface-0) 70%, transparent) 45%, transparent);
    pointer-events: none;
  }

  /* ── product shot ── */
  .shot-wrap {
    width: 100%;
  }

  .shot {
    position: relative;
    width: 100%;
    max-width: 1200px;
    height: 460px;
    margin: 0 auto -40px;
    box-sizing: border-box;
    padding: var(--space-8) var(--space-8) 0;
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: var(--space-8);
    overflow: hidden;
    border-radius: 26px 26px 0 0;
    background: var(--surface-0);
    box-shadow: inset 0 0 0 1px var(--line-1);
    text-align: start;
  }

  .shot-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
    padding-top: var(--space-6);
  }

  .rail-home {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: var(--overlay-2);
  }

  .rail-on {
    display: flex;
    border-radius: 10px;
    box-shadow:
      0 0 0 2px var(--surface-0),
      0 0 0 4px var(--accent);
  }

  .shot-app {
    min-width: 0;
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    overflow: hidden;
    border-radius: 20px 20px 0 0;
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .shot-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-14) var(--space-8);
    border-inline-end: 1px solid var(--line-1);
  }

  .shot-community {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: var(--space-2) var(--space-4) var(--space-12) var(--space-6);
  }

  .shot-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .shot-name {
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
  }

  .shot-name.small {
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
  }

  .shot-meta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    white-space: nowrap;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .shot-meta-glyph {
    width: 10px;
    height: 10px;
  }

  .shot-icon {
    width: 15px;
    height: 15px;
    color: var(--ink-3);
  }

  .shot-search {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 34px;
    margin: 0 var(--space-2) var(--space-6);
    padding: 0 var(--space-10);
    border-radius: 10px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .shot-search-glyph {
    width: 13px;
    height: 13px;
  }

  .shot-heading {
    padding: var(--space-6) var(--space-8) var(--space-4);
    font: var(--weight-semibold) var(--text-2xs) / 1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .shot-channel {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: var(--space-8);
    border-radius: var(--radius-md);
  }

  .shot-channel.on {
    background: var(--overlay-2);
  }

  .shot-channel-name {
    font: var(--weight-semibold) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .shot-preview {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-4);
  }

  .shot-chat {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .shot-header {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 56px;
    padding: 0 var(--space-14) 0 var(--space-18);
    border-bottom: 1px solid var(--line-1);
  }

  .grow {
    flex: 1;
  }

  .shot-tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
  }

  .shot-messages {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-14) var(--space-18) var(--space-18);
    overflow: hidden;
  }

  .shot-day {
    align-self: center;
    padding: 5px var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-1);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  .shot-message {
    display: flex;
    align-items: flex-start;
    gap: var(--space-10);
  }

  .shot-message-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .shot-sender {
    padding-inline-start: var(--space-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--category-a);
  }

  .proposal {
    width: 360px;
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: var(--space-16);
    border-radius: 4px 16px 16px 16px;
    background: linear-gradient(160deg, color-mix(in oklch, var(--accent) 7%, var(--surface-1)), var(--surface-1));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent);
  }

  .proposal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
  }

  .proposal-kicker {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-bright);
  }

  .proposal-open {
    padding: var(--space-4) var(--space-8);
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--status-online) 12%, transparent);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--status-online);
  }

  .proposal-title {
    font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .proposal-tally {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .tally-bar {
    flex: 1;
    display: flex;
    height: 8px;
    overflow: hidden;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
  }

  .tally-bar .yes {
    width: 82%;
    background: var(--status-online);
  }

  .tally-bar .no {
    width: 18%;
    background: var(--status-danger);
  }

  .tally-text {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3);
  }

  .proposal-votes {
    display: flex;
    gap: var(--space-8);
  }

  .vote {
    flex: 1;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
  }

  .vote.adopt {
    background: color-mix(in oklch, var(--status-online) 14%, transparent);
    color: var(--status-online);
  }

  .vote.reject {
    background: var(--overlay-2);
    color: var(--ink-2);
  }

  .shot-time {
    align-self: flex-end;
    margin-top: -2px;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .shot-reply {
    align-self: flex-start;
    display: flex;
    align-items: flex-end;
    gap: var(--space-10);
    margin-inline-start: 40px;
    padding: var(--space-10) var(--space-12) 9px var(--space-14);
    border-radius: 4px 16px 16px 16px;
    background: var(--bubble-send-bg);
    font: var(--weight-regular) var(--text-md) / 1.4 var(--font-sans);
    color: var(--bubble-text);
  }

  .shot-reply-time {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-mono);
    color: var(--bubble-text-soft);
  }

  .ticks {
    width: 13px;
    height: 13px;
    color: var(--bubble-tick);
  }

  /* ── bands ── */
  .band {
    display: flex;
    justify-content: center;
    padding: 72px var(--space-24);
  }

  #download {
    padding-bottom: var(--space-24);
  }

  .communities-band {
    padding-top: 40px;
  }

  .governance-band {
    padding-top: 0;
  }

  .inner {
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
  }

  .stack-32 {
    gap: 32px;
  }

  .stack-36 {
    gap: 36px;
  }

  .stack-40 {
    gap: 40px;
  }

  .intro {
    max-width: 680px;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }

  .intro.narrow {
    max-width: 640px;
  }

  .kicker {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .h2 {
    margin: 0;
    font: var(--weight-bold) clamp(28px, 3.2vw, 40px) / 1.12 var(--font-sans);
    letter-spacing: -0.025em;
    color: var(--ink);
    text-wrap: balance;
  }

  .lede {
    margin: 0;
    font: var(--weight-regular) var(--text-base) / 1.6 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  /* ── native apps ── */
  .apps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
    gap: var(--space-16);
    align-items: start;
  }

  .app-card {
    --tone: var(--status-online);
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
    padding: clamp(22px, 3vw, 32px);
    border-radius: var(--radius-xl);
    background: linear-gradient(150deg, color-mix(in oklch, var(--tone) 13%, var(--surface-1)), var(--surface-1) 70%);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tone) 24%, transparent);
  }

  .app-card.ios {
    --tone: var(--status-chit);
  }

  .app-head {
    display: flex;
    align-items: center;
    gap: var(--space-12);
  }

  .app-icon {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--tone) 16%, transparent);
    color: var(--tone);
  }

  .app-glyph {
    width: 20px;
    height: 20px;
  }

  .app-name {
    flex: 1;
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .app-pill {
    flex: none;
    padding: var(--space-6) var(--space-12);
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--tone) 16%, transparent);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--tone);
  }

  .app-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .app-lead {
    font: var(--weight-semibold) var(--text-base) / 1.45 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .app-note {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .site {
    font-weight: var(--weight-semibold);
    color: var(--ink);
  }

  .builds {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .build {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-16) var(--space-18);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--surface-0) 45%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tone) 22%, transparent);
    color: var(--ink);
  }

  .build.link:hover {
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tone) 50%, transparent);
  }

  .build-title {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-bold) var(--text-base) / 1.3 var(--font-sans);
  }

  .build-glyph {
    width: 15px;
    height: 15px;
    color: var(--tone);
  }

  .build-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  /* ── features ── */
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: var(--space-16);
  }

  .feature {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-24);
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: color-mix(in oklch, var(--accent) 14%, transparent);
    color: var(--accent);
  }

  .feature-glyph {
    width: 21px;
    height: 21px;
  }

  .feature-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8);
  }

  .feature-title {
    font: var(--weight-bold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .feature-tag {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: var(--radius-pill);
    background: color-mix(in oklch, var(--status-verified) 14%, transparent);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--status-verified);
  }

  .tag-glyph {
    width: 11px;
    height: 11px;
  }

  .feature-body {
    font: var(--weight-regular) var(--text-md) / 1.6 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  /* ── communities ── */
  .communities-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-18);
  }

  .communities-head .intro {
    flex: 1 1 420px;
  }

  .browse {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 44px;
    padding: 0 var(--space-18);
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink);
  }

  .browse:hover {
    background: var(--overlay-2);
  }

  .community-wrap {
    container-type: inline-size;
  }

  .community-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-16);
  }

  @container (max-width: 900px) {
    .community-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (max-width: 460px) {
    .community-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .community {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    color: var(--ink);
  }

  .community.link:hover {
    border-color: var(--line-3);
  }

  .community-cover {
    height: 110px;
  }

  .community-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: 0 var(--space-16) var(--space-18);
  }

  .community-avatar {
    align-self: flex-start;
    display: flex;
    margin-top: -28px;
    border: 4px solid var(--surface-1);
    border-radius: 18px;
    overflow: hidden;
  }

  .community-avatar img {
    display: block;
    width: 48px;
    height: 48px;
    object-fit: cover;
  }

  .community-name {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
  }

  .community-about {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .community-members {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .members-glyph {
    width: 14px;
    height: 14px;
    color: var(--ink-3);
  }

  /* ── governance ── */
  .governance {
    width: 100%;
    max-width: 1200px;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 40px;
    padding: clamp(28px, 4vw, 56px);
    border-radius: 28px;
    background: linear-gradient(135deg, color-mix(in oklch, var(--accent) 14%, var(--surface-1)), var(--surface-1) 60%);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 22%, transparent);
  }

  .governance-copy {
    flex: 1 1 420px;
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .governance-body {
    max-width: 540px;
    margin: 0;
    font: var(--weight-regular) var(--text-base) / 1.65 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .proposals {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent);
  }

  .steps {
    flex: 1 1 360px;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-14);
    padding: var(--space-16) var(--space-18);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--surface-0) 55%, transparent);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .step-number {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink);
  }

  .step-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .step-title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .step-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
  }

  /* ── final call to action ── */
  .final {
    padding: 32px var(--space-24) 88px;
  }

  .final-inner {
    width: 100%;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
  }

  .final-title {
    margin: 0;
    font: var(--weight-bold) clamp(32px, 4vw, 52px) / 1.08 var(--font-sans);
    letter-spacing: -0.03em;
    color: var(--ink);
    text-wrap: balance;
  }

  .final-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-8) var(--space-16);
  }

  .final-explore {
    display: flex;
    align-items: center;
    height: 54px;
    padding: 0 var(--space-12);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-2);
  }

  .final-explore:hover,
  .footer-link:hover {
    color: var(--ink);
  }

  /* ── footer ── */
  .footer {
    display: flex;
    justify-content: center;
    padding: 48px var(--space-24) 40px;
    border-block-start: 1px solid var(--line-1);
  }

  .footer-top {
    display: flex;
    flex-wrap: wrap;
    gap: 40px;
  }

  .footer-brand {
    flex: 1 1 260px;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }

  .footer-name {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink);
  }

  .footer-tagline {
    max-width: 280px;
    font: var(--weight-regular) var(--text-md) / 1.55 var(--font-sans);
    color: var(--ink-3);
  }

  .footer-group {
    flex: 0 1 160px;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }

  .footer-heading {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .footer-link {
    font: var(--weight-medium) var(--text-md) / 1.2 var(--font-sans);
    color: var(--ink-2);
  }

  .footer-note {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4);
  }

  /* ── narrow screens: the section links and the product shot's list column go first ── */
  @media (max-width: 820px) {
    .section-link {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .top {
      padding: 0 var(--space-16);
    }

    .top-inner {
      flex-wrap: wrap;
      gap: var(--space-8) var(--space-12);
      padding: var(--space-12) 0;
    }

    /* brand and auth on the first row; the Learn menu and theme controls under them */
    .auth {
      order: 2;
      margin-inline-start: auto;
    }

    .nav {
      order: 3;
    }

    .theme {
      order: 4;
    }

    .shot-tool:not(:last-child) {
      display: none;
    }

    .hero {
      padding-top: 72px;
    }

    .shot-app {
      grid-template-columns: minmax(0, 1fr);
    }

    .shot-list {
      display: none;
    }

    .band {
      padding-inline: var(--space-16);
    }
  }
</style>
