<script lang="ts">
    import type { GroupChatSummary } from "../../domain/chat/chat";

    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { avatarUrl as getAvatarUrl } from "../../domain/user/user.utils";
    import { AvatarSize, UserStatus } from "domain/user/user";
    import Button from "../Button.svelte";
    import { push } from "svelte-spa-router";
    import { rtlStore } from "../../stores/rtl";

    export let groups: GroupChatSummary[];

    let selected = 0;

    function previewGroup({ chatId }: GroupChatSummary) {
        push(`/${chatId}`);
    }
</script>

<div class="wrapper">
    <h1 class="title">{$_("recommendedGroups")}</h1>
    <p class="subtitle">{$_("selectAGroup")}</p>

    {#each groups as group, i (group.chatId)}
        <div
            class:rtl={$rtlStore}
            class="group-card"
            class:selected={selected === i}
            on:mouseenter={() => (selected = i)}>
            <div class="avatar">
                <Avatar
                    url={getAvatarUrl(group, "../assets/group.svg")}
                    status={UserStatus.None}
                    size={AvatarSize.Small} />
            </div>
            <div class="body">
                <h3 class="group-name">
                    {group.name}
                </h3>
                <p class="group-desc">
                    {group.description}
                </p>
                <div class="footer">
                    <p class="user-count">
                        {$_("groupWithN", { values: { number: group.participantCount } })}
                    </p>
                    <div class="buttons">
                        <Button small={true} on:click={() => previewGroup(group)}>Preview</Button>
                        <Button small={true} secondary={true}>Join</Button>
                    </div>
                </div>
            </div>
        </div>
    {/each}
</div>

<style type="text/scss">
    .wrapper {
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);

        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        height: 100%;
        padding-top: $sp4;
        overflow: auto;
        @include nice-scrollbar();
    }

    .subtitle {
        margin-bottom: $sp6;
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }

    .group-card {
        display: flex;
        align-items: flex-start;
        transition: transform 200ms ease-in-out, box-shadow 200ms ease-in-out,
            opacity 200ms ease-in-out, border-left 200ms ease-in-out;
        @include box-shadow(2);
        width: 80%;
        border-radius: $sp2;
        padding: $sp4;
        opacity: 0.95;
        background-color: var(--recommended-bg);
        margin-bottom: $sp5;

        &.selected {
            @include box-shadow(3);
            border-left: 7px solid var(--accent);
            transform: scale(1.03);
            opacity: 1;

            &.rtl {
                border-left: none;
                border-right: 7px solid var(--accent);
            }
        }

        .avatar {
            flex: 0 0 60px;
        }

        .body {
            flex: 1;
        }

        .group-name {
            @include font(bold, normal, fs-160);
            margin-bottom: $sp3;
        }

        .group-desc {
            @include font(book, normal, fs-100);
            margin-bottom: $sp4;
        }

        .user-count {
            @include font(light, italic, fs-80);
            margin-bottom: $sp3;

            @include size-below(md) {
                margin-bottom: $sp4;
            }
        }

        .footer {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;

            @include size-below(md) {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    }
</style>
