<!-- A group's or channel's general settings (native plan 11; Edit group from its details, and
     Create group's Details): the photo, picked and cropped in a sheet (start's AvatarCropSheet)
     and sent with the save, the name and the description, then the Settings card: Public, Message
     history and Disappearing messages, the library's TimedToggle (the details' lengths, 4 × 2,
     starting at a day). All of it edits the draft (`editor`, the shared UpdateGroupState) until it's
     saved. Editing, who sees the history is a fact (it's set when the group is made: the client
     has no change for it), and Public and Disappearing messages are the owner's (`readOnly`, from
     chatManageAccess), read only for the rest. `settings` adds rows to the card (Create group's
     links to its gates, rules and permissions). -->
<script lang="ts">
    import TimedToggle from "@openchat/ui/src/lib/components/TimedToggle.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import { disappearingSetting } from "@src/logic/chats/chatDisappearing.svelte";
    import {
        disappearingChoicesWith,
        durationMs,
        ttlDurationId,
    } from "@src/logic/chats/disappearingMessages";
    import type { ReadOnlySetting } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        MAX_DESC_LENGTH,
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        type UpdateGroupState,
    } from "@src/logic/groupOrCommunity/group.svelte";
    import { AVATAR_SIZE, cropImage, readImageFile, type CropArea } from "@src/utils/imageCrop";
    import { untrack, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import {
        disappearAfterLabel,
        disappearingValue,
        durationLabel,
        historyValue,
    } from "../details/details.adapter";
    import FactRow from "../details/FactRow.svelte";
    import AvatarCropSheet from "../start/AvatarCropSheet.svelte";
    import { nameLengthValid } from "./settings.adapter";

    type Props = {
        editor: UpdateGroupState;
        /** Creating it: who sees the history is a switch, not a fact. */
        creating: boolean;
        readOnly: ReadOnlySetting[];
        /** The swatch behind the photo while it has none. */
        color: "violet" | "blue" | "teal" | "amber" | "plum";
        context: ScreenContext;
        /** More of the Settings card's rows. */
        settings?: Snippet;
    };

    let { editor, creating, readOnly, color, context, settings }: Props = $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const overlays = untrack(() => context.overlays);
    const group = $derived(editor.candidateGroup);
    const channel = $derived(group.level === "channel");

    // ---- the photo, cropped in a sheet and kept in the draft until it's saved

    let fileInput = $state<HTMLInputElement>();
    let crop = $state<{ source: string; open: boolean }>();
    useOverlay(
        overlays,
        () => crop?.open === true,
        () => closeCrop(),
    );

    async function picked(e: Event & { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file === undefined) return;
        try {
            crop = { source: await readImageFile(file), open: true };
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
        const { source } = crop;
        closeCrop();
        const image = await cropImage(source, area, AVATAR_SIZE);
        if (image === undefined) context.toast($_("native.groupSettings.photoFailed"));
        else editor.groupAvatarSelected(image);
    }

    // ---- the fields

    // the rule Save goes by (draftSavable): the name trimmed, as it's saved
    const nameBad = $derived(group.name.length > 0 && !nameLengthValid(group.name));
    const descriptionTooLong = $derived(group.description.length > MAX_DESC_LENGTH);

    function grow(el: HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }

    // ---- disappearing messages: switched off, the length it goes back to is the last one picked

    let last = $state(untrack(() => ttlDurationId(editor.candidateGroup.eventsTTL)));
    const disappear = $derived(disappearingSetting(group.eventsTTL, last));

    function setDisappearing(on: boolean, after: string) {
        last = after;
        editor.candidateGroup.eventsTTL = on ? BigInt(durationMs(after)) : undefined;
    }
</script>

<div class="photo-row">
    <button
        type="button"
        class="photo"
        disabled={editor.busy}
        aria-label={$_("native.groupSettings.changePhoto")}
        onclick={() => fileInput?.click()}>
        {#if group.avatar?.blobUrl}
            <img src={group.avatar.blobUrl} alt="" />
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
                value={group.name}
                oninput={(e) => (editor.candidateGroup.name = e.currentTarget.value)}
                placeholder={$_(
                    channel
                        ? "native.groupSettings.channelNamePlaceholder"
                        : "native.groupSettings.namePlaceholder",
                )}
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
                {group.description.length} / {MAX_DESC_LENGTH}
            </span>
        </div>
        <textarea
            class="description"
            class:warn={descriptionTooLong}
            value={group.description}
            oninput={(e) => {
                editor.candidateGroup.description = e.currentTarget.value;
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
        {#if readOnly.includes("visibility")}
            <FactRow
                label={$_(
                    channel ? "native.groupSettings.publicChannel" : "native.groupSettings.public",
                )}
                value={$_(group.public ? "access.public" : "access.private")} />
        {:else}
            <SettingsSwitch
                label={$_(channel ? "native.groupSettings.publicChannel" : "native.groupSettings.public")}
                help={$_(
                    channel
                        ? "native.groupSettings.publicChannelHelp"
                        : "native.groupSettings.publicHelp",
                )}
                on={group.public}
                disabled={editor.busy}
                onChange={(on) => (editor.candidateGroup.public = on)} />
        {/if}
        {#if creating}
            <SettingsSwitch
                label={$_("native.groupSettings.history")}
                help={$_("native.groupSettings.historyHelp")}
                on={group.historyVisible}
                disabled={editor.busy}
                onChange={(on) => (editor.candidateGroup.historyVisible = on)} />
        {:else}
            <FactRow
                label={$_("native.groupSettings.history")}
                value={historyValue(group.historyVisible, t)} />
        {/if}
        {#if readOnly.includes("disappearing")}
            <FactRow
                label={$_("native.details.disappearing")}
                value={disappearingValue(group.eventsTTL, t)} />
        {:else}
            <!-- the lengths and "After 30 days" are the app's words (the library's are English only) -->
            <div class="settings-row">
                <TimedToggle
                    label={$_("native.details.disappearing")}
                    on={disappear.on}
                    value={disappear.after}
                    options={disappearingChoicesWith(disappear.after)}
                    valueLabel={(id) => durationLabel(id, t)}
                    subtitle={(id) => disappearAfterLabel(id, t)}
                    offHint={$_("native.you.off")}
                    onChange={(on) => setDisappearing(on, disappear.after)}
                    onDurationChange={(length) => setDisappearing(true, length)} />
            </div>
        {/if}
        {@render settings?.()}
    </SettingsGroup>
</div>

<input hidden type="file" accept="image/*" onchange={picked} bind:this={fileInput} />

{#if crop !== undefined}
    {#key crop.source}
        <AvatarCropSheet
            open={crop.open}
            source={crop.source}
            title={$_("native.groupSettings.photo")}
            round={false}
            onCrop={cropped}
            onClose={closeCrop} />
    {/key}
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .photo-row {
        display: flex;
        justify-content: center;
        padding-top: 12px;
    }

    .photo {
        position: relative;
        width: 96px;
        height: 96px;
        padding: 0;
        border: 0;
        border-radius: 28px;
        background: none;
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
