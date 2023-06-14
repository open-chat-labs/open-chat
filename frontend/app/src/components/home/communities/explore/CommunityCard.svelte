<!-- svelte-ignore a11y-click-events-have-key-events -->

<script lang="ts">
    import type { DataContent, OpenChat } from "openchat-client";
    import Avatar from "../../../Avatar.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import Markdown from "../../Markdown.svelte";
    import { AvatarSize } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import CommunityBanner from "./CommunityBanner.svelte";

    const dispatch = createEventDispatcher();

    export let name: string;
    export let description: string;
    export let avatar: DataContent;
    export let banner: DataContent;
    export let memberCount: number;
    export let channelCount: number;

    export let header = false;

    const client = getContext<OpenChat>("client");
</script>

<div class:header on:click class="card">
    <CommunityBanner square={header} {banner}>
        <div class="avatar">
            <Avatar
                url={client.communityAvatarUrl(avatar)}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
    </CommunityBanner>
    <div class="content">
        <div class="name">{name}</div>
        <div class="desc" class:fixed={!header}>
            <Markdown text={description} />
        </div>
        {#if !header}
            <div class="footer">
                <div class="members">
                    <span class="number">{memberCount.toLocaleString()}</span>
                    <span class="label">{"members"}</span>
                </div>

                <div on:click class="channels">
                    <span class="number">{channelCount.toLocaleString()}</span>
                    <span class="label">{"channels"}</span>
                </div>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .card {
        cursor: pointer;
        background-color: var(--recommended-bg);
        border: 1px solid var(--bd);
        border-radius: $sp3;

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
                max-height: toRem(150);
                @include nice-scrollbar();

                &.fixed {
                    height: toRem(150);
                }
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
