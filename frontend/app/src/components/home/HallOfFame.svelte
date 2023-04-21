<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import { E8S_PER_TOKEN, OpenChat, ReferralStats } from "openchat-client";
    import { now500 } from "../../stores/time";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Invaders from "./Invaders.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let bodyElement: HTMLDivElement;

    let cutoff = +new Date() + 1000 * 60 * 60 * 24 * 15;
    let showGame = false;
    let mode: "all-time" | "monthly" = "monthly";
    let busy = false;
    let leaders: ReferralStats[] = [];

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
        busy = true;
        client
            .getReferralLeaderboard()
            .then((result) => {
                leaders = result.stats;
            })
            .finally(() => {
                if (leaders.length < 10) {
                    for (let i = leaders.length; i < 10; i++) {
                        leaders.push({
                            username: "",
                            totalUsers: 0,
                            userId: "",
                            diamondMembers: 0,
                            totalRewardsE8s: BigInt(0),
                        });
                    }
                }
                busy = false;
            });
    });
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
                <div class="setting this-month" class:selected={mode === "monthly"}>
                    {$_("halloffame.thisMonth")}
                </div>
                <div class="setting all-time" class:selected={mode === "all-time"}>
                    {$_("halloffame.allTime")}
                </div>
            </div>
            <table cellpadding="3px" class="scoreboard">
                <thead class="table-header">
                    {#if !$mobileWidth}
                        <th class="rank">#</th>
                    {/if}
                    <th class="username">Username</th>
                    <th class="value">Value</th>
                    <th class="diamonds">Diamonds</th>
                    <th class="users">Users</th>
                </thead>
                <tbody>
                    {#each leaders as leader, i}
                        <tr class="table-row">
                            {#if !$mobileWidth}
                                <td class="rank">{i + 1}</td>
                            {/if}
                            <td class="username">{leader.username}</td>
                            <td class="value"
                                >{(Number(leader.totalRewardsE8s) / E8S_PER_TOKEN).toString()}</td>
                            <td class="diamonds">{leader.diamondMembers}</td>
                            <td class="users">{leader.totalUsers}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
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
                <div on:click={() => (showGame = true)} class="joystick">🕹️</div>
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

    .scoreboard {
        width: 100%;
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
        .username,
        .rank {
            text-align: start;
        }
        .value,
        .diamonds,
        .users {
            text-align: end;
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
        cursor: pointer;
    }

    .settings {
        display: flex;
        justify-content: space-evenly;
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
