<!-- A group's or channel's settings page with its draft, in the editor's frame
     (SettingsEditorFrame: the header, Back asking before it drops unsaved changes, the pinned Save):
     the page (GeneralPage, GatesPage, RulesPage or PermissionsPage) on its own UpdateGroupState,
     made from the chat and its rules as the page opens. Saving sends what changed (the client's
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
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import {
        chatManageAccess,
        type ReadOnlySetting,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { GroupSettingsPage } from "../../router/locations";
    import type { ScreenContext } from "../app/screens";
    import GatesPage from "./GatesPage.svelte";
    import GeneralPage from "./GeneralPage.svelte";
    import PermissionsPage from "./PermissionsPage.svelte";
    import RulesPage from "./RulesPage.svelte";
    import { savedThreadPermissions } from "./savedThreads";
    import SettingsEditorFrame from "./SettingsEditorFrame.svelte";
    import {
        changeQuestion,
        draftSavable,
        hasSavableChanges,
        pageTitle,
        threadsAsSaved,
    } from "./settings.adapter";

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

    const asking = $derived.by(() => {
        const key = changeQuestion(editor, editor.candidateGroup.public);
        return key === undefined
            ? undefined
            : interpolateNewUi($_, i18nKey(key, undefined, chat.level, true));
    });

    async function save(yes: boolean) {
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
</script>

<SettingsEditorFrame
    title={pageTitle(page, chat.kind === "channel", t)}
    {editable}
    {changed}
    {canSave}
    busy={editor.busy}
    {asking}
    onSave={(yes) => void save(yes)}
    {context}>
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
</SettingsEditorFrame>
