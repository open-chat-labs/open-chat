<!-- Manage for a group, channel or community (ManageDialog): its settings pages, or its About page
     for someone who can't edit it (ManageSettings), Invite & share (ManageInvite), and Members and
     User groups (GroupPanelView, embedded). Moving
     between the settings pages keeps the one draft; leaving them, or closing, with unsaved edits
     asks first (ManageState). Leave or Delete opens its confirm dialog over Manage. -->
<script lang="ts">
    import {
        anonUserStore,
        chatIdentifiersEqual,
        chatIdentifierToString,
        routeForChatIdentifier,
        selectedChatIdStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type CommunityIdentifier,
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
    import ManageChannels from "@openchat/ui/src/features/components/ManageChannels.svelte";
    import { navigate } from "@src/utils/navigation";

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
                      community: target?.kind === "community",
                      canManageUserGroups: permissions.canManageUserGroups,
                      canConvert:
                          target?.kind === "group_chat" &&
                          permissions.canEdit &&
                          client.canConvertGroupToCommunity(target.id),
                      canImport:
                          target?.kind === "group_chat" &&
                          permissions.canEdit &&
                          client.canImportToCommunity(target.id),
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

    // convert and import open their own dialog over Manage; the rest are its pages
    function select(key: string) {
        if (target?.kind === "group_chat" && (key === "convert" || key === "import")) {
            dialogs.open({
                kind: key === "convert" ? "convert_group" : "import_group",
                chatId: target.id,
            });
        } else {
            manage.go(key as ManageSection);
        }
    }

    // ── a community's channels ──

    const channels = $derived(
        target?.kind === "community"
            ? target.channels.map((c) => ({
                  key: chatIdentifierToString(c.id),
                  title: c.name,
                  sub:
                      c.description ||
                      (c.externalUrl !== undefined
                          ? "ui.manageChannels.embeddedApp"
                          : "ui.manageChannels.noDescription"),
                  meta: `${c.memberCount.toLocaleString()} · ${$_(c.public ? "access.public" : "access.private")}`,
                  color: pickById(chatIdentifierToString(c.id), COLORS),
                  current: chatIdentifiersEqual(c.id, $selectedChatIdStore),
              }))
            : [],
    );
    const canCreateChannel = $derived(
        target?.kind === "community" && communityMenuPermissions(client, target).canCreateChannel,
    );

    // Manage for another of the community's pages, in this one's place (asking first if there are
    // unsaved edits)
    function openCommunityPage(communityId: CommunityIdentifier, section: ManageSection) {
        manage.close(() =>
            dialogs.replace(
                { kind: "manage", target: communityId, section },
                (open) => open === dialog,
            ),
        );
    }

    // A channel's Manage. It reads the open chat, so a channel that isn't open is opened first
    // (which closes this Manage, as any navigation does)
    function openChannel(key: string) {
        if (target?.kind !== "community") return;
        const channel = target.channels.find((c) => chatIdentifierToString(c.id) === key);
        if (channel === undefined) return;
        if (!chatIdentifiersEqual(channel.id, $selectedChatIdStore)) {
            navigate(routeForChatIdentifier("community", channel.id));
        }
        dialogs.replace(
            { kind: "manage", target: channel.id, section: "main" },
            (open) => open === dialog,
        );
    }
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
        backLabel={community
            ? $_("ui.manageDialog.backTo", { values: { name: community.name } })
            : ""}
        onBack={target.kind === "channel" && community !== undefined
            ? () => community && openCommunityPage(community.id, "channels")
            : undefined}
        {nav}
        current={manage.section}
        onSelect={select}
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
                onOpenCommunity={(view) =>
                    community &&
                    dialogs.open({
                        kind: "manage",
                        target: community.id,
                        section: view === "members" ? "members" : "main",
                    })}
                onClose={close}
            />
        {:else if manage.section === "channels" && target.kind === "community"}
            <ManageChannels
                {channels}
                onSelect={openChannel}
                onNew={canCreateChannel
                    ? () =>
                          dialogs.open({
                              kind: "new_channel",
                              communityId: target.id,
                              embedded: false,
                          })
                    : undefined}
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
