<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Loading from "../../Loading.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { alertsStore } from "../../../stores/alerts";
    import { userStore } from "../../../stores/user";
    import GroupAlert from "./GroupAlert.svelte";
    import Alert from "./Alert.svelte";
    import { missingUserIds } from "../../../domain/user/user.utils";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import { toastStore } from "stores/toast";
    import { rollbar } from "utils/logging";

    const dispatch = createEventDispatcher();

    $: empty = $alertsStore.length === 0;

    let busy = false;

    const api = getContext<ServiceContainer>(apiKey);

    function markAsUnread(unread: string[]) {
        alertsStore.update((alerts) =>
            alerts.map((a) => {
                return unread.includes(a.id) ? { ...a, read: false } : a;
            })
        );
    }

    function markAllRead() {
        const unread = $alertsStore.filter((a) => !a.read).map((a) => a.id);
        alertsStore.update((alerts) => alerts.map((a) => ({ ...a, read: true })));

        if (unread.length > 0) {
            busy = true;
            api.markAlertsAsRead(unread)
                .then((resp) => {
                    if (resp.kind === "partial_success") {
                        markAsUnread(resp.failedIds);
                    }
                })
                .catch((err) => {
                    toastStore.showFailureToast("alerts.failedToMarkRead");
                    rollbar.error("Failed to mark alerts as read", err);
                    markAsUnread(unread);
                })
                .finally(() => (busy = false));
        }
    }

    onMount(() => {
        const missing = missingUserIds(
            $userStore,
            $alertsStore.reduce((userIds, { details }) => {
                if (details.kind === "blocked_from_group_alert")
                    return userIds.add(details.blockedBy);
                if (details.kind === "group_deleted_alert") return userIds.add(details.deletedBy);
                if (details.kind === "removed_from_group_alert")
                    return userIds.add(details.removedBy);
                if (details.kind === "completed_cycles_deposit") return userIds.add(details.from);
                return userIds;
            }, new Set<string>())
        );

        api.getUsers(
            {
                userGroups: [
                    {
                        users: missing,
                        updatedSince: BigInt(0),
                    },
                ],
            },
            true
        ).then((resp) => userStore.addMany(resp.users));
    });

    // TODO - we should probably use VirtualList here as we could end up having a lot of alerts
</script>

<SectionHeader>
    <h4>{$_("alerts.title")}</h4>
    <span title={$_("markAllRead")} class="icon" class:busy on:click={markAllRead}>
        {#if !busy}
            <HoverIcon>
                <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {/if}
    </span>
    <span title={$_("close")} class="icon" on:click={() => dispatch("close")}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="alerts" class:empty>
    {#if empty}
        <div>{$_("alerts.upToDate")}</div>
        <div class="sleep">😴</div>
        <div>{$_("alerts.nothingToSee")}</div>
    {:else}
        {#each $alertsStore as alert, i (alert.id)}
            <Alert {alert} let:details let:timestamp>
                {#if details.kind === "blocked_from_group_alert"}
                    <GroupAlert
                        groupName={details.groupName}
                        userId={details.blockedBy}
                        {timestamp}
                        msgKey={"alerts.blockedBy"} />
                {:else if details.kind == "group_deleted_alert"}
                    <GroupAlert
                        groupName={details.groupName}
                        userId={details.deletedBy}
                        {timestamp}
                        msgKey={"alerts.deletedBy"} />
                {:else if details.kind == "removed_from_group_alert"}
                    <GroupAlert
                        groupName={details.groupName}
                        userId={details.removedBy}
                        {timestamp}
                        msgKey={"alerts.removedBy"} />
                {/if}
            </Alert>
        {/each}
    {/if}
</div>

<style type="text/scss">
    .alerts {
        padding: 0 $sp3 $sp4 $sp3;
        flex: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--alerts-bg);
        color: var(--alerts-txt);

        &.empty {
            justify-content: flex-end;
            align-items: center;
            @include font(book, normal, fs-120);
            .sleep {
                @include font-size(fs-260);
            }
        }
    }
    h4 {
        flex: 1;
        margin: 0 $sp3;
    }
    .icon {
        flex: 0 0 30px;
        &.busy {
            @include loading-spinner(1.4em, 0.7em, false, var(--button-spinner));
        }
    }
</style>
