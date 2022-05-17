<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { alertsStore } from "../../../stores/alerts";
    import BlockedFromGroupAlert from "./BlockedFromGroupAlert.svelte";
    import GroupDeletedAlert from "./GroupDeletedAlert.svelte";
    import RemovedFromGroupAlert from "./RemovedFromGroupAlert.svelte";
    import Alert from "./Alert.svelte";

    const dispatch = createEventDispatcher();
</script>

<SectionHeader>
    <h4>{$_("alerts")}</h4>
    <span title={$_("close")} class="close" on:click={() => dispatch("close")}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="alerts">
    {#if $alertsStore.length === 0}
        <div class="uptodate">$_("youreUpToDate")</div>
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
        padding: 0 $sp3 0 $sp3;
    }
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
</style>
