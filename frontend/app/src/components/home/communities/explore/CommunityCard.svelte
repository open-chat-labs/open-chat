<!-- svelte-ignore a11y-click-events-have-key-events -->

<script lang="ts">
    import type { Community, OpenChat } from "openchat-client";
    import Avatar from "../../../Avatar.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import { AvatarSize } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import CommunityBanner from "./CommunityBanner.svelte";

    const dispatch = createEventDispatcher();

    export let community: Community;
    export let selected: boolean;
    export let header = false;
    export let joining: boolean;
    export let member: boolean;

    const client = getContext<OpenChat>("client");

    function join() {
        dispatch("joinCommunity", community);
    }
</script>

<div class:selected class:header on:click class="card">
    <CommunityBanner square={header} {community}>
        <div class="avatar">
            <Avatar
                url={client.communityAvatarUrl(community.avatar)}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
    </CommunityBanner>
    <div class="content">
        <div class="name">{community.name}</div>
        <div class="desc">{community.description}</div>
        {#if !header}
            {#if !member}
                <ButtonGroup align={"fill"}>
                    <Button tiny hollow>{$_("communities.preview")}</Button>
                    <Button disabled={joining} loading={joining} on:click={join} tiny
                        >{$_("communities.join")}</Button>
                </ButtonGroup>
            {/if}
            <div class="footer">
                <div class="members">
                    <span class="number">{community.memberCount.toLocaleString()}</span>
                    <span class="label">{"members"}</span>
                </div>

                <div on:click class="channels">
                    <span class="number">{community.channelCount.toLocaleString()}</span>
                    <span class="label">{"channels"}</span>
                </div>
            </div>
        {/if}
    </div>
</div>

<style type="text/scss">
    .card {
        cursor: pointer;
        background-color: var(--recommended-bg);
        border: 1px solid var(--bd);
        border-radius: $sp3;

        &.selected {
            border-color: var(--txt);
        }

        .avatar {
            width: toRem(48);
            height: toRem(48);
            position: absolute;
            bottom: toRem(-15);
            left: $sp4;
        }

        &.header {
            border-radius: 0;
            border: none;
        }

        .content {
            padding: $sp4;
            padding-top: $sp5;

            .name {
                @include font(bold, normal, fs-130);
                margin-bottom: $sp3;
            }

            .desc {
                @include font(book, normal, fs-100, 28);
                color: var(--txt-light);
                margin-bottom: $sp4;
            }

            .footer {
                border-top: 1px solid var(--bd);
                padding-top: $sp4;
                margin-top: $sp4;
                display: flex;
                justify-content: space-between;
                gap: $sp3;

                .members,
                .channels {
                    .number {
                        font-weight: 500;
                    }
                    .label {
                        color: var(--txt-light);
                    }
                }

                .channels {
                    cursor: pointer;
                    text-decoration: underline;
                }
            }
        }
    }
</style>
