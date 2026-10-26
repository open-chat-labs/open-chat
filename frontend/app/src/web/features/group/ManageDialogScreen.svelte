<!-- Manage for a group, channel or community (ManageDialog): its settings pages, or its About page
     for someone who can't edit it (ManageSettings), Invite & share (ManageInvite), and Members and
     User groups (GroupPanelView, embedded). Moving
     between the settings pages keeps the one draft; leaving them, or closing, with unsaved edits
     asks first (ManageState). Leave or Delete opens its confirm dialog over Manage. -->
<script lang="ts">
    import {
        anonUserStore,
        chatIdentifierToString,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type OpenChat,
    } from "@client";
    import ManageDialog from "@openchat/ui/src/features/components/ManageDialog.svelte";
    import {
        chatDetailsPermissions,
        chatManageAccess,
        communityDetailsPermissions,
        communityManageAccess,
        communityMenuPermissions,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import {
        isFormSection,
        manageDanger,
        manageNav,
        ManageState,
        type ManageSection,
    } from "@src/logic/groupOrCommunity/manage.svelte";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { pickById } from "../../pickById";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { dialogTarget } from "./dialogTarget";
    import { leaveOrDeleteFor, manageNavGroups, settingsPage } from "./manage.adapter";
    import GroupPanelView from "./GroupPanelView.svelte";
    import ManageInvite from "./ManageInvite.svelte";
    import ManageSettings from "./ManageSettings.svelte";

    let { dialog, onClose, dialogs }: DialogProps<Extract<LocalDialog, { kind: "manage" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const COLORS = ["violet", "amber", "teal", "blue"] as const;

    // what it was opened for; another chat or community being opened closes it (a navigation does)
    const target = $derived(
        dialogTarget(dialog.target, $selectedChatSummaryStore, $selectedCommunitySummaryStore),
    );
    const community = $derived($selectedCommunitySummaryStore);

    const permissions = $derived(
        target === undefined
            ? undefined
            : target.kind === "community"
              ? communityDetailsPermissions(client, target, $anonUserStore)
              : chatDetailsPermissions(client, target, community, $anonUserStore),
    );
    const access = $derived(
        target === undefined
            ? undefined
            : target.kind === "community"
              ? communityManageAccess(client, target, $anonUserStore)
              : chatManageAccess(client, target, community, $anonUserStore),
    );

    const manage = new ManageState(untrack(() => dialog.section));

    const nav = $derived(
        access === undefined || permissions === undefined
            ? []
            : manageNavGroups(
                  manageNav({
                      access,
                      canOpenInvite: permissions.canOpenInvite,
                      canManageUserGroups: permissions.canManageUserGroups,
                  }),
              ),
    );

    const canLeave = $derived(
        target === undefined
            ? false
            : target.kind === "community"
              ? communityMenuPermissions(client, target).canLeave
              : client.canLeaveGroup(target.id),
    );
    const danger = $derived.by(() => {
        if (target === undefined) return undefined;
        const kind = manageDanger(permissions?.canDelete ?? false, canLeave);
        if (kind === undefined) return undefined;
        const name = target.name;
        const action = leaveOrDeleteFor(target, kind);
        return {
            kind,
            noun: target.level,
            onPress: () => dialogs.open({ kind: "leave_or_delete", action, name }),
        };
    });

    const subtitle = $derived(
        target === undefined
            ? ""
            : `${$_(target.public ? "access.public" : "access.private")} · ${$_("memberCount", { values: { count: target.memberCount } })}`,
    );
    // uploaded images only: a swatch stands in otherwise, as in GroupPanel
    const avatarUrl = $derived(
        target === undefined
            ? undefined
            : target.kind === "community"
              ? target.avatar.blobUrl
              : (target.blobUrl ?? community?.avatar.blobUrl),
    );

    const close = () => manage.close(onClose);
    const dirty = (d: boolean) => manage.setDirty(d);
</script>

{#if target !== undefined && access !== undefined}
    <ManageDialog
        title={target.name}
        {subtitle}
        color={pickById(
            target.kind === "community" ? target.id.communityId : chatIdentifierToString(target.id),
            COLORS,
        )}
        {avatarUrl}
        round={target.kind === "channel"}
        {nav}
        current={manage.section}
        onSelect={(key) => manage.go(key as ManageSection)}
        {danger}
        confirming={manage.confirming}
        onKeepEditing={() => manage.keepEditing()}
        onDiscard={() => manage.discard()}
        onClose={close}
    >
        {#if isFormSection(manage.section)}
            <ManageSettings
                {target}
                section={settingsPage(manage.section)}
                {access}
                onDirtyChange={dirty}
                onOpenRules={() => manage.go("rules")}
                onClose={close}
            />
        {:else if manage.section === "members" || manage.section === "usergroups"}
            <GroupPanelView
                communityScope={target.kind === "community"}
                viewRequest={manage.section}
                {dialogs}
                embedded
                onManage={(section) => manage.go(section)}
                onClose={close}
            />
        {:else if manage.section === "invite"}
            <ManageInvite
                {target}
                tab={dialog.inviteTab ?? "people"}
                onDirtyChange={dirty}
                onClose={close}
            />
        {/if}
    </ManageDialog>
{/if}
