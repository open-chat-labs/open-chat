<!-- A community's settings page with its draft, in the editor's frame (SettingsEditorFrame: the
     header, Back asking before it drops unsaved changes, the pinned Save): Edit community
     (CommunityGeneralPage), or a group's Access gates and Rules pages (GatesPage, RulesPage: they
     take any UpdateGroupOrCommunityState), or the community's Permissions
     (CommunityPermissionsPage), on its own UpdateCommunityState made from the community and its
     rules as the page opens. Saving sends what changed (the client's updateCommunity), asking first
     where the client says a change needs it (renaming a verified community, making it private: the
     web's and the old pages' questions), and goes back to the details with a toast. What the
     viewer's role can't change shows read only (communityManageAccess). -->
<script lang="ts">
    import {
        anonUserStore,
        type CommunitySummary,
        type OpenChat,
        type VersionedRules,
    } from "@client";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import { UpdateCommunityState } from "@src/logic/groupOrCommunity/community.svelte";
    import {
        communityManageAccess,
        type ReadOnlySetting,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { swatchFor } from "@src/logic/swatch";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { CommunitySettingsPage } from "../../router/locations";
    import type { ScreenContext } from "../app/screens";
    import GatesPage from "../groupSettings/GatesPage.svelte";
    import RulesPage from "../groupSettings/RulesPage.svelte";
    import { changeQuestion } from "../groupSettings/settings.adapter";
    import SettingsEditorFrame from "../groupSettings/SettingsEditorFrame.svelte";
    import CommunityGeneralPage from "./CommunityGeneralPage.svelte";
    import CommunityPermissionsPage from "./CommunityPermissionsPage.svelte";
    import { communityDraftSavable, communityPageTitle } from "./communitySettings.adapter";

    type Props = {
        community: CommunitySummary;
        /** Its rules: undefined until they're in (CommunitySettingsScreen waits for them on the Rules page). */
        rules: VersionedRules | undefined;
        page: Extract<CommunitySettingsPage, "edit" | "gates" | "rules" | "permissions">;
        context: ScreenContext;
    };

    let { community, rules, page, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const access = $derived(communityManageAccess(client, community, $anonUserStore));
    const ALL: ReadOnlySetting[] = ["gates", "rules", "permissions", "visibility"];
    const readOnly = $derived(access.kind === "edit" ? access.readOnly : ALL);
    // the permissions are the owner's: anyone else sees them, with nothing to save
    const editable = $derived(
        access.kind === "edit" && !(page === "permissions" && readOnly.includes("permissions")),
    );

    // the draft: the community and its rules as the page opened, which a save moves on
    const editor = new UpdateCommunityState();
    editor.initialise(
        untrack(() => community),
        untrack(() => rules) ?? editor.originalRules,
    );

    const changed = $derived(editor.hasChanges());
    const canSave = $derived(
        changed && communityDraftSavable(editor.candidateCommunity, editor.valid) && !editor.busy,
    );

    // ---- saving, and the questions a change can need

    const asking = $derived.by(() => {
        const key = changeQuestion(editor, editor.candidateCommunity.public);
        return key === undefined
            ? undefined
            : interpolateNewUi($_, i18nKey(key, undefined, "community", true));
    });

    async function save(yes: boolean) {
        // the name as it's checked (communityDraftSavable): trimmed
        const name = editor.candidateCommunity.name.trim();
        if (name !== editor.candidateCommunity.name) editor.candidateCommunity.name = name;
        const outcome = await editor.saveCommunity(client, yes);
        switch (outcome.kind) {
            case "success":
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
    title={communityPageTitle(page, t)}
    {editable}
    {changed}
    {canSave}
    busy={editor.busy}
    {asking}
    onSave={(yes) => void save(yes)}
    {context}>
    {#if page === "edit"}
        <CommunityGeneralPage
            {editor}
            {readOnly}
            color={swatchFor(community.id.communityId)}
            {context} />
    {:else if page === "gates"}
        <GatesPage {editor} {context} />
    {:else if page === "rules"}
        <RulesPage {editor} />
    {:else}
        <CommunityPermissionsPage {editor} readOnly={readOnly.includes("permissions")} />
    {/if}
</SettingsEditorFrame>
