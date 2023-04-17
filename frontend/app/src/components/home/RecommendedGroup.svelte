<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, GroupChatSummary, OpenChat, UserStatus } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Footer from "./upgrade/Footer.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../Button.svelte";
    import page from "page";
    import GroupGateIcon from "./GroupGateIcon.svelte";
    import { gatedGroupsEnabled } from "../../utils/features";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let group: GroupChatSummary;
    export let joining: GroupChatSummary | undefined;

    function dismiss({ chatId }: GroupChatSummary) {
        dispatch("dismissRecommendation", chatId);
    }

    function previewGroup({ chatId }: GroupChatSummary) {
        page(`/${chatId}`);
    }

    function joinGroup(group: GroupChatSummary) {
        dispatch("joinGroup", {
            group,
            select: false,
        });
    }
</script>

<div class="group-card">
    <div class="main">
        <div class="header">
            <div class="avatar">
                <Avatar
                    url={client.groupAvatarUrl(group)}
                    size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
            </div>
            <div class="group-title-line">
                <h3 class="group-name">
                    {group.name}
                </h3>
                <p class="user-count">
                    {$_("groupWithN", { values: { number: group.memberCount.toLocaleString() } })}
                </p>
            </div>
            <div title={$_("notInterested")} class="close" on:click={() => dismiss(group)}>
                <HoverIcon>
                    <Close size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        </div>
        <div class="group-desc">
            <Markdown text={group.description} />
        </div>
    </div>
    <Footer align="end">
        {#if gatedGroupsEnabled}
            <div class="gate">
                <GroupGateIcon on:upgrade gate={group.gate} />
            </div>
        {/if}
        {#if !client.isReadOnly()}
            <Button
                disabled={joining === group}
                loading={joining === group}
                tiny={true}
                hollow={true}
                on:click={() => joinGroup(group)}>{$_("join")}</Button>
        {/if}
        <Button disabled={joining === group} tiny={true} on:click={() => previewGroup(group)}
            >{$_("preview")}</Button>
    </Footer>
</div>

<style type="text/scss">
    .group-card {
        position: relative;
        display: flex;
        flex-direction: column;
        transition: transform 200ms ease-in-out, box-shadow 200ms ease-in-out,
            opacity 200ms ease-in-out, border-left 200ms ease-in-out;
        @include box-shadow(1);
        border-radius: $sp3;
        background-color: var(--recommended-bg);

        .group-title-line {
            display: flex;
            flex-direction: column;
            flex: auto;
            width: 100px; //don't really understand why this works
        }

        @include size-above(sm) {
            &:hover {
                @include box-shadow(2);
                // transform: scale(1.01);
            }
        }

        .main {
            padding: $sp4 $sp4 0 $sp4;
            @include mobile() {
                padding: $sp3 $sp3 0 $sp3;
            }
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: $sp4;
            margin-bottom: $sp4;
        }

        .avatar {
            flex: 0 0 60px;
            @include mobile() {
                flex: 0 0 45px;
            }
        }

        .group-name {
            @include font(book, normal, fs-120);
            @include ellipsis();
        }

        .group-desc {
            @include font(book, normal, fs-100);
            height: 150px;
            overflow: auto;
        }

        .user-count {
            @include font(light, normal, fs-80);
            color: var(--txt-light);
        }

        .gate {
            position: absolute;
            left: $sp4;
        }
    }
</style>
