<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { _, locale } from "svelte-i18n";
    import { E8S_PER_TOKEN, OpenChat, ReferralStats } from "openchat-client";
    import { now500 } from "../../stores/time";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Invaders from "./Invaders.svelte";
    import { isTouchDevice } from "../../utils/devices";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: supportsGame =
        !isTouchDevice ||
        //@ts-ignore
        (window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission);

    let bodyElement: HTMLDivElement;
    let showGame = false;
    let mode: "all-time" | "last-month" | "current-month" = "current-month";
    let date = new Date();
    let blankLeader = {
        username: "________",
        totalUsers: 0,
        userId: "",
        diamondMembers: 0,
        totalRewardsE8s: BigInt(0),
    };
    let leaders: ReferralStats[] = dummyData();
    let cutoff = getBeginningOfNextMonth(date);

    let month = date.getUTCMonth() + 1;
    let year = date.getUTCFullYear();
    let lastMonth = month == 1 ? 12 : month - 1;
    let lastMonthYear = month == 1 ? year - 1 : year;
    $: monthText = buildMonthText(month, $locale);
    $: lastMonthText = buildMonthText(lastMonth, $locale);

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

    function buildMonthText(month: number, locale: string | null | undefined): string {
        return client.toMonthString(new Date(2000, month - 1), locale || "en");
    }

    function dummyData() {
        const data = [];
        for (let i = 0; i < 10; i++) {
            data.push(blankLeader);
        }
        return data;
    }

    function getData() {
        let args = undefined;

        switch (mode) {
            case "last-month":
                args = { month: lastMonth, year: lastMonthYear };
                break;
            case "current-month":
                args = { month, year };
                break;
        }
        
        client
            .getReferralLeaderboard(args)
            .then((result) => {
                leaders = [...result.stats];
            })
            .finally(() => {
                if (leaders.length < 10) {
                    for (let i = leaders.length; i < 10; i++) {
                        leaders.push(blankLeader);
                    }
                    leaders = leaders; //trigger reaction
                }
            });
    }

    function changeMode(m: "all-time" | "last-month" | "current-month") {
        mode = m;
        getData();
    }

    function getBeginningOfNextMonth(d: Date) {
        const month = d.getUTCMonth();
        const year = d.getUTCFullYear();
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        return +new Date(Date.UTC(nextYear, nextMonth, 1, 0, 0, 0, 0));
    }
</script>

<ModalContent hideHeader closeIcon on:close>
    <div bind:this={bodyElement} class="body" slot="body">
        {#if showGame}
            <Invaders />
        {:else}
            <img class="bot left" src="../assets/pixel.svg" />
            <img class="bot right" src="../assets/pixel.svg" />
            <div class="title-wrapper">
                <div class="title">{$_("openChat")}</div>
            </div>
            <div class="settings">
                <div
                    on:click={() => changeMode("last-month")}
                    class="setting"
                    class:selected={mode === "last-month"}>
                    {lastMonthText}
                </div>
                <div
                    on:click={() => changeMode("current-month")}
                    class="setting"
                    class:selected={mode === "current-month"}>
                    {monthText}
                </div>
                <div
                    on:click={() => changeMode("all-time")}
                    class="setting"
                    class:selected={mode === "all-time"}>
                    {$_("halloffame.allTime")}
                </div>
            </div>
            <div class="scoreboard-container">
                <table cellpadding="3px" class="scoreboard">
                    <thead class="table-header">
                        {#if !$mobileWidth}
                            <th class="rank">#</th>
                        {/if}
                        <th class="username">{$_("halloffame.username")}</th>
                        <th class="value">{$_("halloffame.value")}</th>
                        {#if !$mobileWidth}
                            <th class="diamonds">{$_("halloffame.diamonds")}</th>
                            <th class="users">{$_("halloffame.users")}</th>
                        {/if}
                    </thead>
                    <tbody>
                        {#each leaders as leader, i}
                            <tr class="table-row">
                                {#if !$mobileWidth}
                                    <td class="rank">{i + 1}</td>
                                {/if}
                                <td class="username" title={leader.username}>{leader.username}</td>
                                <td class="value"
                                    >{(Number(leader.totalRewardsE8s) / E8S_PER_TOKEN)
                                        .toFixed(2)
                                        .toString()}</td>
                                {#if !$mobileWidth}
                                    <td class="diamonds">{leader.diamondMembers}</td>
                                    <td class="users">{leader.totalUsers}</td>
                                {/if}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
    <div slot="footer" class="hof-footer">
        <span class="countdown">{client.formatTimeRemaining($now500, cutoff)}</span>
        <ButtonGroup align={$mobileWidth ? "center" : "end"}>
            {#if showGame}
                <div on:click={() => (showGame = false)} class="joystick">🏆️</div>
                <Button
                    tiny={$mobileWidth}
                    small={!$mobileWidth}
                    on:click={() => (showGame = false)}>{$_("backToResults")}</Button>
            {:else}
                {#if supportsGame}
                    <div on:click={() => (showGame = true)} class="joystick">🕹️</div>
                {/if}
                <Button tiny={$mobileWidth} small={!$mobileWidth} on:click={() => dispatch("close")}
                    >{$_("close")}</Button>
            {/if}
        </ButtonGroup>
    </div>
</ModalContent>

<style type="text/scss">
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
        margin-bottom: $sp5;
    }

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

    .countdown {
        @include font-size(fs-160);
        color: yellow;
        text-shadow: 3px 3px 0 red;

        @include mobile() {
            @include font-size(fs-100);
            text-shadow: 2px 2px 0 red;
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
        margin-bottom: $sp4;
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
            width: 50px;
        }

        .username,
        .rank {
            text-align: start;
        }

        .value,
        .diamonds,
        .users {
            width: 20%;
            text-align: end;

            @include mobile() {
                width: 25%;
            }
        }
    }

    .bot {
        position: absolute;
        width: 35px;
        height: 35px;
        top: 4px;

        &.left {
            left: 4px;
        }

        &.right {
            right: 4px;
        }
    }

    .joystick {
        display: grid;
        align-content: center;
        font-size: 1.6rem;
        margin-right: $sp2;
        cursor: pointer;
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
