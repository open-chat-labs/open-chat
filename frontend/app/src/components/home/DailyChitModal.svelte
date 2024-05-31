<script lang="ts">
    import { Confetti } from "svelte-confetti";
    import { createEventDispatcher, getContext } from "svelte";
    import { fade } from "svelte/transition";
    import ModalContent from "../ModalContent.svelte";
    import type { OpenChat } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { now500 } from "../../stores/time";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";
    import Streak from "./profile/Streak.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let busy = false;
    let claimed = false;
    let additional: number | undefined = undefined;

    $: user = client.user;
    $: available = $user.nextDailyChitClaim < $now500;
    $: streak = $user.streak;
    $: percent = calculatePercentage(streak);
    $: remaining = client.formatTimeRemaining($now500, Number($user.nextDailyChitClaim), true);

    // These are useful for testing
    // $: available = true;
    // $: streak = 2;

    function calculatePercentage(streak: number): number {
        const percent = (streak / 30) * 100;
        return percent > 100 ? 100 : percent;
    }

    function close() {
        dispatch("close");
    }

    function claim() {
        if (!available) return;

        busy = true;

        const previousBalance = $user.chitBalance;

        client
            .claimDailyChit()
            .then((resp) => {
                if (resp.kind === "success") {
                    claimed = true;
                    additional = $user.chitBalance - previousBalance;
                    window.setTimeout(() => {
                        additional = undefined;
                    }, 2000);
                }
            })
            .finally(() => {
                busy = false;
            });

        // This is useful for testing so I'll leave it here for a bit
        // setTimeout(() => {
        //     streak += 1;
        //     claimed = true;
        //     busy = false;
        //     additional = 200;
        //     setTimeout(() => {
        //         claimed = false;
        //         additional = undefined;
        //     }, 2000);
        // }, 1000);
    }
</script>

<ModalContent closeIcon on:close={close}>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("dailyChit.title")} />
    </div>
    <div class="body" slot="body">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class:available class="logo" on:click={claim}>
            <FancyLoader loop={busy} />
            <div class="streak">{streak}</div>
        </div>

        <div class="balance">
            <div class="spacer"></div>
            <div class="current">
                <div class="chit"></div>
                {`${$user.chitBalance.toLocaleString()} CHIT`}
            </div>
            <div class="additional">
                {#if additional}
                    <div transition:fade={{ duration: 500 }}>{`+ ${additional}`}</div>
                {/if}
            </div>
        </div>

        <p>
            <Translatable
                resourceKey={i18nKey(
                    available ? "dailyChit.available" : "dailyChit.alreadyClaimed",
                )} />
        </p>
        <p class="info">
            <Translatable resourceKey={i18nKey("dailyChit.info")} />
        </p>

        <div class="progress">
            <Progress size={"20px"} {percent}></Progress>

            <div class="marker" style="left: {percent}%">
                <div class="line"></div>
            </div>

            <div class="badges">
                <div class="badge three">
                    <Streak disabled={streak < 3} days={3} />
                </div>
                <div class="badge seven">
                    <Streak disabled={streak < 7} days={7} />
                </div>
                <div class="badge fourteen">
                    <Streak disabled={streak < 14} days={14} />
                </div>
                <div class="badge thirty">
                    <Streak disabled={streak < 30} days={30} />
                </div>
            </div>
        </div>
    </div>
    <div slot="footer">
        {#if claimed}
            <div class="confetti">
                <Confetti colorArray={["url(../assets/chit.svg)"]} />
            </div>
        {/if}
        <ButtonGroup align={"center"}>
            <Button loading={busy} disabled={!available} on:click={claim}>
                {#if available}
                    <Translatable resourceKey={i18nKey("dailyChit.claim")} />
                {:else}
                    <Translatable
                        resourceKey={i18nKey("dailyChit.comeback", { time: remaining })} />
                {/if}
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    $offset: -18px;

    .header,
    .body {
        align-self: center;
        text-align: center;
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp3;
    }

    .progress {
        position: relative;
        margin: $sp6 0 48px 0;
        width: 100%;
    }

    .info {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }

    .badges {
        margin-top: -28px;
        position: relative;

        .badge {
            position: absolute;
            transform-origin: 50% 50%;
            transform: translateX($offset) scale(2.5);
            transition:
                filter 300ms ease-in-out,
                transform 300ms ease-in-out;

            &:hover {
                transform: translateX($offset) scale(3);
            }
        }
        .three {
            left: 10%;
        }
        .seven {
            left: 23.33%;
        }
        .fourteen {
            left: 46.66%;
        }
        .thirty {
            left: 100%;
        }
    }

    .marker {
        position: absolute;
        top: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: left 300ms ease-in-out;
        transform: translateX(-50%);

        .line {
            width: 1px;
            flex: 0 0 20px;
            background-color: var(--bd);
        }
    }

    .confetti {
        position: absolute;
        pointer-events: none;
        top: 50%;
        left: 50%;
    }

    .logo {
        width: 120px;
        position: relative;
        // -webkit-box-reflect: below 0
        //     linear-gradient(hsla(0, 0%, 100%, 0), hsla(0, 0%, 100%, 0) 45%, hsla(0, 0%, 100%, 0.2));

        &.available {
            cursor: pointer;
        }

        .streak {
            position: absolute;
            top: 48%;
            left: 50%;
            transform: translateX(-50%) translateY(-50%);
            @include font(bold, normal, fs-180);
        }
    }

    .balance {
        display: flex;
        gap: $sp4;
        justify-content: space-between;
        align-items: center;

        > * {
            white-space: nowrap;
        }

        .spacer,
        .additional {
            flex: 1;
            min-width: 0;
            color: var(--txt-light);
            color: var(--accent);
        }

        .current {
            flex-shrink: 0;
            padding: $sp2 $sp3;
            border: 1px solid var(--bd);
            border-radius: var(--rd);
            background-color: rgba(255, 255, 255, 0.1);
            display: flex;
            gap: $sp3;
            align-items: center;

            .chit {
                background-image: url("/assets/chit.svg");
                background-repeat: no-repeat;
                width: $sp4;
                height: $sp4;
            }
        }
    }
</style>
