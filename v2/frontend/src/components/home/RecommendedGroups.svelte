<script lang="ts">
    import type { GroupChatSummary } from "../../domain/chat/chat";

    import { flip } from "svelte/animate";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { avatarUrl as getAvatarUrl } from "../../domain/user/user.utils";
    import { AvatarSize, UserStatus } from "domain/user/user";
    import Close from "svelte-material-icons/Close.svelte";
    import Button from "../Button.svelte";
    import { push } from "svelte-spa-router";
    import { rtlStore } from "../../stores/rtl";
    import HoverIcon from "../HoverIcon.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";

    export let groups: GroupChatSummary[];

    const dispatch = createEventDispatcher();
    let selected = 0;
    let notInterested: string[] = [];

    $: filtered = groups.filter((g) => !notInterested.includes(g.chatId));

    function previewGroup({ chatId }: GroupChatSummary) {
        push(`/${chatId}`);
    }

    function close({ chatId }: GroupChatSummary) {
        notInterested = [chatId, ...notInterested];
    }

    function cancelRecommendations() {
        dispatch("cancelRecommendations");
    }
</script>

<div class="wrapper">
    {#if $screenWidth === ScreenWidth.ExtraSmall}
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

    {#each filtered as group, i (group.chatId)}
        <div
            animate:flip={{ duration: 150 }}
            class:rtl={$rtlStore}
            class="group-card"
            class:selected={selected === i}
            on:mouseenter={() => (selected = i)}>
            <span title={$_("notInterested")} class="close" on:click={() => close(group)}>
                <HoverIcon>
                    <Close size={"1.2em"} color={"var(--icon-txt)"} />
                </HoverIcon>
            </span>
            {#if $screenWidth !== ScreenWidth.ExtraSmall}
                <div class="avatar">
                    <Avatar
                        url={getAvatarUrl(group, "../assets/group.svg")}
                        status={UserStatus.None}
                        size={AvatarSize.Small} />
                </div>
            {/if}
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
        @include size-below(xs) {
            padding-top: 0;
        }
    }

    .subtitle {
        margin-bottom: $sp6;
        @include size-below(xs) {
            margin-bottom: 0;
            @include font(book, normal, fs-80);
            @include ellipsis();
        }
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;

        @include size-below(xs) {
            margin-bottom: 0;
            @include font(book, normal, fs-120);
            @include ellipsis();
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

        @include size-below(xs) {
            width: auto;
            margin: 0 $sp3 $sp3 $sp3;
            padding: $sp3;
        }

        .close {
            position: absolute;
            top: $sp2;
            right: $sp2;
        }

        @include size-above(xs) {
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

        .avatar {
            flex: 0 0 60px;
            @include size-below(xs) {
                flex: 0 0 50px;
            }
        }

        .body {
            flex: 1;
        }

        .group-name {
            @include font(bold, normal, fs-160);
            margin-bottom: $sp3;
            @include size-below(xs) {
                @include font-size(fs-140);
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
        }
    }
</style>
