<!-- A bot's details, installing it, changing its permissions or removing it (BotDialog), in a group
     or a community. The permissions are the bot's own, listed with the app's words
     (botPermissions), and what's granted is exactly what was toggled on (grantedFromDialog),
     saved through BotInstall as the old installer did. -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        permissionsToGrant,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        selectedChatBotsStore,
        selectedCommunityBotsStore,
        type OpenChat,
    } from "@client";
    import BotDialog, {
        type BotInstall as DialogInstall,
    } from "@openchat/ui/src/features/components/BotDialog.svelte";
    import { BotInstall } from "@src/logic/bots/botInstall.svelte";
    import { toastStore } from "@src/stores/toast";
    import { i18nKey } from "@src/i18n/i18n";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { botPermissions, commandNeeds, grantedFromDialog, grantedKeys } from "./bot.adapter";
    import { pickById } from "../../pickById";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "bot" }>> = $props();

    const client = getContext<OpenChat>("client");

    const COLORS = ["violet", "amber", "teal", "blue", "rose", "plum"] as const;

    const bot = untrack(() => dialog.bot);
    const location = untrack(() => dialog.location);

    // what it has now, if it's installed here
    const installed = $derived(
        (location.kind === "community" ? $selectedCommunityBotsStore : $selectedChatBotsStore).get(
            bot.id,
        ),
    );

    const permissions = $derived(
        botPermissions(bot.definition, location, {
            permission: (scope, name) =>
                $_(
                    scope === "message"
                        ? `permissions.messagePermissions.${name}`
                        : `permissions.${name}`,
                ),
            group: (use, scope) =>
                `${$_(use === "command" ? "bots.builder.commandPermissionsLabel" : "bots.builder.autonomousPermissionsLabel")} · ${$_(
                    scope === "chat"
                        ? "bots.builder.permScopeChat"
                        : scope === "community"
                          ? "bots.builder.permScopeCommunity"
                          : "bots.builder.permScopeMessage",
                )}`,
        }),
    );

    const definition = $derived({
        id: bot.id,
        name: bot.name,
        creator: `@${$allUsersStore.get(bot.ownerId)?.username ?? bot.ownerId}`,
        description: bot.definition.description,
        color: pickById(bot.id, COLORS),
        perms: permissions.perms,
        commands: bot.definition.commands.map((c) => ({
            name: `/${c.name}`,
            about: c.description ?? "",
            needs: commandNeeds(c.permissions, location),
        })),
        granted: installed === undefined ? undefined : grantedKeys(installed),
    });

    // the bot rights where it's installed; a guest has none
    const canManage = $derived(!$anonUserStore && client.canManageBots(location));

    // the group's or community's name
    const place = $derived(
        location.kind === "community"
            ? ($selectedCommunitySummaryStore?.name ?? "")
            : $selectedChatSummaryStore?.kind === "group_chat"
              ? $selectedChatSummaryStore.name
              : "",
    );

    // the dialog stays open and says it failed when these reject
    async function save(choice: DialogInstall) {
        // what it may ask for here: no community permissions outside a community
        const requested = permissionsToGrant(bot.definition, location);
        const flow = new BotInstall(client, bot, location, installed);
        flow.grantedPermissions = grantedFromDialog(choice.granted, requested);
        const outcome = await flow.save();
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
            throw new Error("not saved");
        }
    }

    async function remove() {
        if (!(await client.uninstallBot(location, bot.id))) {
            toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            throw new Error("not removed");
        }
    }
</script>

<BotDialog
    bot={definition}
    permissions={permissions.permissions}
    groupName={place}
    installed={installed !== undefined}
    {canManage}
    onInstall={save}
    onRemove={remove}
    onCancel={onClose}
/>
