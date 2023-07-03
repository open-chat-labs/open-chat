<script lang="ts">
    import {
        GroupChatIdentifier,
        GroupChatSummary,
        OpenChat,
        chatIdentifiersEqual,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Loading from "../Loading.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { rtlStore } from "../../stores/rtl";
    import HoverIcon from "../HoverIcon.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { getContext, onMount } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import RecommendedGroup from "./RecommendedGroup.svelte";
    import { RemoteData, mapRemoteData } from "../../utils/remoteData";
    import page from "page";

    export let joining: GroupChatSummary | undefined;

    const client = getContext<OpenChat>("client");

    let hotGroups: RemoteData<GroupChatSummary[], string> = { kind: "idle" };

    onMount(loadData);

    function cancelRecommendations() {
        page("/");
    }

    function dismissRecommendation(ev: CustomEvent<GroupChatIdentifier>) {
        hotGroups = mapRemoteData(hotGroups, (data) =>
            data.filter((g) => !chatIdentifiersEqual(g.id, ev.detail))
        );
        client.dismissRecommendation(ev.detail);
    }

    function loadData() {
        hotGroups = { kind: "loading" };
        client
            .getRecommendedGroups()
            .then((resp) => {
                if (hotGroups.kind === "loading") {
                    hotGroups = { kind: "success", data: resp };
                }
            })
            .catch((err) => (hotGroups = { kind: "error", error: err.toString() }));
    }
</script>

{#if hotGroups.kind === "loading"}
    <Loading />
{:else if hotGroups.kind === "success" && hotGroups.data.length > 0}
    <div class="wrapper">
        <SectionHeader>
            {#if $mobileWidth}
                <div class="back" class:rtl={$rtlStore} on:click={cancelRecommendations}>
                    <HoverIcon>
                        {#if $rtlStore}
                            <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                        {:else}
                            <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                        {/if}
                    </HoverIcon>
                </div>
            {/if}
            <div class="header">
                <h3 class="title">{$_("hotGroups")}</h3>
                <p class="subtitle">{$_("selectAGroup")}</p>
            </div>
        </SectionHeader>

        <div class="groups">
            {#each hotGroups.data as group, _i (group.id.groupId)}
                <RecommendedGroup
                    on:upgrade
                    on:dismissRecommendation={dismissRecommendation}
                    on:joinGroup
                    on:leaveGroup
                    {group}
                    {joining} />
            {/each}
        </div>
    </div>
{:else}
    <div class="no-groups">
        <h3 class="title">{$_("noHotGroups")}</h3>
        <p class="subtitle">{$_("checkBackLater")}</p>
        <ButtonGroup align={"fill"}>
            <Button small={true} on:click={cancelRecommendations}>{$_("close")}</Button>
            <Button secondary={true} small={true} on:click={loadData}>{$_("refresh")}</Button>
        </ButtonGroup>
    </div>
{/if}

<style lang="scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
    }

    .subtitle {
        margin-bottom: 0;
        @include font(book, normal, fs-80);
        @include ellipsis();
    }

    .title {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
    }

    .no-groups {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;

        .subtitle,
        .title {
            margin-bottom: $sp3;
            @include ellipsis();
        }

        .subtitle {
            @include font(book, normal, fs-100);
        }

        .title {
            @include font(book, normal, fs-180);
        }
    }

    .groups {
        padding: $sp4;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        column-gap: $sp6;
        row-gap: $sp6;
        @include nice-scrollbar();

        @include size-below(xxl) {
            grid-template-columns: 1fr 1fr;
        }

        @include size-below(md) {
            grid-template-columns: 1fr;
        }

        @include mobile() {
            column-gap: $sp5;
            row-gap: $sp5;
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
</style>
