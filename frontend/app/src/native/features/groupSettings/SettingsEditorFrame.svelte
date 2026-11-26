<!-- A settings page's frame around its draft, a group's or channel's (GroupSettingsEditor) or a
     community's (CommunitySettingsEditor): the header (Back asks before it drops unsaved changes:
     TODO(design), the plan doesn't say; the web's Manage asks the same), the page, and the pinned
     Save, which only does anything once something has changed (as Edit profile's). The questions a
     save can need (renaming a verified group or community, changing who can see it) show as an
     alert; the answer goes back to `onSave`. Toasts (a gate taken off, with Undo) sit above Save. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { untrack, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import { guardsLeaving } from "./editorBack";

    type Props = {
        title: string;
        /** Whether the viewer can save here: without it, the page is read only, with no Save. */
        editable: boolean;
        /** Whether the draft has anything a save would send. */
        changed: boolean;
        /** Whether Save does anything: changed, valid and not saving already. */
        canSave: boolean;
        busy: boolean;
        /** The question a save is waiting on (translated), if any. */
        asking: string | undefined;
        /** Save, or the answer to `asking` (`yes`; true for a plain Save). */
        onSave: (yes: boolean) => void;
        context: ScreenContext;
        children: Snippet;
    };

    let { title, editable, changed, canSave, busy, asking, onSave, context, children }: Props =
        $props();

    const overlays = untrack(() => context.overlays);

    useOverlay(
        overlays,
        () => asking !== undefined,
        () => onSave(false),
    );

    // ---- leaving with unsaved changes asks first, from the header's Back and Android's. The
    // guard is registered only while this is its tab's top screen (guardsLeaving): with a screen
    // pushed over it (a gate's entries), Android's back pops that one instead

    let discarding = $state(false);
    useOverlay(
        overlays,
        () => guardsLeaving({ onTop: context.onTop(), changed, discarding, busy }),
        () => (discarding = true),
    );
    useOverlay(
        overlays,
        () => discarding,
        () => (discarding = false),
    );

    let footerHeight = $state<number>();
    $effect(() => context.toastFloor(footerHeight));
    $effect(() => () => context.toastFloor(undefined));

    function back() {
        if (changed && !busy) discarding = true;
        else context.back?.();
    }
</script>

<div class="editor">
    <NativePageHeader {title} onBack={back} />

    <div class="body" class:end={!editable} {@attach aboveKeyboard()}>
        {@render children()}
    </div>

    {#if editable}
        <div class="footer" bind:offsetHeight={footerHeight}>
            <Button
                label={$_(
                    busy
                        ? "native.groupSettings.saving"
                        : changed
                          ? "native.groupSettings.save"
                          : "native.groupSettings.noChanges",
                )}
                size="lg"
                fullWidth
                disabled={!canSave}
                onClick={() => onSave(true)} />
        </div>
    {/if}
</div>

<NativeAlert
    open={asking !== undefined}
    title={$_("areYouSure")}
    message={asking ?? ""}
    confirmLabel={$_("yesPlease")}
    cancelLabel={$_("noThanks")}
    {busy}
    onConfirm={() => onSave(true)}
    onClose={() => onSave(false)} />

<NativeAlert
    open={discarding}
    title={$_("native.groupSettings.discardTitle")}
    message={$_("native.groupSettings.discardMessage")}
    confirmLabel={$_("native.groupSettings.discard")}
    cancelLabel={$_("native.groupSettings.keepEditing")}
    danger
    onConfirm={() => {
        discarding = false;
        context.back?.();
    }}
    onClose={() => (discarding = false)} />

<style lang="scss">
    .editor {
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
        padding-bottom: var(--space-24);

        // no Save under it: the pushed screens' end padding
        &.end {
            padding-bottom: var(--scroll-end);
        }
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
    }
</style>
