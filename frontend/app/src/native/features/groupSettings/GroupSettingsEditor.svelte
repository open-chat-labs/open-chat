<!-- A group's or channel's settings page with its draft: the header (Back asks before it drops
     unsaved changes: TODO(design), the plan doesn't say; the web's Manage asks the same), the page
     (GeneralPage, GatesPage, RulesPage or PermissionsPage) on its own UpdateGroupState, made from
     the chat and its rules as the page opens, and the pinned Save, which only does anything once
     something has changed (as Edit profile's). Saving sends what changed (the client's
     updateGroup), asking first where the client says a change needs it (renaming a verified group,
     changing who can see it: the web's and the old pages' questions), and goes back to the details
     with a toast. What the viewer's role can't change shows read only (chatManageAccess). -->
<script lang="ts">
    import {
        anonUserStore,
        candidateGroupFromChat,
        chatIdentifierToString,
        selectedCommunitySummaryStore,
        type MultiUserChat,
        type OpenChat,
        type VersionedRules,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import {
        chatManageAccess,
        type ReadOnlySetting,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import type { GroupSettingsPage } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import GatesPage from "./GatesPage.svelte";
    import GeneralPage from "./GeneralPage.svelte";
    import PermissionsPage from "./PermissionsPage.svelte";
    import RulesPage from "./RulesPage.svelte";
    import { savedThreadPermissions } from "./savedThreads";
    import { draftSavable, hasSavableChanges, pageTitle, threadsAsSaved } from "./settings.adapter";

    type Props = {
        chat: MultiUserChat;
        /** The chat's rules: undefined until its details are in (GroupSettingsScreen waits for them on the Rules page). */
        rules: VersionedRules | undefined;
        page: Exclude<GroupSettingsPage, "bots" | "stats">;
        context: ScreenContext;
    };

    let { chat, rules, page, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const overlays = untrack(() => context.overlays);

    const community = $derived(chat.kind === "channel" ? $selectedCommunitySummaryStore : undefined);
    const access = $derived(chatManageAccess(client, chat, community, $anonUserStore));
    const ALL: ReadOnlySetting[] = ["gates", "rules", "permissions", "disappearing", "visibility"];
    const readOnly = $derived(access.kind === "edit" ? access.readOnly : ALL);
    // the permissions are the owner's: anyone else sees them, with nothing to save
    const editable = $derived(
        access.kind === "edit" && !(page === "permissions" && readOnly.includes("permissions")),
    );

    // the draft: the chat and its rules as the page opened, which a save moves on; the threads'
    // permissions as saved last, while the client's local update would misread them (savedThreads)
    const editor = new UpdateGroupState();
    const opened = candidateGroupFromChat(
        untrack(() => chat),
        untrack(() => rules),
    );
    editor.initialise({
        ...opened,
        permissions: savedThreadPermissions.apply(opened.id, opened.permissions),
    });

    // only what a save would send counts as a change (hasSavableChanges)
    const changed = $derived(hasSavableChanges(editor.original, editor.candidateGroup));
    const canSave = $derived(
        changed && draftSavable(editor.candidateGroup, editor.valid) && !editor.busy,
    );

    // ---- saving, and the questions a change can need

    const asking = $derived(
        editor.showingVerificationWarning
            ? i18nKey("verified.nameChangeWarning", undefined, chat.level, true)
            : editor.confirming
              ? i18nKey(
                    `confirmMakeGroup${editor.candidateGroup.public ? "Public" : "Private"}`,
                    undefined,
                    chat.level,
                    true,
                )
              : undefined,
    );
    useOverlay(
        overlays,
        () => asking !== undefined,
        () => void save(false),
    );

    async function save(yes: boolean = true) {
        // the name as it's checked (draftSavable): trimmed
        const name = editor.candidateGroup.name.trim();
        if (name !== editor.candidateGroup.name) editor.candidateGroup.name = name;
        // what the server will hold once it's saved, worked out from the draft as it's sent
        const threads = threadsAsSaved(
            $state.snapshot(editor.original),
            $state.snapshot(editor.candidateGroup),
        );
        const outcome = await editor.saveGroup(client, yes);
        switch (outcome.kind) {
            case "success":
                savedThreadPermissions.remember(chat.id, threads);
                context.toast($_("native.groupSettings.saved"));
                context.back?.();
                return;
            case "unchanged":
                context.toast($_("native.groupSettings.saved"));
                context.back?.();
                return;
            case "failed":
                context.toast(interpolateNewUi($_, outcome.message));
                return;
            // asked (the alert shows), declined (the change is back as it was), or not valid (why
            // is under the field)
            default:
                return;
        }
    }

    // ---- leaving with unsaved changes asks first, from the header's Back and Android's

    let discarding = $state(false);
    useOverlay(
        overlays,
        () => changed && !discarding && !editor.busy,
        () => (discarding = true),
    );
    useOverlay(
        overlays,
        () => discarding,
        () => (discarding = false),
    );

    // toasts (a gate taken off, with Undo) sit above Save rather than over it
    let footerHeight = $state<number>();
    $effect(() => context.toastFloor(footerHeight));
    $effect(() => () => context.toastFloor(undefined));

    function back() {
        if (changed && !editor.busy) discarding = true;
        else context.back?.();
    }
</script>

<div class="editor">
    <NativePageHeader title={pageTitle(page, chat.kind === "channel", t)} onBack={back} />

    <div class="body" class:end={!editable} {@attach aboveKeyboard()}>
        {#if page === "edit"}
            <GeneralPage
                {editor}
                creating={false}
                {readOnly}
                color={senderColor(chatIdentifierToString(chat.id))}
                {context} />
        {:else if page === "gates"}
            <GatesPage {editor} {context} />
        {:else if page === "rules"}
            <RulesPage {editor} />
        {:else}
            <PermissionsPage {editor} readOnly={readOnly.includes("permissions")} />
        {/if}
    </div>

    {#if editable}
        <div class="footer" bind:offsetHeight={footerHeight}>
            <Button
                label={$_(
                    editor.busy
                        ? "native.groupSettings.saving"
                        : changed
                          ? "native.groupSettings.save"
                          : "native.groupSettings.noChanges",
                )}
                size="lg"
                fullWidth
                disabled={!canSave}
                onClick={() => void save()} />
        </div>
    {/if}
</div>

<NativeAlert
    open={asking !== undefined}
    title={$_("areYouSure")}
    message={asking === undefined ? "" : interpolateNewUi($_, asking)}
    confirmLabel={$_("yesPlease")}
    cancelLabel={$_("noThanks")}
    busy={editor.busy}
    onConfirm={() => void save(true)}
    onClose={() => void save(false)} />

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
