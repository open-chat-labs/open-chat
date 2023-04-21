<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { now500 } from "../../stores/time";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Invaders from "./Invaders.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let bodyElement: HTMLDivElement;

    let cutoff = +new Date() + 1000 * 60 * 60 * 24 * 15;
    let showGame = false;

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
    });

    let leaders = [
        {
            username: "Hamish",
            value: 126,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "Matt",
            value: 101,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "julian_jelfs",
            value: 91,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "kennyslim98",
            value: 76,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "Fallen_crypto",
            value: 58,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "FoxMulder",
            value: 40,
            diamonds: 8,
            referrals: 26,
        },
        {
            username: "________",
            value: 0,
            diamonds: 0,
            referrals: 0,
        },
        {
            username: "________",
            value: 0,
            diamonds: 0,
            referrals: 0,
        },
        {
            username: "________",
            value: 0,
            diamonds: 0,
            referrals: 0,
        },
        {
            username: "________",
            value: 0,
            diamonds: 0,
            referrals: 0,
        },
    ];
</script>

<ModalContent hideHeader closeIcon on:close>
    <div bind:this={bodyElement} class="body" slot="body">
        {#if showGame}
            <Invaders />
        {:else}
            <img class="bot left" src="../assets/pixel.svg" />
            <img class="bot right" src="../assets/pixel.svg" />
            <div class="title-wrapper">
                <div class="title">OpenChat</div>
            </div>
            <table cellpadding="3px" class="scoreboard">
                <thead class="table-header">
                    <th class="rank">#</th>
                    <th class="username">Username</th>
                    <th class="value">Value</th>
                    <th class="diamonds">Diamonds</th>
                    <th class="users">Users</th>
                </thead>
                <tbody>
                    {#each leaders as leader, i}
                        <tr class="table-row">
                            <td class="rank">{i + 1}</td>
                            <td class="username">{leader.username}</td>
                            <td class="value">{leader.value}</td>
                            <td class="diamonds">{leader.diamonds}</td>
                            <td class="users">{leader.referrals}</td>
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
            {:else}
                <div on:click={() => (showGame = true)} class="joystick">🕹️</div>
            {/if}
            <Button tiny={$mobileWidth} small={!$mobileWidth} on:click={() => dispatch("close")}
                >{$_("close")}</Button>
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
    }

    .countdown {
        @include font-size(fs-160);
        color: yellow;
        text-shadow: 3px 3px 0 red;
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
</style>
