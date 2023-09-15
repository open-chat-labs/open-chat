<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import CommunityHero from "./CommunityHero.svelte";
    import Markdown from "../../Markdown.svelte";
    import InviteUsersWithLink from "../../InviteUsersWithLink.svelte";
    import Stats from "../../Stats.svelte";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;
    $: rules = client.currentCommunityRules;
    $: canInvite = $selectedCommunity !== undefined && client.canInviteUsers($selectedCommunity.id);

    $: console.log("SelectedCommunity: ", $selectedCommunity);

    onMount(() => {
        // if we arrive here let's mount the community members in the right hand panel
    });

    function selectCommunity() {
        if ($selectedCommunity !== undefined) {
            page(`/community/${$selectedCommunity.id.communityId}`);
        }
    }
</script>

{#if $selectedCommunity !== undefined}
    <CommunityHero
        id={$selectedCommunity.id.communityId}
        name={$selectedCommunity.name}
        description={$selectedCommunity.description}
        avatar={$selectedCommunity.avatar}
        banner={$selectedCommunity.banner}
        on:click={() => selectCommunity()} />

    <section class="main">
        <div class="left col">
            {#if canInvite}
                <InviteUsersWithLink container={$selectedCommunity} />
            {/if}
            {#if $rules !== undefined && $rules.enabled}
                <Markdown inline={false} text={$rules.text} />
            {/if}
        </div>
        <div class="right col">
            <Stats showReported={false} stats={$selectedCommunity.metrics} />
        </div>
    </section>
{/if}

<style lang="scss">
    .main {
        display: flex;
        gap: $sp6;
        justify-content: space-between;

        .left,
        .right {
            flex: 1;
            padding: $sp5;
        }
    }
</style>
