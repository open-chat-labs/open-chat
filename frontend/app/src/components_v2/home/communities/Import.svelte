<script lang="ts">
    import {
        AvatarSize,
        type ChatIdentifier,
        type CommunityMap,
        type CommunitySummary,
        type OpenChat,
        publish,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Avatar from "../../Avatar.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ownedCommunities: CommunityMap<CommunitySummary>;
        groupId: ChatIdentifier;
        onCancel: () => void;
    }

    let { ownedCommunities, groupId, onCancel }: Props = $props();

    let communitiesList = $derived([...ownedCommunities.values()]);

    let importing = $state(false);
    let selected: CommunitySummary | undefined = $state();

    function performImport() {
        if (selected === undefined || groupId.kind !== "group_chat") return;

        importing = true;
        client
            .importToCommunity(groupId, selected.id)
            .then((channelId) => {
                if (channelId === undefined) {
                    toastStore.showFailureToast(i18nKey("communities.errors.importFailed"));
                } else {
                    onCancel();
                    publish("successfulImport", channelId);
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

    function areEqual(c1?: CommunitySummary, c2?: CommunitySummary): boolean {
        return c1 !== undefined && c2 !== undefined && c1.id.communityId === c2.id.communityId;
    }
</script>

{#if communitiesList.length > 0}
    <Overlay>
        <ModalContent>
            {#snippet header()}
                <span><Translatable resourceKey={i18nKey("communities.chooseCommunity")} /></span>
            {/snippet}
            {#snippet body()}
                <span>
                    {#each communitiesList as community}
                        <div
                            onclick={() => selectCommunity(community)}
                            class="card"
                            class:selected={areEqual(selected, community)}>
                            <div class="avatar">
                                <Avatar
                                    url={client.communityAvatarUrl(
                                        community.id.communityId,
                                        community.avatar,
                                    )}
                                    userId={undefined}
                                    size={AvatarSize.Default} />
                            </div>
                            <div class="details">
                                <h4 class="name">{community.name}</h4>
                            </div>
                        </div>
                    {/each}
                </span>
            {/snippet}
            {#snippet footer()}
                <span>
                    <ButtonGroup>
                        <Button secondary onClick={onCancel}
                            ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                        <Button loading={importing} disabled={importing} onClick={performImport}
                            ><Translatable
                                resourceKey={i18nKey("communities.importBtn")} /></Button>
                    </ButtonGroup>
                </span>
            {/snippet}
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
        border-radius: var(--rd);
        transition: background-color 250ms ease-in-out;
        border: 1px solid transparent;

        &.selected {
            background-color: var(--chatSummary-bg-selected);
            border: 1px solid var(--txt-light);
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }
    }
</style>
