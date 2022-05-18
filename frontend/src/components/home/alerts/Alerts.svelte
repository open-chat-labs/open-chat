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
    import BlockedFromGroupAlert from "./BlockedFromGroupAlert.svelte";
    import GroupDeletedAlert from "./GroupDeletedAlert.svelte";
    import RemovedFromGroupAlert from "./RemovedFromGroupAlert.svelte";
    import Alert from "./Alert.svelte";
    import { missingUserIds } from "../../../domain/user/user.utils";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";

    const dispatch = createEventDispatcher();

    $: empty = $alertsStore.length === 0;

    const api = getContext<ServiceContainer>(apiKey);

    function markAllRead() {
        console.log("marking all alerts as read");
    }

    onMount(() => {
        const [userIds, groupIds] = $alertsStore.reduce(
            ([userIds, groupIds], { details }) => {
                if (details.kind === "blocked_from_group_alert")
                    return [userIds.add(details.blockedBy), groupIds.add(details.chatId)];
                if (details.kind === "group_deleted_alert")
                    return [userIds.add(details.deletedBy), groupIds.add(details.chatId)];
                if (details.kind === "removed_from_group_alert")
                    return [userIds.add(details.removedBy), groupIds.add(details.chatId)];
                if (details.kind === "completed_cycles_deposit")
                    return [userIds.add(details.from), groupIds];
                return [userIds, groupIds];
            },
            [new Set<string>(), new Set<string>()]
        );
        const missing = missingUserIds($userStore, userIds);

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
    <span title={$_("markAllRead")} class="icon" on:click={markAllRead}>
        <HoverIcon>
            <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
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
            <Alert unread={i % 2 === 0} {alert} let:details let:timestamp>
                {#if details.kind === "blocked_from_group_alert"}
                    <BlockedFromGroupAlert {details} {timestamp} />
                {:else if details.kind == "group_deleted_alert"}
                    <GroupDeletedAlert {details} />
                {:else if details.kind == "removed_from_group_alert"}
                    <RemovedFromGroupAlert {details} />
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
            .sleep,
            .rage {
                @include font-size(fs-260);
            }
        }
    }
    h4 {
        flex: 1;
        margin: 0;
    }
    .icon {
        flex: 0 0 30px;
    }
</style>
