<!-- You → Notifications (native design notes §3.11). In a phone's browser, the master switch is
     web push's, as the web's profile has it (logic/profile/notifications): on asks for the browser's
     permission, off stops offering them. The apps' notifications are the phone's (its settings
     turn them off), and the backend has no per-kind choices (direct chats, groups, communities,
     mentions only) nor lock-screen options, so those aren't here (GAPS.md). -->
<script lang="ts">
    import { askForNotificationPermission, notificationStatus, setSoftDisabled } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import { notificationSwitch, setNotifications } from "@src/logic/profile/notifications";
    import { _ } from "svelte-i18n";

    const shown = $derived(notificationSwitch($notificationStatus));

    function change(on: boolean) {
        void setNotifications(on, $notificationStatus, {
            ask: askForNotificationPermission,
            softDisable: setSoftDisabled,
        });
    }
</script>

{#if shown.kind === "switch"}
    <SettingsGroup>
        <SettingsSwitch
            label={$_("native.you.notifications.title")}
            help={$_("native.you.notifications.help")}
            on={shown.on}
            onChange={change} />
    </SettingsGroup>
{:else}
    <SettingsGroup
        note={$_(
            shown.kind === "blocked"
                ? "native.you.notifications.blocked"
                : "native.you.notifications.phone",
        )}>
        <SettingsSwitch
            label={$_("native.you.notifications.title")}
            help={$_("native.you.notifications.help")}
            on={false}
            disabled
            onChange={() => {}} />
    </SettingsGroup>
{/if}
