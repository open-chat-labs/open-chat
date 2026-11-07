<!-- Edit profile (native design notes §3.11), pushed from the You tab: the cover (a premium item,
     paid in CHIT before the first one) and the photo, each picked, cropped in a sheet and uploaded
     at once (logic/profile/profileImages), then the display name, the username with its live check,
     and the bio, saved together with the pinned Save, which only does anything once something has
     changed (logic/profile/profileForm, as the web's profile). Saving goes back to the You tab. -->
<script lang="ts">
    import {
        anonUserStore,
        buildUserAvatarUrl,
        buildUserBackgroundUrl,
        currentUserIdStore,
        currentUserProfileStore,
        MAX_BIO_LENGTH,
        PremiumItem,
        premiumItemsStore,
        suspendedUserStore,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { ProfileForm } from "@src/logic/profile/profileForm.svelte";
    import { ProfileImages, type ProfileImage } from "@src/logic/profile/profileImages.svelte";
    import { BANNER_SIZE, readImageFile, type CropArea } from "@src/utils/imageCrop";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import AvatarCropSheet from "../start/AvatarCropSheet.svelte";
    import CoverPaymentSheet from "./CoverPaymentSheet.svelte";
    import { displayNameNote, profileUsernameNote } from "./you.adapter";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "edit_profile" }>> = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    const readOnly = $derived($suspendedUserStore || $anonUserStore);
    const form = new ProfileForm(
        client,
        () => $currentUserProfileStore,
        () => readOnly,
    );
    onDestroy(() => form.destroy());
    // as it may have changed on another device since sign-in
    onMount(() => client.refreshCurrentUserProfile());

    const userId = $derived($currentUserIdStore);
    const profile = $derived($currentUserProfileStore);

    // ---- the photo and the cover, saved as soon as they're cropped

    const images = new ProfileImages(client);
    const avatarUrl = $derived(
        images.preview.avatar ?? buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId),
    );
    const coverUrl = $derived(
        images.preview.cover ??
            buildUserBackgroundUrl(blobUrlPattern, userId, profile.backgroundId),
    );

    let fileInput = $state<HTMLInputElement>();
    let picking: ProfileImage = "avatar";
    // the picked image being cropped; kept while its sheet plays its way out
    let crop = $state<{ target: ProfileImage; source: string; open: boolean }>();
    let paying = $state(false);
    useOverlay(
        overlays,
        () => crop?.open === true,
        () => closeCrop(),
    );
    useOverlay(
        overlays,
        () => paying,
        () => (paying = false),
    );

    function pick(target: ProfileImage) {
        if (readOnly || images.uploading[target]) return;
        picking = target;
        fileInput?.click();
    }

    function editCover() {
        if ($premiumItemsStore.has(PremiumItem.CustomProfileBackground)) pick("cover");
        else paying = true;
    }

    async function picked(e: Event & { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        // the same file picked again is a change too
        e.currentTarget.value = "";
        if (file === undefined) return;
        const target = picking;
        try {
            crop = { target, source: await readImageFile(file), open: true };
        } catch (err) {
            console.warn("Unable to read the picked image", err);
            context.toast($_(target === "avatar" ? "avatarUpdateFailed" : "profile.backgroundUpdateFailed"));
        }
    }

    function closeCrop() {
        if (crop !== undefined) crop = { ...crop, open: false };
    }

    async function cropped(area: CropArea) {
        if (crop === undefined) return;
        const { target, source } = crop;
        closeCrop();
        // the cover is a banner here, as components_mobile saves it
        const outcome = await images.save(
            target,
            source,
            area,
            target === "cover" ? BANNER_SIZE : undefined,
        );
        if (outcome.kind === "failed") context.toast($_(outcome.reason));
    }

    // ---- the fields

    const usernameNote = $derived(
        profileUsernameNote(
            form.username.status,
            form.username.value,
            form.username.error === undefined ? form.usernameError : undefined,
        ),
    );
    const nameNote = $derived(displayNameNote(form.displayNameValid, form.errors.displayName));
    const bioTooLong = $derived(!form.bioValid);

    const changed = $derived.by(() => {
        const { username, displayName, bio } = form.changes;
        return username || displayName || bio;
    });

    // autogrowing bio
    function grow(el: HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }

    async function save() {
        const outcome = await form.save();
        switch (outcome.kind) {
            case "saved":
                context.toast($_("native.you.editProfile.saved"));
                context.back?.();
                break;
            case "failed":
                context.toast(interpolate($_, outcome.reason));
                break;
            // rejected: why is under the field; nothing: there was nothing to save
        }
    }
</script>

<div class="edit">
    <NativePageHeader title={$_("native.you.editProfile.title")} onBack={context.back} />

    <div class="body">
        <div
            class="cover"
            class:image={coverUrl !== undefined}
            style:background-image={coverUrl !== undefined ? `url("${coverUrl}")` : undefined}>
            {#if !readOnly}
                <button
                    type="button"
                    class="cover-button"
                    disabled={images.uploading.cover}
                    aria-label={$_("native.you.editProfile.changeCover")}
                    onclick={editCover}>
                    <span class="camera"></span>
                    {$_("native.you.editProfile.cover")}
                </button>
            {/if}
        </div>

        <div class="avatar-row">
            <button
                type="button"
                class="avatar"
                class:busy={images.uploading.avatar}
                disabled={readOnly}
                aria-label={$_("native.you.editProfile.changePhoto")}
                onclick={() => pick("avatar")}>
                <img src={avatarUrl} alt="" />
                {#if !readOnly}<span class="badge"><span class="badge-icon"></span></span>{/if}
            </button>
        </div>

        <div class="fields">
            <div class="field-group">
                <div class="label"><ListSectionLabel label={$_("native.you.editProfile.displayName")} /></div>
                <label class="field" class:warn={nameNote.tone === "warn"}>
                    <input
                        value={form.displayName ?? ""}
                        oninput={(e) => (form.displayName = e.currentTarget.value)}
                        placeholder={profile.username}
                        aria-label={$_("native.you.editProfile.displayName")}
                        disabled={readOnly}
                        autocomplete="off"
                        maxlength="25" />
                </label>
                <span class="note {nameNote.tone}">{$_(nameNote.key, { values: nameNote.values })}</span>
            </div>

            <div class="field-group">
                <div class="label"><ListSectionLabel label={$_("native.you.editProfile.username")} /></div>
                <label class="field" class:warn={usernameNote.tone === "warn"}>
                    <span class="at">@</span>
                    <input
                        class="mono"
                        value={form.username.value}
                        oninput={(e) => form.username.set(e.currentTarget.value)}
                        aria-label={$_("native.you.editProfile.username")}
                        disabled={readOnly}
                        autocomplete="off"
                        autocapitalize="none"
                        spellcheck="false" />
                    {#if form.username.status === "available"}<span class="ok"></span>{/if}
                </label>
                <span class="note {usernameNote.tone}">
                    {$_(usernameNote.key, { values: usernameNote.values })}
                </span>
            </div>

            <div class="field-group">
                <div class="label bio-label">
                    <ListSectionLabel label={$_("native.you.editProfile.bio")} />
                    <span class="count" class:warn={bioTooLong}>
                        {form.bio.length} / {MAX_BIO_LENGTH}
                    </span>
                </div>
                <textarea
                    class="bio"
                    class:warn={bioTooLong || form.errors.bio !== undefined}
                    value={form.bio}
                    oninput={(e) => {
                        form.bio = e.currentTarget.value;
                        grow(e.currentTarget);
                    }}
                    {@attach grow}
                    rows="3"
                    aria-label={$_("native.you.editProfile.bio")}
                    disabled={readOnly}></textarea>
                {#if form.errors.bio !== undefined}
                    <span class="note warn">{$_(form.errors.bio)}</span>
                {/if}
            </div>
        </div>
    </div>

    {#if !readOnly}
        <div class="footer">
            <Button
                label={$_(
                    form.saving
                        ? "native.you.editProfile.saving"
                        : changed
                          ? "native.you.editProfile.save"
                          : "native.you.editProfile.noChanges",
                )}
                size="lg"
                fullWidth
                disabled={!form.canSave}
                onClick={() => void save()} />
        </div>
    {/if}
</div>

<input hidden type="file" accept="image/*" onchange={picked} bind:this={fileInput} />

{#if crop !== undefined}
    {#key crop.source}
        <AvatarCropSheet
            open={crop.open}
            source={crop.source}
            title={crop.target === "cover" ? $_("native.you.editProfile.cover") : undefined}
            aspect={crop.target === "cover" ? BANNER_SIZE.width / BANNER_SIZE.height : 1}
            round={crop.target === "avatar"}
            onCrop={cropped}
            onClose={closeCrop} />
    {/key}
{/if}

<CoverPaymentSheet
    open={paying}
    onChoose={() => {
        paying = false;
        pick("cover");
    }}
    onFailed={(reason) => context.toast(reason)}
    onClose={() => (paying = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .edit {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        padding-bottom: var(--space-16);
    }

    .cover {
        position: relative;
        height: 150px;
        margin: 4px var(--space-16) 0;
        border-radius: 18px;
        background: linear-gradient(
            140deg,
            var(--accent) 0%,
            color-mix(in oklch, var(--accent) 40%, var(--hero-base)) 100%
        );

        &.image {
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
        }
    }

    // over the cover, whatever it shows: the library cover buttons' chip (PanelCover)
    .cover-button {
        position: absolute;
        top: 10px;
        inset-inline-end: 10px;
        display: flex;
        align-items: center;
        gap: 7px;
        height: 36px;
        padding: 0 12px;
        border: 0;
        border-radius: 18px;
        background: var(--on-cover-bg);
        color: var(--on-cover-ink);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        cursor: pointer;

        // the tap area is the touch target, the chip stays 36px
        &::before {
            content: "";
            position: absolute;
            inset: calc((36px - var(--touch-target)) / 2) 0;
        }

        &:focus-visible {
            @include focus-ring;
        }

        &:disabled {
            opacity: 0.6;
        }
    }

    .camera {
        @include icon(camera, 15px);
    }

    .avatar-row {
        position: relative;
        display: flex;
        justify-content: center;
        margin-top: -48px;
    }

    .avatar {
        position: relative;
        width: 96px;
        height: 96px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: var(--surface-0);
        box-shadow: 0 0 0 4px var(--surface-0);
        cursor: pointer;

        img {
            width: 100%;
            height: 100%;
            border-radius: var(--radius-circle);
            object-fit: cover;
        }

        &.busy img {
            opacity: 0.6;
        }

        &:disabled {
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .badge {
        position: absolute;
        inset-inline-end: -2px;
        bottom: -2px;
        width: 34px;
        height: 34px;
        @include flex-center;
        border-radius: var(--radius-circle);
        background: var(--accent);
        box-shadow: 0 0 0 3px var(--surface-0);
    }

    .badge-icon {
        @include icon(camera, 16px, var(--on-accent));
    }

    .fields {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 22px var(--space-16) 0;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .label {
        padding-inline-start: 4px;
    }

    .bio-label {
        display: flex;
        align-items: center;

        :global(> :first-child) {
            flex: 1;
        }
    }

    .count {
        font: var(--weight-medium) text-size(11.5px) / 1 var(--font-mono);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }

    .field {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 52px;
        padding: 0 var(--space-16);
        border-radius: 14px;
        background: var(--overlay-1);

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus-within:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    .at {
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-mono);
        color: var(--ink-4);
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
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-sans);

        &.mono {
            font-family: var(--font-mono);
        }

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .ok {
        @include icon(check, 16px, var(--status-online));
    }

    .bio {
        display: block;
        width: 100%;
        min-height: 96px;
        box-sizing: border-box;
        padding: 14px var(--space-16);
        border: 0;
        outline: 0;
        resize: none;
        overflow: hidden;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) text-size(15px) / 1.45 var(--font-sans);

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    .note {
        padding: 0 4px;
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-4);

        &.ok {
            color: var(--status-online);
        }

        &.warn {
            color: var(--status-warning);
        }
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }
</style>
