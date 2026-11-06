<!-- Who referred you (native design notes §3.1, Referrer Sheet Options 2d and Referrer Confirm
     Options 3c): one sheet of a fixed height through its steps. Search: a warm header (you and them
     joined by a heart), the search field, and before typing a card with Scan their QR code · Paste
     their invite link; results are people with Select. Picking someone confirms them: their photo
     with a heart, name and handle, where they came from (their link, their QR code), and "That's
     them" / "Pick someone else". The flow is the shared ReferrerPicker (logic/auth): an invite
     link's `ref` names them (referralCode), looked up with resolveReferrer, and those who can't
     refer are never offered (canRefer). The camera is the app's QR scanner (core/QRScanner). -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import MemberRow from "@openchat/ui/src/lib/components/MemberRow.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import QRScanner from "@src/core/QRScanner.svelte";
    import { ReferrerPicker } from "@src/logic/auth/referrerPicker.svelte";
    import type { ReferrerSource } from "@src/logic/auth/signUpForm.svelte";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import type { OpenChat, UserSummary } from "@client";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { personAvatarUrl, personName } from "./start.adapter";

    type Props = {
        open: boolean;
        onClose: () => void;
        /** Confirmed: they're the referrer. */
        onPick: (user: UserSummary, source: ReferrerSource) => void;
    };

    let { open, onClose, onPick }: Props = $props();

    const client = getContext<OpenChat>("client");
    const picker = new ReferrerPicker(client);
    onDestroy(() => picker.destroy());

    let cameraFailed = $state(false);
    let clipboardEmpty = $state(false);

    const step = $derived(picker.step);
    const results = $derived(picker.results);
    const problem = $derived(
        clipboardEmpty
            ? "native.start.referrer.clipboardEmpty"
            : picker.linkProblem === "no_referrer"
              ? "native.start.referrer.noReferrer"
              : picker.linkProblem === "unknown"
                ? "native.start.referrer.unknown"
                : undefined,
    );

    function close() {
        picker.back();
        picker.input("");
        cameraFailed = false;
        clipboardEmpty = false;
        onClose();
    }

    async function paste() {
        clipboardEmpty = false;
        let text = "";
        try {
            text = await navigator.clipboard.readText();
        } catch {
            // no access to the clipboard: the link can be pasted into the field
        }
        if (text.trim().length === 0) {
            clipboardEmpty = true;
            return;
        }
        await picker.fromLink(text, "pasted");
    }

    function scanned(data: string) {
        void picker.fromLink(data, "qr");
    }

    function confirm(user: UserSummary, source: ReferrerSource) {
        onPick(user, source);
        picker.back();
        picker.input("");
    }
</script>

<BottomSheet {open} onClose={close} label={$_("native.start.referrer.title")} height="min(620px, 86%)">
    {#snippet header()}
        {#if step.kind === "search"}
            <div class="warm">
                <span class="pair" aria-hidden="true">
                    <span class="face you"><Avatar size={48} color="blue" /></span>
                    <span class="face them"><span class="user"></span></span>
                    <span class="heart"><span></span></span>
                </span>
                <h2>{$_("native.start.referrer.heading")}</h2>
                <p>{$_("native.start.referrer.sub")}</p>
            </div>
        {/if}
    {/snippet}

    {#if step.kind === "search"}
        <div class="search">
            <Field
                placeholder={$_("native.start.referrer.search")}
                value={picker.query}
                onInput={(e) => {
                    clipboardEmpty = false;
                    picker.input(e.currentTarget.value);
                }}
                onClear={() => picker.input("")}
                showShortcut={false} />
        </div>
        <div class="list">
            {#if problem !== undefined}
                <p class="problem" role="alert">{$_(problem)}</p>
            {/if}
            {#if picker.resolving}
                <div class="state"><Spinner /></div>
            {:else if results.kind === "idle"}
                <div class="ways">
                    <button type="button" class="way" onclick={() => picker.scan()}>
                        <span class="glyph qr"></span>
                        <span class="text">
                            <span class="label">{$_("native.start.referrer.scan")}</span>
                            <span class="sub">{$_("native.start.referrer.scanSub")}</span>
                        </span>
                        <span class="chevron"></span>
                    </button>
                    <button type="button" class="way" onclick={paste}>
                        <span class="glyph link"></span>
                        <span class="text">
                            <span class="label">{$_("native.start.referrer.paste")}</span>
                            <span class="sub">{$_("native.start.referrer.pasteSub")}</span>
                        </span>
                        <span class="chevron"></span>
                    </button>
                </div>
            {:else if results.kind === "searching"}
                <div class="state"><Spinner /></div>
            {:else if results.kind === "failed"}
                <p class="none">{$_("native.start.referrer.searchFailed")}</p>
            {:else if results.users.length === 0}
                <p class="none">{$_("native.start.referrer.none")}</p>
            {:else}
                {#each results.users as user (user.userId)}
                    <MemberRow
                        title={personName(user)}
                        subtitle={`@${user.username}`}
                        image={personAvatarUrl(user, blobUrlPattern)}
                        actionLabel={$_("native.start.referrer.select")}
                        onAction={() => picker.pick(user)}
                        onClick={() => picker.pick(user)}
                        showMenu={false} />
                {/each}
            {/if}
        </div>
    {:else if step.kind === "scan"}
        <div class="scan">
            {#if cameraFailed}
                <p class="problem" role="alert">{$_("native.start.referrer.cameraUnavailable")}</p>
            {:else}
                <div class="frame">
                    <QRScanner autoscan onData={scanned} onError={() => (cameraFailed = true)} />
                </div>
                <p class="hint">{$_("native.start.referrer.scanHint")}</p>
            {/if}
            <button type="button" class="other" onclick={() => picker.back()}>
                {$_("native.start.referrer.cancelScan")}
            </button>
        </div>
    {:else}
        {@const user = step.user}
        {@const source = step.source}
        <div class="confirm">
            <div class="who">
                <span class="big">
                    <img src={personAvatarUrl(user, blobUrlPattern)} alt="" />
                    <span class="badge"><span></span></span>
                </span>
                <span class="names">
                    <span class="name">{personName(user)}</span>
                    <span class="handle">@{user.username}</span>
                    {#if source === "pasted" || source === "qr"}
                        <span class="via">
                            <span class="via-icon" class:qr={source === "qr"}></span>
                            {$_(
                                source === "qr"
                                    ? "native.start.referrer.viaQr"
                                    : "native.start.referrer.viaLink",
                            )}
                        </span>
                    {/if}
                </span>
                <p class="line">
                    {$_("native.start.referrer.confirmLine", { values: { name: personName(user) } })}
                </p>
            </div>
            <div class="buttons">
                <Button
                    label={$_("native.start.referrer.that")}
                    size="lg"
                    fullWidth
                    onClick={() => confirm(user, source)} />
                <button type="button" class="other" onclick={() => picker.back()}>
                    {$_("native.start.referrer.other")}
                </button>
            </div>
        </div>
    {/if}
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .warm {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-12) var(--space-24) var(--space-18);
        text-align: center;

        h2 {
            margin: 0;
            font: 800 text-size(21px) / 1.2 var(--font-sans);
        }

        p {
            margin: 0;
            font: var(--weight-medium) text-size(13.5px) / 1.45 var(--font-sans);
            color: var(--ink-3);
            text-wrap: pretty;
        }
    }

    // you and them, joined by an accent heart
    .pair {
        position: relative;
        width: 96px;
        height: 56px;
    }

    .face {
        position: absolute;
        top: var(--space-4);
        width: 48px;
        height: 48px;
        border-radius: var(--radius-circle);
        box-shadow: 0 0 0 4px var(--surface-1);

        &.you {
            inset-inline-start: var(--space-4);
            display: flex;
        }

        &.them {
            inset-inline-end: var(--space-4);
            @include flex-center;
            background: var(--overlay-2);
        }
    }

    .user {
        @include icon(user, 22px, var(--ink-3));
    }

    .heart {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 26px;
        height: 26px;
        margin: -13px 0 0 -13px;
        border-radius: var(--radius-circle);
        @include flex-center;
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--surface-1);

        span {
            @include icon(heart-filled, 13px, var(--on-accent));
        }
    }

    .search {
        padding: 0 var(--space-16) var(--space-10);
    }

    // the results scroll under the search, which stays put (the sheet's body doesn't scroll)
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-4) var(--space-16) var(--scroll-end);
    }

    .ways {
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-xl);
        overflow: hidden;
        background: var(--overlay-1);
    }

    .way {
        display: flex;
        align-items: center;
        gap: var(--space-14);
        min-height: 60px;
        padding: 0 var(--space-16);
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        & + & {
            box-shadow: inset 0 1px 0 var(--line-1);
        }

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .glyph {
        flex: none;
        width: 19px;
        height: 19px;
        background: var(--ink-2);

        &.qr {
            mask: var(--icon-qr) center/contain no-repeat;
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
        gap: var(--space-4);
    }

    .label {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }

    .state {
        display: flex;
        justify-content: center;
        padding: var(--space-24);
    }

    .none,
    .problem {
        margin: 0;
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .problem {
        padding: var(--space-4) var(--space-6) var(--space-8);
        text-align: start;
        font-weight: var(--weight-medium);
        font-size: text-size(13px);
        color: var(--status-warning);
    }

    .scan {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-8) var(--space-16) var(--scroll-end);
    }

    .frame {
        width: min(100%, 320px);
        aspect-ratio: 1;
        border-radius: var(--radius-xl);
        overflow: hidden;
        background: var(--overlay-1);
    }

    .hint {
        margin: 0;
        text-align: center;
        font: var(--weight-medium) text-size(13px) / 1.45 var(--font-sans);
        color: var(--ink-3);
    }

    .confirm {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        box-sizing: border-box;
        padding: 0 var(--space-16) calc(var(--bar-end) + var(--space-16));
    }

    .who {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-14);
        padding: var(--space-24) var(--space-8);
        text-align: center;
    }

    .big {
        position: relative;
        display: flex;

        img {
            width: 112px;
            height: 112px;
            border-radius: var(--radius-circle);
            object-fit: cover;
        }
    }

    .badge {
        position: absolute;
        inset: auto 0 var(--space-2) auto;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-circle);
        @include flex-center;
        background: var(--accent);
        box-shadow: 0 0 0 4px var(--surface-1);

        span {
            @include icon(heart-filled, 16px, var(--on-accent));
        }
    }

    .names {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-6);
    }

    .name {
        font: 800 text-size(24px) / 1.15 var(--font-sans);
    }

    .handle {
        font: var(--weight-medium) text-size(13.5px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .via {
        margin-top: var(--space-6);
        display: flex;
        align-items: center;
        gap: var(--space-6);
        height: 28px;
        padding: 0 11px;
        border-radius: var(--radius-pill);
        background: var(--overlay-1);
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-2);
    }

    .via-icon {
        @include icon(link, 13px);

        &.qr {
            mask: var(--icon-qr) center/contain no-repeat;
        }
    }

    .line {
        margin: 0;
        max-width: 300px;
        font: var(--weight-medium) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .other {
        align-self: stretch;
        height: var(--touch-target);
        border: 0;
        background: none;
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(14.5px) / 1 var(--font-sans);
        cursor: pointer;
    }
</style>
