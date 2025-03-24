<script lang="ts">
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, ChitUserBalance } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Invaders from "./Invaders.svelte";
    import { isTouchDevice } from "../../utils/devices";
    import LighteningBolt from "./nav/LighteningBolt.svelte";
    import HoverIcon from "../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    interface Props {
        onClose: () => void;
        onStreak: () => void;
    }

    let { onClose, onStreak }: Props = $props();

    let bodyElement: HTMLDivElement;
    let showGame = $state(false);
    let mode: "all-time" | "last-month" | "this-month" = $state("this-month");
    let blankLeader = {
        username: "________",
        userId: "",
        balance: 0,
    };
    let leaders: ChitUserBalance[] = $state(dummyData());
    let date = new Date();
    let thisMonth = date.getUTCMonth() + 1;
    let lastMonth = thisMonth == 1 ? 12 : thisMonth - 1;

    onMount(() => {
        if (bodyElement) {
            for (let i = 0; i < 100; i++) {
                const star = document.createElement("div");
                star.classList.add("star");
                const left = Math.floor(Math.random() * 100);
                const top = Math.floor(Math.random() * 100);
                bodyElement.appendChild(star);
                star.style.left = `${left}%`;
                star.style.top = `${top}%`;
            }
        }
        getData();
    });

    function buildMonthText(month: number): string {
        return client.toMonthString(new Date(2000, month - 1));
    }

    function dummyData() {
        const data = [];
        for (let i = 0; i < 10; i++) {
            data.push(blankLeader);
        }
        return data;
    }

    function getData() {
        client
            .chitLeaderboard()
            .then((result) => {
                switch (mode) {
                    case "all-time":
                        leaders = result.allTime;
                        break;
                    case "last-month":
                        leaders = result.lastMonth;
                        break;
                    case "this-month":
                        leaders = result.thisMonth;
                        break;
                }

                leaders = leaders.slice(0, 10);
            })
            .finally(() => {
                leaders = [...leaders, ...Array(10 - leaders.length).fill(blankLeader)];
            });
    }

    function changeMode(m: "all-time" | "last-month" | "this-month") {
        mode = m;
        getData();
    }

    function streak() {
        dispatch("close");
        onClose();
        tick().then(onStreak);
    }
    let supportsGame = $derived(
        !isTouchDevice ||
            //@ts-ignore
            (window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission),
    );
    let thisMonthText = $derived(buildMonthText(thisMonth));
    let lastMonthText = $derived(buildMonthText(lastMonth));
</script>

<ModalContent closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <div class="streak">
                <HoverIcon onclick={streak}>
                    <LighteningBolt enabled={false} />
                </HoverIcon>
            </div>
            <div class="title-wrapper">
                <div class="title">{$_("openChat")}</div>
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div bind:this={bodyElement} class="body">
            {#if showGame}
                <Invaders />
            {:else}
                <div class="settings">
                    <div
                        onclick={() => changeMode("last-month")}
                        class="setting"
                        class:selected={mode === "last-month"}>
                        {lastMonthText}
                    </div>
                    <div
                        onclick={() => changeMode("this-month")}
                        class="setting"
                        class:selected={mode === "this-month"}>
                        {thisMonthText}
                    </div>
                    <div
                        onclick={() => changeMode("all-time")}
                        class="setting"
                        class:selected={mode === "all-time"}>
                        {$_("halloffame.allTime")}
                    </div>
                </div>
                <div class="scoreboard-container">
                    <table cellpadding="3px" class="scoreboard">
                        <thead class="table-header">
                            <tr>
                                {#if !$mobileWidth}
                                    <th class="rank">#</th>
                                {/if}
                                <th class="username">{$_("halloffame.username")}</th>
                                <th class="balance">CHIT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each leaders as leader, i}
                                <tr class="table-row">
                                    {#if !$mobileWidth}
                                        <td class="rank">{i + 1}</td>
                                    {/if}
                                    <td class="username" title={leader.username}
                                        >{leader.username}</td>
                                    <td class="balance">{leader.balance}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="hof-footer">
            <ButtonGroup align={"end"}>
                {#if showGame}
                    <div onclick={() => (showGame = false)} class="joystick">🏆️</div>
                    <Button
                        tiny={$mobileWidth}
                        small={!$mobileWidth}
                        on:click={() => (showGame = false)}>{$_("backToResults")}</Button>
                {:else}
                    {#if supportsGame}
                        <div onclick={() => (showGame = true)} class="joystick">🕹️</div>
                    {/if}
                    <Button
                        tiny={$mobileWidth}
                        small={!$mobileWidth}
                        on:click={() => dispatch("close")}>{$_("close")}</Button>
                {/if}
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.hof-footer .button-group) {
        justify-content: space-between !important;
        width: 100%;
    }

    :global(.hof-footer button) {
        font-family: "Press Start 2P", cursive;
    }

    :global(.star) {
        position: absolute;
        width: 2px;
        height: 2px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.5);
    }

    .body {
        position: relative;
    }

    .title-wrapper {
        perspective: 150px;
        overflow: hidden;
        margin-top: -$sp3;

        @include mobile() {
            margin-top: 0;
        }
    }

    .header,
    .body,
    .hof-footer {
        font-family: "Press Start 2P", cursive;
    }

    .hof-footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
    }

    .title {
        @include font-size(fs-220);
        color: yellow;
        text-shadow: 3px 3px 0 red;
        text-transform: uppercase;
        transform: rotateX(45deg);
        text-align: center;

        @include mobile() {
            @include font-size(fs-180);
        }
    }

    .scoreboard-container {
        position: relative;
    }

    .scoreboard {
        table-layout: fixed;
        width: 100%;
        border-collapse: collapse;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-transform: uppercase;
        @include font-size(fs-80);
        .table-header {
            border-bottom: 2px solid red;
            margin-bottom: $sp3;
        }

        tr:nth-child(-n + 3) {
            color: green;
        }

        th,
        td {
            padding: $sp2;
            @include mobile() {
                @include font-size(fs-50);
            }
        }

        th {
            @include font-size(fs-50);
        }

        .username {
            @include ellipsis();
            max-width: 0;
        }

        .rank {
            width: 100px;
        }

        .username,
        .rank {
            text-align: start;
        }

        .balance {
            // width: 20%;
            text-align: end;
        }
    }

    .joystick {
        display: grid;
        align-content: center;
        font-size: 1.6rem;
        margin-right: $sp2;
        cursor: pointer;
    }

    .streak {
        position: absolute;
        top: $sp3;
        left: $sp3;
        @include z-index("overlay");
    }

    .settings {
        font-size: 0.9rem;
        justify-content: space-evenly;
        @include mobile() {
            font-size: 0.7rem;
        }
        display: flex;
        gap: $sp4;
        margin-bottom: $sp5;

        .setting {
            cursor: pointer;
            text-transform: uppercase;

            &.selected {
                border-bottom: 2px solid var(--txt);
            }
        }
    }
</style>
