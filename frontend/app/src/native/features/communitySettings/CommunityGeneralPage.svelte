<!-- Edit community (from its details' cover; the plan draws Create community's Details: "banner,
     avatar, name check, description, language sheet"): the banner, picked and cropped to its shape
     in a sheet (start's AvatarCropSheet, as Edit profile's cover), the photo over it, cropped square,
     both sent with the save; the name (3 to 25 characters), the description (growing, its length);
     the language, picked in the language sheet (start's, one language); and the Settings card's
     Public community, the owner's (`readOnly` "visibility", a fact for an admin). A community has no
     history or disappearing messages. All of it edits the draft (`editor`, the shared
     UpdateCommunityState) until it's saved. -->
<script lang="ts">
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import {
        MAX_DESC_LENGTH,
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        type UpdateCommunityState,
    } from "@src/logic/groupOrCommunity/community.svelte";
    import type { ReadOnlySetting } from "@src/logic/groupOrCommunity/detailsPermissions";
    import type { Swatch } from "@src/logic/swatch";
    import {
        AVATAR_SIZE,
        BANNER_SIZE,
        cropImage,
        readImageFile,
        type CropArea,
    } from "@src/utils/imageCrop";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import FactRow from "../details/FactRow.svelte";
    import AvatarCropSheet from "../start/AvatarCropSheet.svelte";
    import LanguageSheet from "../start/LanguageSheet.svelte";
    import { communityNameValid } from "./communitySettings.adapter";

    type Props = {
        editor: UpdateCommunityState;
        readOnly: ReadOnlySetting[];
        /** The swatch behind the photo while it has none. */
        color: Swatch;
        context: ScreenContext;
    };

    let { editor, readOnly, color, context }: Props = $props();

    const overlays = untrack(() => context.overlays);
    const community = $derived(editor.candidateCommunity);

    // ---- the banner and the photo, cropped in a sheet and kept in the draft until it's saved

    type Target = "avatar" | "banner";
    let fileInput = $state<HTMLInputElement>();
    let picking: Target = "avatar";
    let crop = $state<{ source: string; target: Target; open: boolean }>();
    useOverlay(
        overlays,
        () => crop?.open === true,
        () => closeCrop(),
    );

    function pick(target: Target) {
        picking = target;
        fileInput?.click();
    }

    async function picked(e: Event & { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file === undefined) return;
        try {
            crop = { source: await readImageFile(file), target: picking, open: true };
        } catch (err) {
            console.warn("Unable to read the picked image", err);
            context.toast($_("native.groupSettings.photoFailed"));
        }
    }

    function closeCrop() {
        if (crop !== undefined) crop = { ...crop, open: false };
    }

    async function cropped(area: CropArea) {
        if (crop === undefined) return;
        const { source, target } = crop;
        closeCrop();
        const image = await cropImage(source, area, target === "banner" ? BANNER_SIZE : AVATAR_SIZE);
        if (image === undefined) context.toast($_("native.groupSettings.photoFailed"));
        else if (target === "banner") editor.bannerSelected(image);
        else editor.avatarSelected(image);
    }

    // ---- the fields

    // the rule Save goes by (communityDraftSavable): the name trimmed, as it's saved
    const nameBad = $derived(community.name.length > 0 && !communityNameValid(community.name));
    const descriptionTooLong = $derived(community.description.length > MAX_DESC_LENGTH);

    function grow(el: HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }

    // ---- the language, one picked in the sheet

    let languages = $state(false);
    useOverlay(
        overlays,
        () => languages,
        () => (languages = false),
    );
    const language = $derived(
        supportedLanguagesByCode[community.primaryLanguage]?.name ?? community.primaryLanguage,
    );
</script>

<div
    class="cover"
    class:image={community.banner.blobUrl !== undefined}
    style:background-image={community.banner.blobUrl !== undefined
        ? `url("${community.banner.blobUrl}")`
        : undefined}>
    <button
        type="button"
        class="cover-button"
        disabled={editor.busy}
        aria-label={$_("native.communitySettings.changeBanner")}
        onclick={() => pick("banner")}>
        <span class="camera"></span>
        {$_("native.communitySettings.banner")}
    </button>
</div>

<div class="photo-row">
    <button
        type="button"
        class="photo"
        disabled={editor.busy}
        aria-label={$_("native.groupSettings.changePhoto")}
        onclick={() => pick("avatar")}>
        {#if community.avatar.blobUrl}
            <img src={community.avatar.blobUrl} alt="" />
        {:else}
            <Avatar size={96} shape="squircle" {color} />
        {/if}
        <span class="badge"><span class="badge-icon"></span></span>
    </button>
</div>

<div class="fields">
    <div class="field-group">
        <div class="label"><ListSectionLabel label={$_("native.groupSettings.name")} /></div>
        <label class="field" class:warn={nameBad}>
            <input
                value={community.name}
                oninput={(e) => (editor.candidateCommunity.name = e.currentTarget.value)}
                placeholder={$_("native.communitySettings.namePlaceholder")}
                aria-label={$_("native.groupSettings.name")}
                disabled={editor.busy}
                maxlength={MAX_NAME_LENGTH}
                autocomplete="off"
                enterkeyhint="next" />
        </label>
        <span class="note" class:warn={nameBad}>
            {$_("native.groupSettings.nameRules", {
                values: { min: MIN_NAME_LENGTH, max: MAX_NAME_LENGTH },
            })}
        </span>
    </div>

    <div class="field-group">
        <div class="label count-label">
            <ListSectionLabel label={$_("native.groupSettings.description")} />
            <span class="count" class:warn={descriptionTooLong}>
                {community.description.length} / {MAX_DESC_LENGTH}
            </span>
        </div>
        <textarea
            class="description"
            class:warn={descriptionTooLong}
            value={community.description}
            oninput={(e) => {
                editor.candidateCommunity.description = e.currentTarget.value;
                grow(e.currentTarget);
            }}
            {@attach grow}
            rows="3"
            placeholder={$_("native.groupSettings.descriptionPlaceholder")}
            aria-label={$_("native.groupSettings.description")}
            disabled={editor.busy}></textarea>
    </div>
</div>

<div class="cards">
    <SettingsGroup label={$_("native.groupSettings.settings")}>
        <SettingsLink
            label={$_("native.community.language")}
            value={language}
            onClick={() => {
                if (!editor.busy) languages = true;
            }} />
        {#if readOnly.includes("visibility")}
            <FactRow
                label={$_("native.communitySettings.public")}
                value={$_(community.public ? "access.public" : "access.private")} />
        {:else}
            <SettingsSwitch
                label={$_("native.communitySettings.public")}
                help={$_("native.communitySettings.publicHelp")}
                on={community.public}
                disabled={editor.busy}
                onChange={(on) => (editor.candidateCommunity.public = on)} />
        {/if}
    </SettingsGroup>
</div>

<input hidden type="file" accept="image/*" onchange={picked} bind:this={fileInput} />

{#if crop !== undefined}
    {#key crop.source}
        <AvatarCropSheet
            open={crop.open}
            source={crop.source}
            title={$_(
                crop.target === "banner"
                    ? "native.communitySettings.banner"
                    : "native.communitySettings.photo",
            )}
            aspect={crop.target === "banner" ? BANNER_SIZE.width / BANNER_SIZE.height : 1}
            round={false}
            onCrop={cropped}
            onClose={closeCrop} />
    {/key}
{/if}

<LanguageSheet
    open={languages}
    onClose={() => (languages = false)}
    title={$_("native.community.language")}
    selected={(code) => code === community.primaryLanguage}
    onPick={(code) => {
        editor.candidateCommunity.primaryLanguage = code;
        languages = false;
    }} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // the banner, as Edit profile's cover
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

    // over the banner, whatever it shows: the library cover buttons' chip (PanelCover)
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

    .photo-row {
        position: relative;
        display: flex;
        justify-content: center;
        margin-top: -48px;
    }

    .photo {
        position: relative;
        width: 96px;
        height: 96px;
        padding: 0;
        border: 0;
        border-radius: 28px;
        background: var(--surface-0);
        box-shadow: 0 0 0 4px var(--surface-0);
        cursor: pointer;

        img {
            width: 100%;
            height: 100%;
            border-radius: 28px;
            object-fit: cover;
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
        inset-inline-end: -4px;
        bottom: -4px;
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

    .count-label {
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

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .description {
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

        &::placeholder {
            color: var(--ink-4);
        }

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

        &.warn {
            color: var(--status-warning);
        }
    }

    .cards {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 26px var(--space-16) 0;
    }
</style>
