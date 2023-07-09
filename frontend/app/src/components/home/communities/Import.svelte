<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import {
        AvatarSize,
        type CommunityMap,
        type CommunitySummary,
        type OpenChat,
        ChatIdentifier,
    } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import { toastStore } from "../../../stores/toast";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let ownedCommunities: CommunityMap<CommunitySummary>;
    export let groupId: ChatIdentifier;

    $: communitiesList = ownedCommunities.values();

    let importing = false;
    let selected: CommunitySummary | undefined;

    function performImport() {
        if (selected === undefined || groupId.kind !== "group_chat") return;

        importing = true;
        client
            .importToCommunity(groupId, selected.id)
            .then((channelId) => {
                if (channelId === undefined) {
                    toastStore.showFailureToast("communities.errors.importFailed");
                } else {
                    dispatch("cancel");
                    dispatch("successfulImport", channelId);
                }
            })
            .finally(() => (importing = false));
    }

    function selectCommunity(community: CommunitySummary) {
        selected = community;
    }

    onMount(() => {
        selected = communitiesList.length > 0 ? communitiesList[0] : undefined;
    });
</script>

{#if communitiesList.length > 0}
    <Overlay>
        <ModalContent>
            <span slot="header">{$_("communities.chooseCommunity")}</span>
            <span slot="body">
                {#each communitiesList as community}
                    <div
                        on:click={() => selectCommunity(community)}
                        class="card"
                        class:selected={community === selected}>
                        <div class="avatar">
                            <Avatar
                                url={client.communityAvatarUrl(community.avatar)}
                                userId={undefined}
                                size={AvatarSize.Default} />
                        </div>
                        <div class="details">
                            <h4 class="name">{community.name}</h4>
                        </div>
                    </div>
                {/each}
            </span>
            <span slot="footer">
                <ButtonGroup>
                    <Button secondary={true} on:click={() => dispatch("cancel")}
                        >{$_("cancel")}</Button>
                    <Button loading={importing} disabled={importing} on:click={performImport}
                        >{$_("communities.importBtn")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .card {
        display: flex;
        align-items: center;
        gap: $sp4;
        cursor: pointer;
        padding: $sp4;
        border-radius: $sp2;
        transition: background-color 250ms ease-in-out;
        border: 1px solid transparent;

        &.selected {
            background-color: var(--chatSummary-bg-selected);
            border: 1px solid var(--txt-light);
        }

        &:hover {
            background-color: var(--chatSummary-hv);
        }
    }
</style>
