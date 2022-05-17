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
    import type { GroupChatSummary } from "../../../domain/chat/chat";
    import { rollbar } from "../../../utils/logging";

    const dispatch = createEventDispatcher();

    let loading = true;
    let error = false;

    $: empty = error || $alertsStore.length === 0;

    const api = getContext<ServiceContainer>(apiKey);

    function markAllRead() {
        console.log("marking all alerts as read");
    }

    onMount(async () => {
        try {
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

            // TODO - this is no good, needs either another api or it needs to be done on the server
            const groups = (
                await Promise.all([...groupIds].map((id) => api.getPublicGroupSummary(id)))
            ).reduce((groups, group) => {
                if (group !== undefined) {
                    groups[group.chatId] = group;
                } else {
                    error = true;
                }
                return groups;
            }, {} as Record<string, GroupChatSummary>);

            console.log("Rehydrated groups: ", groups);
            const userResponse = await api.getUsers(
                {
                    userGroups: [
                        {
                            users: missing,
                            updatedSince: BigInt(0),
                        },
                    ],
                },
                true
            );

            userStore.addMany(userResponse.users);

            loading = false;
        } catch (err: any) {
            error = true;
            rollbar.error("Error rehydrating alerts", err);
        }
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
    {#if loading}
        <Loading />
    {:else if error}
        <div class="rage">😡</div>
        <div>{$_("alerts.error")}</div>
    {:else if $alertsStore.length === 0}
        <div>{$_("alerts.upToDate")}</div>
        <div class="sleep">😴</div>
        <div>{$_("alerts.nothingToSee")}</div>
    {:else}
        {#each $alertsStore as alert, i (alert.id)}
            <Alert {alert} let:details>
                {#if details.kind === "blocked_from_group_alert"}
                    <BlockedFromGroupAlert {details} />
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
