<!-- Link to your account (native design notes §3.1, Link Account Options 4d): "On your computer"
     (open oc.app, Profile → Link a device; the code changes every few minutes), then "On this
     phone": the six-character code (the kit's CodeTiles: not case sensitive, one-time-code
     autofill), the hint and Paste. The button counts down the characters left, then Link this
     phone, then Linking…. Linking is the client's sign-in with the code: a passkey made on this
     phone for that account, which then signs in; a refused code rings the tiles and says why. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import CodeTiles from "@openchat/ui/src/native/CodeTiles.svelte";
    import { normaliseCode } from "@openchat/ui/src/native/codeTiles";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { resumeSignIn } from "@src/logic/auth/signUp";
    import { AuthProvider, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { linkButton } from "./start.adapter";

    type Props = { back: () => void };

    let { back }: Props = $props();

    const client = getContext<OpenChat>("client");

    const LENGTH = 6;

    let code = $state("");
    let linking = $state(false);
    // why the last code was refused, as an i18n key
    let refused = $state<string | undefined>(undefined);
    let pasteFailed = $state(false);

    const button = $derived(linkButton(code, LENGTH, linking));

    function input(next: string) {
        code = next;
        refused = undefined;
        pasteFailed = false;
    }

    async function paste() {
        try {
            input(normaliseCode(await navigator.clipboard.readText(), LENGTH));
        } catch {
            pasteFailed = true;
        }
    }

    async function link() {
        if (button.disabled) return;
        linking = true;
        refused = undefined;
        resumeSignIn();
        client.gaTrack("initiated_signin", "registration", AuthProvider.PASSKEY);
        try {
            const outcome = await client.signIn({ kind: "linking_code", code });
            // signed in: the app takes over; a dismissed passkey prompt leaves the code as it is
            if (outcome.kind === "failed") refused = outcome.reason.key;
        } finally {
            linking = false;
        }
    }
</script>

<NativePageHeader title="" onBack={back} />
<div class="body">
    <div class="intro">
        <h1>{$_("native.start.link.title")}</h1>
        <p>{$_("native.start.link.sub")}</p>
    </div>

    <section>
        <h2>{$_("native.start.link.computer")}</h2>
        <ol class="steps">
            <li>
                <span class="tile"><span class="glyph globe"></span></span>
                <span class="text">
                    <span class="label">{$_("native.start.link.openApp")}</span>
                    <span class="sub">{$_("native.start.link.signInThere")}</span>
                </span>
                <span class="n" aria-hidden="true">1</span>
            </li>
            <li>
                <span class="tile"><span class="glyph user"></span></span>
                <span class="text">
                    <span class="label">{$_("native.start.link.goToProfile")}</span>
                    <span class="sub">{$_("native.start.link.codeChanges")}</span>
                </span>
                <span class="n" aria-hidden="true">2</span>
            </li>
        </ol>
    </section>

    <section>
        <h2>{$_("native.start.link.phone")}</h2>
        <CodeTiles
            value={code}
            length={LENGTH}
            error={refused !== undefined}
            label={$_("native.start.link.codeLabel")}
            onInput={input}
            onComplete={(full) => input(full)} />
        <div class="hint">
            <span class="note" class:warn={refused !== undefined || pasteFailed} role={refused ? "alert" : undefined}>
                {#if refused !== undefined}
                    {$_(refused)}
                {:else if pasteFailed}
                    {$_("native.start.link.pasteFailed")}
                {:else}
                    {$_("native.start.link.hint")}
                {/if}
            </span>
            <button type="button" class="paste" onclick={paste}>
                <span class="paste-icon"></span>{$_("native.start.link.paste")}
            </button>
        </div>
    </section>
</div>
<div class="footer">
    <Button
        label={$_(button.key, { values: button.values })}
        icon="link"
        size="lg"
        fullWidth
        disabled={button.disabled}
        onClick={link} />
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 34px;
        padding: var(--space-8) var(--space-16) var(--space-24);
    }

    .intro {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        padding: 0 var(--space-6);

        h1 {
            margin: 0;
            font: 800 text-size(26px) / 1.1 var(--font-sans);
            letter-spacing: -0.02em;
        }

        p {
            margin: 0;
            font: var(--weight-medium) text-size(14px) / 1.5 var(--font-sans);
            color: var(--ink-3);
        }
    }

    section {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    h2 {
        margin: 0;
        padding: 0 var(--space-6);
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .steps {
        margin: 0;
        padding: 0;
        list-style: none;
        border-radius: var(--radius-xl);
        overflow: hidden;
        background: var(--overlay-1);

        li {
            display: flex;
            align-items: center;
            gap: var(--space-12);
            padding: var(--space-14) var(--space-16);

            & + li {
                box-shadow: inset 0 1px 0 var(--line-1);
            }
        }
    }

    .tile {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-sm);
        @include flex-center;
        background: var(--overlay-2);
    }

    .glyph {
        width: 18px;
        height: 18px;
        background: var(--ink-2);

        &.globe {
            mask: var(--icon-globe) center/contain no-repeat;
        }

        &.user {
            mask: var(--icon-user) center/contain no-repeat;
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .label {
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1.3 var(--font-sans);
        color: var(--ink-4);
    }

    .n {
        flex: none;
        font: var(--weight-bold) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .hint {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-2) var(--space-6) 0;
    }

    .note {
        flex: 1;
        font: var(--weight-medium) text-size(12.5px) / 1.4 var(--font-sans);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }

    .paste {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-6);
        min-height: var(--touch-target);
        padding: 0 var(--space-2);
        border: 0;
        background: none;
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        cursor: pointer;
    }

    .paste-icon {
        @include icon(paste, 14px);
    }

    .footer {
        flex: none;
        padding: var(--space-12) var(--space-16) var(--bar-end);
    }
</style>
