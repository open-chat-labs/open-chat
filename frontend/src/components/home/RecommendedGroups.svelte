<script lang="ts">
    import type { GroupChatSummary } from "../../domain/chat/chat";

    import { flip } from "svelte/animate";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { groupAvatarUrl } from "../../domain/user/user.utils";
    import { AvatarSize, UserStatus } from "domain/user/user";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { push } from "svelte-spa-router";
    import { rtlStore } from "../../stores/rtl";
    import HoverIcon from "../HoverIcon.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import Markdown from "./Markdown.svelte";
    import Footer from "./upgrade/Footer.svelte";

    export let groups: GroupChatSummary[];
    export let joining: GroupChatSummary | undefined;

    const dispatch = createEventDispatcher();
    let selected = 0;

    function previewGroup({ chatId }: GroupChatSummary) {
        push(`/${chatId}`);
    }

    function dismiss({ chatId }: GroupChatSummary) {
        dispatch("dismissRecommendation", chatId);
    }

    function cancelRecommendations() {
        dispatch("cancelRecommendations");
    }

    function joinGroup(group: GroupChatSummary) {
        dispatch("joinGroup", {
            group,
            select: false,
        });
    }

    function refresh() {
        dispatch("recommend");
    }
</script>

<div class="wrapper" class:no-groups={groups.length === 0}>
    {#if groups.length > 0}
        {#if $mobileWidth}
            <SectionHeader>
                <div class="back" class:rtl={$rtlStore} on:click={cancelRecommendations}>
                    <HoverIcon>
                        {#if $rtlStore}
                            <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                        {:else}
                            <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                        {/if}
                    </HoverIcon>
                </div>
                <div>
                    <h1 class="title">{$_("recommendedGroups")}</h1>
                    <p class="subtitle">{$_("selectAGroup")}</p>
                </div>
            </SectionHeader>
        {:else}
            <h1 class="title">{$_("recommendedGroups")}</h1>
            <p class="subtitle">{$_("selectAGroup")}</p>
        {/if}

        {#each groups as group, i (group.chatId)}
            <div
                animate:flip={{ duration: 150 }}
                class:rtl={$rtlStore}
                class="group-card"
                class:selected={selected === i}
                on:mouseenter={() => (selected = i)}>
                <div class="main">
                    {#if !$mobileWidth}
                        <div class="avatar">
                            <Avatar
                                url={groupAvatarUrl(group)}
                                status={UserStatus.None}
                                size={AvatarSize.Small} />
                        </div>
                    {/if}
                    <div class="body">
                        <div class="group-title-line">
                            {#if $mobileWidth}
                                <div class="avatar">
                                    <Avatar
                                        url={groupAvatarUrl(group)}
                                        status={UserStatus.None}
                                        size={AvatarSize.Tiny} />
                                </div>
                            {/if}
                            <h3 class="group-name">
                                {group.name}
                            </h3>
                        </div>
                        <p class="group-desc">
                            <Markdown text={group.description} />
                        </p>
                        <p class="user-count">
                            {$_("groupWithN", { values: { number: group.participantCount } })}
                        </p>
                    </div>
                </div>
                <Footer align="end">
                    <a
                        on:click|preventDefault|stopPropagation={() => dismiss(group)}
                        role="button"
                        href="/#"
                        class="not-interested">
                        {$_("notInterested")}
                    </a>
                    <Button
                        disabled={joining === group}
                        tiny={true}
                        on:click={() => previewGroup(group)}>{$_("preview")}</Button>
                    <Button
                        disabled={joining === group}
                        loading={joining === group}
                        tiny={true}
                        on:click={() => joinGroup(group)}
                        secondary={true}>{$_("join")}</Button>
                </Footer>
            </div>
        {/each}
    {:else}
        <h1 class="title">{$_("noRecommendations")}</h1>
        <p class="subtitle">{$_("checkBackLater")}</p>
        <ButtonGroup align={"fill"}>
            <Button small={true} on:click={cancelRecommendations}>{$_("close")}</Button>
            <Button secondary={true} small={true} on:click={refresh}>{$_("refresh")}</Button>
        </ButtonGroup>
    {/if}
</div>

<style type="text/scss">
    :global(.no-groups .buttons button:first-child) {
        text-transform: capitalize;
    }

    .subtitle {
        margin-bottom: $sp6;
        @include mobile() {
            margin-bottom: 0;
            @include font(book, normal, fs-80);
            @include ellipsis();
        }
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: 0;
            @include font(book, normal, fs-120);
            @include ellipsis();
        }
    }

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
        overflow-x: hidden;

        @include nice-scrollbar();
        @include mobile() {
            padding-top: 0;
            background-color: inherit;
        }

        &.no-groups {
            justify-content: center;
            text-align: center;
            background-color: var(--currentChat-header-bg);

            .title {
                @include mobile() {
                    @include font(book, normal, fs-160);
                    @include ellipsis();
                }
            }

            .subtitle {
                @include mobile() {
                    margin-bottom: $sp6;
                }
            }
        }
    }

    .back {
        flex: 0 0 10px;
        margin-right: 5px;

        &.rtl {
            margin-right: 0;
            margin-left: 5px;
        }
    }

    .group-card {
        position: relative;
        display: flex;
        flex-direction: column;
        transition: transform 200ms ease-in-out, box-shadow 200ms ease-in-out,
            opacity 200ms ease-in-out, border-left 200ms ease-in-out;
        @include box-shadow(2);
        width: 80%;
        border-radius: $sp2;
        opacity: 0.95;
        background-color: var(--recommended-bg);
        margin-bottom: $sp5;

        @include mobile() {
            width: calc(100% - #{$sp4});
            margin: 0 $sp3 $sp4 $sp3;
            opacity: 1;
        }

        .group-title-line {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: $sp3;
        }

        @include size-above(sm) {
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
        }

        .main {
            display: flex;
            align-items: flex-start;
            padding: $sp4;

            @include mobile() {
                padding: $sp3;
            }
        }

        .avatar {
            flex: 0 0 60px;
            @include mobile() {
                flex: 0 0 45px;
            }
        }

        .body {
            flex: 1;
        }

        .group-name {
            @include font(bold, normal, fs-160);
            margin-bottom: $sp3;
            @include mobile() {
                @include font-size(fs-120);
                @include ellipsis();
                margin-bottom: 0;
                flex: 1;
            }
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

            .not-interested {
                @include font(light, normal, fs-90);
                text-decoration: underline;
                text-decoration-color: var(--accent);
                text-underline-offset: $sp1;
                text-decoration-thickness: 2px;
                text-transform: lowercase;
                position: absolute;
                left: $sp4;
                bottom: $sp4;
            }
        }
    }
</style>
