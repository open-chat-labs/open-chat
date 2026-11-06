<!-- Welcome (native design notes §3.1, Welcome Options 1k): the lockup, and one split pill for
     Appearance (theme icon and accent dot: a sheet with the theme and accent) and the language (its
     code: a sheet with search), each half a 44px target; the headline, three floating proof cards
     (a community vote, a community to join, a chat cheering news that shipped); Create account and
     I already have an account; the terms. No Explore, guest mode, crypto or wallet here. On a small
     phone (no taller than 700px) the cards scale to 78% and the headline to 32px. -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Logo from "@openchat/ui/src/lib/components/Logo.svelte";
    import { languageCode } from "@i18n/i18n";
    import type { OpenChat } from "@client";
    import { currentThemeMode, themeType } from "@theme/themes";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { openOnWeb } from "../../shell/onWeb";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";
    import AppearanceSheet from "./AppearanceSheet.svelte";
    import LanguageSheet from "./LanguageSheet.svelte";
    import { messageParts } from "./start.adapter";
    import type { StartStack } from "./startStack.svelte";

    type Props = { start: StartStack; overlays: Overlays };

    let { start, overlays }: Props = $props();
    const client = getContext<OpenChat>("client");

    let sheet = $state<"appearance" | "language" | undefined>(undefined);
    useOverlay(
        untrack(() => overlays), // the shell's, for the screen's lifetime
        () => sheet !== undefined,
        () => (sheet = undefined),
    );

    const code = $derived(languageCode($locale).toUpperCase());
    const modeIcon = $derived(
        $themeType === "system" ? "device" : $currentThemeMode === "light" ? "sun" : "moon",
    );

    const terms = $derived(
        messageParts(
            (values) => $_("native.start.welcome.terms", { values }),
            ["terms", "privacy"],
        ),
    );
    const LINKS: Record<string, { href: string; key: string }> = {
        terms: { href: "/terms", key: "native.start.welcome.termsLink" },
        privacy: { href: "/privacy", key: "native.start.welcome.privacyLink" },
    };
</script>

<div class="welcome">
    <div class="top">
        <span class="lockup">
            <Logo size={24} />
            <span class="name">OpenChat</span>
        </span>
        <span class="pill" role="group" aria-label={$_("native.start.welcome.controls")}>
            <button
                type="button"
                class="half appearance"
                aria-label={$_("native.start.appearance.title")}
                aria-haspopup="dialog"
                onclick={() => (sheet = "appearance")}>
                <span class="mode" style:mask="var(--icon-{modeIcon}) center/contain no-repeat"
                ></span>
                <span class="dot"></span>
                <span class="chevron"></span>
            </button>
            <span class="divider" aria-hidden="true"></span>
            <button
                type="button"
                class="half language"
                aria-label={$_("native.start.welcome.language", { values: { language: code } })}
                aria-haspopup="dialog"
                onclick={() => (sheet = "language")}>
                <span class="globe"></span>
                <span class="code">{code}</span>
                <span class="chevron"></span>
            </button>
        </span>
    </div>

    <div class="stage">
        <div class="headline">
            <h1>
                <span>{$_("native.start.welcome.featured")}</span>
                <span class="yours">{$_("native.start.welcome.yours")}</span>
            </h1>
        </div>
        <div class="cards" role="img" aria-label={$_("native.start.welcome.proofLabel")}>
            <div class="scale">
                <div class="card vote">
                    <span class="kicker"><span class="poll"></span>{$_("native.start.welcome.voteKicker")}</span>
                    <span class="question">{$_("native.start.welcome.voteQuestion")}</span>
                    <span class="bar"><span class="fill"></span></span>
                    <span class="stats">
                        <span>{$_("native.start.welcome.voteYes", { values: { percent: 72 } })}</span>
                        <span>{$_("native.start.welcome.voteLeft")}</span>
                    </span>
                </div>
                <div class="card community">
                    <Avatar size={42} shape="squircle" color="teal" />
                    <span class="about">
                        <span class="title">{$_("native.start.welcome.communityName")}</span>
                        <span class="members">{$_("native.start.welcome.communityMembers")}</span>
                    </span>
                    <span class="join">{$_("native.start.welcome.join")}</span>
                </div>
                <div class="chat">
                    <div class="message">
                        <span class="sender"><Avatar size={30} color="amber" /></span>
                        <span class="bubble">{$_("native.start.welcome.message")}</span>
                    </div>
                    <div class="reactions">
                        <span class="reaction">❤️ 24</span>
                        <span class="reaction mine">🙌 12</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="actions">
        <Button
            label={$_("native.start.welcome.createAccount")}
            icon="passkey"
            size="lg"
            fullWidth
            onClick={() => start.go("sign_up")} />
        <Button
            label={$_("native.start.welcome.haveAccount")}
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => start.go("welcome_back")} />
        <p class="terms">
            {#each terms as part, i (i)}
                {#if part.kind === "link"}
                    <a
                        href={LINKS[part.name].href}
                        onclick={(e) => {
                            // the website's, in the browser (shell/onWeb)
                            e.preventDefault();
                            openOnWeb(LINKS[part.name].href, client.canonicalOrigin());
                        }}>{$_(LINKS[part.name].key)}</a>
                {:else}
                    {part.text}
                {/if}
            {/each}
        </p>
    </div>
</div>

<AppearanceSheet open={sheet === "appearance"} onClose={() => (sheet = undefined)} />
<LanguageSheet open={sheet === "language"} onClose={() => (sheet = undefined)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .welcome {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding-top: var(--safe-top);
    }

    .top {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-14) var(--space-16) 0;
    }

    .lockup {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding-inline-start: var(--space-2);
    }

    .name {
        font: var(--weight-semibold) text-size(20px) / 1 var(--font-sans);
        letter-spacing: -0.015em;
    }

    // one pill, 36px tall, whose halves are 44px targets
    .pill {
        flex: none;
        display: flex;
        align-items: center;
        height: 36px;
        border-radius: var(--radius-xl);
        background: var(--overlay-1);
    }

    .half {
        display: flex;
        align-items: center;
        height: 44px;
        margin: calc(var(--space-4) * -1) 0;
        padding: 0 var(--space-10);
        border: 0;
        border-radius: var(--radius-xl);
        background: none;
        color: var(--ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .appearance {
        gap: 7px;
    }

    .language {
        gap: var(--space-6);
    }

    .mode {
        width: 16px;
        height: 16px;
        background: var(--ink);
    }

    .dot {
        width: 12px;
        height: 12px;
        border-radius: var(--radius-circle);
        background: var(--accent);
    }

    .chevron {
        @include icon(chevron-down, 12px, var(--ink-3));
    }

    .globe {
        @include icon(globe, 15px, var(--ink-2));
    }

    .code {
        font: var(--weight-bold) text-size(13px) / 1 var(--font-mono);
        letter-spacing: 0.04em;
    }

    .divider {
        flex: none;
        width: 1px;
        height: 18px;
        background: var(--line-2);
    }

    // the headline over the cards, its text in line with the first card's
    .stage {
        --cards-scale: 1;
        --cards-h: 300px;
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 var(--space-24) var(--space-8);

        @media (max-height: 700px) {
            --cards-scale: 0.78;
            --cards-h: 234px;
        }
    }

    .headline {
        flex: 1;
        min-height: 0;
        width: 340px;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 0 0 28px var(--space-18);

        @media (max-height: 700px) {
            padding: 0 0 var(--space-18) 51px;
        }
    }

    h1 {
        display: flex;
        flex-direction: column;
        margin: 0;
        font: 800 text-size(40px) / 1.04 var(--font-sans);
        letter-spacing: -0.035em;
        color: var(--ink);

        @media (max-height: 700px) {
            font-size: text-size(32px);
        }
    }

    .yours {
        color: var(--accent);
    }

    .cards {
        position: relative;
        flex: none;
        width: 340px;
        height: var(--cards-h);
        margin-bottom: 28px;

        @media (max-height: 700px) {
            margin-bottom: var(--space-16);
        }
    }

    .scale {
        position: absolute;
        inset: 0 auto auto 0;
        width: 340px;
        height: 300px;
        transform: scale(var(--cards-scale));
        transform-origin: top center;
    }

    // floating cards: each ringed in the page colour (4px), the lower ones in front
    .card,
    .bubble,
    .reaction {
        background: var(--surface-2);
        box-shadow:
            0 0 0 4px var(--surface-0),
            var(--shadow-raised);
    }

    .card {
        position: absolute;
        border-radius: 20px;
        animation: float 7s ease-in-out infinite;
    }

    .vote {
        z-index: 1;
        inset: var(--space-4) auto auto var(--space-4);
        width: 236px;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        // short enough that the community card in front leaves its numbers showing
        padding: var(--space-12) var(--space-14);
    }

    .kicker {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        font: var(--weight-bold) text-size(11px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
    }

    .poll {
        @include icon(poll, 14px);
    }

    // one line, so the card stays clear of the one in front of it
    .question {
        font: var(--weight-bold) text-size(15px) / 1.3 var(--font-sans);
        @include truncate;
    }

    .bar {
        position: relative;
        height: 8px;
        border-radius: var(--radius-xs);
        background: var(--overlay-2);
        overflow: hidden;
    }

    .fill {
        position: absolute;
        inset: 0 28% 0 0;
        border-radius: var(--radius-xs);
        background: var(--status-online);
    }

    .stats {
        display: flex;
        justify-content: space-between;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .community {
        z-index: 2;
        inset: 104px 0 auto auto;
        width: 212px;
        display: flex;
        align-items: center;
        gap: var(--space-10);
        padding: var(--space-12);
        animation-delay: 1.2s;
    }

    .about {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .title {
        font: var(--weight-bold) text-size(14px) / 1.2 var(--font-sans);
        @include line-clamp(2);
    }

    .members {
        font: var(--weight-medium) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .join {
        flex: none;
        height: 30px;
        padding: 0 var(--space-12);
        border-radius: var(--radius-pill);
        display: flex;
        align-items: center;
        background: var(--accent);
        color: var(--on-accent);
        font: var(--weight-bold) text-size(12.5px) / 1 var(--font-sans);
    }

    .chat {
        position: absolute;
        z-index: 3;
        inset: auto auto 34px var(--space-24);
        width: 214px;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        animation: float 7s ease-in-out 2.4s infinite;
    }

    .message {
        display: flex;
        align-items: flex-start;
        gap: var(--space-8);
    }

    .sender {
        flex: none;
        display: flex;
        border-radius: var(--radius-circle);
        box-shadow: 0 0 0 4px var(--surface-0);
    }

    .bubble {
        padding: var(--space-10) 13px;
        border-radius: var(--radius-xs) var(--space-18) var(--space-18) var(--space-18);
        font: var(--weight-medium) text-size(14px) / 1.35 var(--font-sans);
    }

    .reactions {
        display: flex;
        gap: var(--space-4);
        padding-inline-start: 38px;
    }

    .reaction {
        height: 26px;
        padding: 0 9px;
        border-radius: var(--radius-pill);
        display: flex;
        align-items: center;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-sans);

        &.mine {
            background: var(--accent-soft);
            box-shadow:
                inset 0 0 0 1px var(--accent),
                0 0 0 4px var(--surface-0);
        }
    }

    @keyframes float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-6px);
        }
    }

    .actions {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 0 var(--space-16) calc(var(--bar-end) + var(--space-14));
    }

    .terms {
        margin: 0;
        padding-top: var(--space-6);
        text-align: center;
        font: var(--weight-medium) text-size(11.5px) / 1.45 var(--font-sans);
        color: var(--ink-4);

        a {
            color: var(--ink-3);
            text-decoration: underline;
        }
    }

    @include reduced-motion {
        .card,
        .chat {
            animation: none;
        }
    }
</style>
