<!-- Welcome back (native design notes §3.1, Welcome Back Options 1a): a pushed page of the ways in,
     14px apart: Sign in with passkey (accent, "Fastest"), and Link with existing account; "New to
     OpenChat? Create an account" under them. No Internet Identity or email sign-in in the app.
     Recover with phrase isn't here: the backend has no recovery phrase (GAPS.md). A passkey sign-in
     is the client's (signIn): signed in, the app takes over; a passkey with no account goes on to
     Pick a username; a failure says why. -->
<script lang="ts">
    import Logo from "@openchat/ui/src/lib/components/Logo.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { resumeSignIn } from "@src/logic/auth/signUp";
    import { toastStore } from "@src/stores/toast";
    import { AuthProvider, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { StartStack } from "./startStack.svelte";

    type Props = { start: StartStack; back: () => void };

    let { start, back }: Props = $props();

    const client = getContext<OpenChat>("client");

    let signingIn = $state(false);

    async function passkey() {
        if (signingIn) return;
        signingIn = true;
        resumeSignIn();
        client.gaTrack("initiated_signin", "registration", AuthProvider.PASSKEY);
        try {
            const outcome = await client.signIn({ kind: "passkey" });
            switch (outcome.kind) {
                case "needs_account":
                    start.go("sign_up");
                    break;
                case "failed":
                    toastStore.showFailureToast(outcome.reason);
                    break;
                // signed in: the app takes over; a dismissed prompt leaves the choices
            }
        } finally {
            signingIn = false;
        }
    }
</script>

<NativePageHeader title="" onBack={back} />
<div class="body">
    <div class="intro">
        <span class="lockup"><Logo size={24} /><span>OpenChat</span></span>
        <h1>{$_("native.start.welcomeBack.title")}</h1>
        <p>{$_("native.start.welcomeBack.sub")}</p>
    </div>
    <div class="ways">
        <button type="button" class="way" disabled={signingIn} onclick={passkey}>
            <span class="tile accent"><span class="glyph passkey"></span></span>
            <span class="text">
                <span class="label">
                    {$_("native.start.welcomeBack.passkey")}
                    <span class="fastest">{$_("native.start.welcomeBack.fastest")}</span>
                </span>
                <span class="sub">{$_("native.start.welcomeBack.passkeySub")}</span>
            </span>
            {#if signingIn}
                <span class="busy"><Spinner /></span>
            {:else}
                <span class="chevron"></span>
            {/if}
        </button>
        <button
            type="button"
            class="way"
            disabled={signingIn}
            onclick={() => start.go("link")}>
            <span class="tile"><span class="glyph link"></span></span>
            <span class="text">
                <span class="label">{$_("native.start.welcomeBack.link")}</span>
                <span class="sub">{$_("native.start.welcomeBack.linkSub")}</span>
            </span>
            <span class="chevron"></span>
        </button>
    </div>
</div>
<p class="new">
    {$_("native.start.welcomeBack.newHere")}
    <button type="button" onclick={() => start.go("sign_up")}>
        {$_("native.start.welcomeBack.create")}
    </button>
</p>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding: 20px var(--space-16) var(--space-24);
    }

    .intro {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        padding: 0 var(--space-6);

        h1 {
            margin: var(--space-14) 0 0;
            font: 800 text-size(32px) / 1.08 var(--font-sans);
            letter-spacing: -0.03em;
        }

        p {
            margin: 0;
            font: var(--weight-medium) text-size(14.5px) / 1.5 var(--font-sans);
            color: var(--ink-3);
        }
    }

    .lockup {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        font: var(--weight-semibold) text-size(17px) / 1 var(--font-sans);
    }

    .ways {
        display: flex;
        flex-direction: column;
        gap: var(--space-14);
    }

    .way {
        display: flex;
        align-items: center;
        gap: var(--space-14);
        padding: var(--space-16);
        border: 0;
        border-radius: 20px;
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active:not(:disabled) {
            background: var(--overlay-2);
        }

        &:disabled {
            cursor: default;
            opacity: 0.6;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .tile {
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: var(--radius-lg);
        @include flex-center;
        background: var(--overlay-2);
        color: var(--ink);

        &.accent {
            background: var(--accent);
            color: var(--on-accent);
        }
    }

    .glyph {
        width: 22px;
        height: 22px;
        background: currentColor;

        &.passkey {
            mask: var(--icon-passkey) center/contain no-repeat;
        }

        &.link {
            mask: var(--icon-link) center/contain no-repeat;
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .label {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        font: var(--weight-bold) text-size(16px) / 1.2 var(--font-sans);
    }

    .fastest {
        height: 20px;
        padding: 0 7px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        background: var(--accent-soft);
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(11px) / 1 var(--font-sans);
    }

    .sub {
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }

    .busy {
        flex: none;
        display: flex;
        width: 20px;
        height: 20px;
    }

    .new {
        flex: none;
        margin: 0;
        padding: 0 var(--space-24) calc(var(--bar-end) + var(--space-10));
        text-align: center;
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-4);

        button {
            min-height: var(--touch-target);
            padding: 0 var(--space-2);
            border: 0;
            background: none;
            color: var(--accent-bright);
            font: inherit;
            font-weight: var(--weight-bold);
            cursor: pointer;
        }
    }
</style>
