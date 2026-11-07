<!-- Pick a username (native design notes §3.1, Pick Username Options 2a): back to Welcome; the
     avatar (the name's initial until a photo; a camera badge): tapping it picks a photo (the OS
     picker, then a round crop in a sheet), and with a photo it's a menu (another, or none). The
     photo goes with the sign-up, which uploads it once the account is made. "What should we call
     you?", the @ field with its live check, and an optional recovery email (one that isn't an
     address blocks Continue). At the bottom the inviter card when the person came in on someone's
     link, else "Did someone refer you?" (the referrer sheet), then Continue. The form is the shared
     one (logic/auth/signUpForm) and Continue is the client's sign-up: the OS asks to make the
     passkey for the name, then the account is made. With a referrer, the app opens on a chat with
     them. Going back gives up a sign-up in flight and signs
     out an identity it left without an account (abandonSignIn). -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { abandonSignIn } from "@src/logic/auth/signUp";
    import { SignUpForm } from "@src/logic/auth/signUpForm.svelte";
    import { navigate } from "@src/utils/navigation";
    import { i18nKey, routeForChatIdentifier, type OpenChat, type UserSummary } from "@client";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, cropImage, readImageFile, type CropArea } from "@src/utils/imageCrop";
    import { keyboard } from "@stores/keyboard.svelte";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";
    import AvatarCropSheet from "./AvatarCropSheet.svelte";
    import ReferrerSheet from "./ReferrerSheet.svelte";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import type { ReferrerSource } from "@src/logic/auth/signUpForm.svelte";
    import {
        emailNote,
        personAvatarUrl,
        referrerCard,
        usernameNote,
        type FieldNote,
    } from "./start.adapter";

    type Props = { back: () => void; overlays: Overlays };

    let { back, overlays }: Props = $props();

    const client = getContext<OpenChat>("client");

    const form = new SignUpForm(client);
    const controller = new AbortController();
    let signedUp = false;

    let picking = $state(false);
    let fileInput = $state<HTMLInputElement>();
    // the image picked for the photo, being cropped; kept while its sheet plays its way out
    let crop = $state<{ source: string; open: boolean }>();
    // the photo's menu, open from the avatar
    let photoMenu = $state<HTMLElement | null>(null);

    // the keyboard covers the bottom of the page (the referrer row, Continue) rather than the page
    // shrinking above it and pushing them up (the field being typed in scrolls above it:
    // aboveKeyboard); the referrer sheet, whose search it would hide, shrinks above it as usual
    $effect(() => {
        if (picking) keyboard.enableViewportResize();
        else keyboard.disableViewportResize();
    });
    onDestroy(() => keyboard.enableViewportResize());
    // the shell's, for the screen's lifetime
    const shellOverlays = untrack(() => overlays);
    useOverlay(
        shellOverlays,
        () => picking,
        () => (picking = false),
    );
    useOverlay(
        shellOverlays,
        () => crop?.open === true,
        () => closeCrop(),
    );
    useOverlay(
        shellOverlays,
        () => photoMenu !== null,
        () => (photoMenu = null),
    );

    onMount(() => {
        void form.loadLinkReferrer();
    });

    onDestroy(() => {
        form.destroy();
        if (signedUp) return;
        // walking away: a sign-up still making its passkey goes no further, and an identity left
        // without an account is signed out (once an account being made is through)
        controller.abort();
        abandonSignIn(client);
    });

    const username = $derived(form.username.value);
    const userNote = $derived(usernameNote(form.username.status, username));
    const mailNote = $derived(emailNote(form.email, form.emailValid));
    const card = $derived(form.referrer !== undefined ? referrerCard(form.referrer) : undefined);
    const initial = $derived(username.slice(0, 1).toUpperCase());
    const photoMenuItems = $derived([
        { id: "choose", label: $_("native.start.signUp.choosePhoto"), icon: "image" },
        {
            id: "remove",
            label: $_("native.start.signUp.removePhoto"),
            icon: "trash",
            danger: true,
        },
    ]);

    function text(note: FieldNote): string {
        return $_(note.key, { values: note.values });
    }

    function typed(e: Event & { currentTarget: HTMLInputElement }) {
        // usernames are letters, digits and underscores, as the client checks
        const value = e.currentTarget.value.replace(/[^A-Za-z0-9_]/g, "");
        if (value !== e.currentTarget.value) e.currentTarget.value = value;
        form.username.set(value);
    }

    function picked(user: UserSummary, source: ReferrerSource) {
        form.pickReferrer(user, source);
        picking = false;
    }

    function tapAvatar(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
        if (form.avatar === undefined) fileInput?.click();
        else photoMenu = e.currentTarget;
    }

    function photoMenuPick(id: string) {
        if (id === "choose") fileInput?.click();
        else form.avatar = undefined;
    }

    async function pickedFile(e: Event & { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        // the same file picked again is a change too
        e.currentTarget.value = "";
        if (file === undefined) return;
        try {
            crop = { source: await readImageFile(file), open: true };
        } catch (err) {
            console.warn("Unable to read the picked image", err);
            toastStore.showFailureToast(i18nKey("native.start.signUp.photoFailed"));
        }
    }

    function closeCrop() {
        if (crop !== undefined) crop = { ...crop, open: false };
    }

    async function cropped(area: CropArea) {
        if (crop === undefined) return;
        const source = crop.source;
        closeCrop();
        try {
            // a file that isn't an image after all (a corrupt one, HEIC named .jpg) fails here
            const image = await cropImage(source, area, AVATAR_SIZE);
            if (image === undefined) throw new Error("the cropped image couldn't be encoded");
            form.avatar = image;
        } catch (err) {
            console.warn("Unable to crop the picked image", err);
            toastStore.showFailureToast(i18nKey("native.start.signUp.photoFailed"));
        }
    }

    async function submit() {
        // the terms were agreed to on Welcome ("By continuing you agree …")
        const outcome = await form.submit(true, controller.signal);
        if (outcome?.kind !== "success") return;
        signedUp = true;
        // the referrer becomes the first chat, as an invite does
        const referrer = form.referrer?.user;
        if (referrer !== undefined) {
            navigate(
                routeForChatIdentifier("none", { kind: "direct_chat", userId: referrer.userId }),
            );
        }
    }
</script>

<NativePageHeader title="" onBack={back} />
<div class="body" {@attach aboveKeyboard({ holdViewport: false })}>
    <button
        type="button"
        class="avatar"
        aria-label={$_(
            form.avatar === undefined
                ? "native.start.signUp.addPhoto"
                : "native.start.signUp.changePhoto",
        )}
        aria-haspopup={form.avatar === undefined ? undefined : "menu"}
        disabled={form.busy}
        onclick={tapAvatar}>
        {#if form.avatar !== undefined}
            <img class="photo-shown" src={form.avatar.url} alt="" />
        {:else}
            <span aria-hidden="true">{initial}</span>
        {/if}
        <span class="badge" aria-hidden="true"></span>
    </button>
    <div class="intro">
        <h1>{$_("native.start.signUp.title")}</h1>
        <p>{$_("native.start.signUp.sub")}</p>
    </div>
    <div class="field-group">
        <label class="field" class:warn={userNote.tone === "warn"}>
            <span class="at" aria-hidden="true">@</span>
            <input
                class="username"
                value={username}
                oninput={typed}
                placeholder={$_("native.start.signUp.usernamePlaceholder")}
                aria-label={$_("native.start.signUp.username")}
                aria-invalid={userNote.tone === "warn" || undefined}
                autocapitalize="none"
                autocomplete="username"
                autocorrect="off"
                spellcheck="false"
                maxlength="20"
                disabled={form.busy} />
            {#if userNote.tone === "ok"}<span class="tick"></span>{/if}
        </label>
        <span class="note {userNote.tone}">{text(userNote)}</span>
    </div>
    <div class="field-group">
        <label class="field" class:warn={mailNote.tone === "warn"}>
            <span class="mail" aria-hidden="true"></span>
            <input
                class="email"
                type="email"
                inputmode="email"
                bind:value={form.email}
                placeholder={$_("native.start.signUp.email")}
                aria-label={$_("native.start.signUp.emailLabel")}
                aria-invalid={mailNote.tone === "warn" || undefined}
                autocapitalize="none"
                autocomplete="email"
                maxlength="254"
                disabled={form.busy} />
            {#if form.email.trim().length > 0 && form.emailValid}<span class="tick"></span>{/if}
        </label>
        <span class="note {mailNote.tone}">{text(mailNote)}</span>
    </div>
</div>
<div class="footer">
    {#if form.error !== undefined}
        <p class="error" role="alert">{$_(form.error)}</p>
    {/if}
    {#if card !== undefined && form.referrer !== undefined}
        <div class="referrer">
            <img class="photo" src={personAvatarUrl(form.referrer.user, blobUrlPattern)} alt="" />
            <span class="who">
                <span class="title">{text(card.title)}</span>
                <span class="sub">{text(card.sub)}</span>
            </span>
            {#if card.removable}
                <button
                    type="button"
                    class="remove"
                    aria-label={$_("native.start.signUp.removeReferrer")}
                    onclick={() => form.removeReferrer()}><span></span></button>
            {:else}
                <span class="chat-icon" aria-hidden="true"></span>
            {/if}
        </div>
    {:else}
        <button type="button" class="ask" onclick={() => (picking = true)}>
            <span class="user-icon" aria-hidden="true"></span>
            <span class="ask-label">{$_("native.start.signUp.askReferrer")}</span>
            <span class="optional">{$_("native.start.signUp.optional")}</span>
            <span class="chevron" aria-hidden="true"></span>
        </button>
    {/if}
    <Button
        label={$_(form.busy ? "native.start.signUp.creating" : "native.start.signUp.continue")}
        size="lg"
        fullWidth
        disabled={!form.ready}
        onClick={submit} />
</div>

<ReferrerSheet open={picking} onClose={() => (picking = false)} onPick={picked} />

<input hidden type="file" accept="image/*" onchange={pickedFile} bind:this={fileInput} />

{#if crop !== undefined}
    {#key crop.source}
        <AvatarCropSheet
            open={crop.open}
            source={crop.source}
            onCrop={cropped}
            onClose={closeCrop} />
    {/key}
{/if}

<AnchoredMenu
    anchor={photoMenu}
    items={photoMenuItems}
    label={$_("native.start.signUp.photoTitle")}
    onSelect={photoMenuPick}
    onClose={() => (photoMenu = null)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        --avatar: 148px;
        --avatar-gap: 34px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-16) 20px var(--space-24);
        text-align: center;

        // a small phone: the recovery email stays in view above the referrer
        @media (max-height: 700px) {
            --avatar: 104px;
            --avatar-gap: var(--space-18);
        }
    }

    .avatar {
        position: relative;
        flex: none;
        width: var(--avatar);
        height: var(--avatar);
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        @include flex-center;
        background: var(--overlay-1);
        color: var(--ink-3);
        font: 800 calc(var(--avatar) * 0.365) / 1 var(--font-sans);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active:not(:disabled) {
            opacity: 0.85;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .photo-shown {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
    }

    // bottom-trailing on the circle, ringed with the page's background; in proportion to it
    .badge {
        --badge: calc(var(--avatar) * 0.27);
        position: absolute;
        inset-block-end: calc(var(--avatar) * 0.01);
        inset-inline-end: calc(var(--avatar) * 0.01);
        width: var(--badge);
        height: var(--badge);
        border-radius: var(--radius-circle);
        @include flex-center;
        background: var(--accent);
        box-shadow: 0 0 0 calc(var(--avatar) * 0.027) var(--surface-0);

        &::after {
            content: "";
            @include icon(camera, calc(var(--badge) * 0.48), var(--on-accent));
        }
    }

    .intro {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        margin-top: var(--avatar-gap);

        h1 {
            margin: 0;
            font: 800 text-size(26px) / 1.15 var(--font-sans);
            letter-spacing: -0.02em;
        }

        p {
            margin: 0;
            font: var(--weight-medium) text-size(14px) / 1.5 var(--font-sans);
            color: var(--ink-3);
            text-wrap: pretty;
        }
    }

    .field-group {
        flex: none;
        align-self: stretch;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        margin-top: var(--space-18);
        text-align: start;

        &:first-of-type {
            margin-top: var(--space-22);
        }
    }

    .field {
        display: flex;
        align-items: center;
        gap: var(--space-10);
        height: 58px;
        padding: 0 var(--space-16);
        border-radius: var(--radius-xl);
        background: var(--overlay-1);

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus-within:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    .at {
        font: var(--weight-semibold) text-size(18px) / 1 var(--font-mono);
        color: var(--ink-4);
        margin-inline-end: calc(var(--space-8) * -1);
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .username {
        padding-inline-start: var(--space-2);
        font: var(--weight-semibold) text-size(18px) / 1 var(--font-mono);
    }

    .email {
        // 16px at least, so iOS doesn't zoom into the field
        font: var(--weight-medium) max(16px, text-size(16px)) / 1 var(--font-sans);
    }

    .mail {
        @include icon(mail, 18px, var(--ink-4));
    }

    .tick {
        @include icon(check, 18px, var(--status-online));
    }

    .note {
        padding: 0 var(--space-4);
        font: var(--weight-medium) text-size(12.5px) / 1.4 var(--font-sans);
        color: var(--ink-4);
        text-wrap: pretty;

        &.ok {
            color: var(--status-online);
        }

        &.warn {
            color: var(--status-warning);
        }
    }

    .footer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 0 var(--space-16) var(--bar-end);
    }

    .error {
        margin: 0;
        padding: 0 var(--space-4);
        font: var(--weight-medium) text-size(13px) / 1.4 var(--font-sans);
        color: var(--status-warning);
    }

    .referrer {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-12) var(--space-14);
        border-radius: var(--radius-xl);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
    }

    .photo {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        object-fit: cover;
    }

    .who {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        text-align: start;
    }

    .title {
        font: var(--weight-bold) text-size(14.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .remove {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        margin-inline-end: calc(var(--space-12) * -1);
        @include flex-center;
        border: 0;
        background: none;
        cursor: pointer;

        span {
            @include icon(close, 14px, var(--ink-3));
        }
    }

    .chat-icon {
        @include icon(chat, 18px, var(--ink-4));
    }

    .ask {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        height: 52px;
        padding: 0 var(--space-14);
        border: 0;
        border-radius: var(--radius-lg);
        background: none;
        box-shadow: inset 0 0 0 1px var(--line-1);
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

    .user-icon {
        @include icon(user, 18px, var(--ink-3));
    }

    .ask-label {
        flex: 1;
        min-width: 0;
        text-align: start;
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
    }

    .optional {
        flex: none;
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }
</style>
