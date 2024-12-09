<script lang="ts">
    import { i18nKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        chatTab: Snippet;
        communityTab: Snippet;
        messageTab: Snippet;
        threadTab: Snippet;
    }

    let { chatTab, communityTab, messageTab, threadTab }: Props = $props();
    let permissionsTab: "chat" | "community" | "message" | "thread" = $state("chat");
</script>

<div class="tabs">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="tab"
        onclick={() => (permissionsTab = "chat")}
        class:selected={permissionsTab === "chat"}>
        <Translatable resourceKey={i18nKey("bots.builder.permScopeChat")}></Translatable>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="tab"
        onclick={() => (permissionsTab = "community")}
        class:selected={permissionsTab === "community"}>
        <Translatable resourceKey={i18nKey("bots.builder.permScopeCommunity")}></Translatable>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="tab"
        onclick={() => (permissionsTab = "message")}
        class:selected={permissionsTab === "message"}>
        <Translatable resourceKey={i18nKey("bots.builder.permScopeMessage")}></Translatable>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="tab"
        onclick={() => (permissionsTab = "thread")}
        class:selected={permissionsTab === "thread"}>
        <Translatable resourceKey={i18nKey("bots.builder.permScopeThread")}></Translatable>
    </div>
</div>
{#if permissionsTab === "chat"}
    {@render chatTab()}
{:else if permissionsTab === "community"}
    {@render communityTab()}
{:else if permissionsTab === "message"}
    {@render messageTab()}
{:else if permissionsTab === "thread"}
    {@render threadTab()}
{/if}

<style lang="scss">
    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin-bottom: $sp4;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }
</style>
