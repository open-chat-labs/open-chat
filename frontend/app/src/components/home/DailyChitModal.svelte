<script lang="ts">
    import { Confetti } from "svelte-confetti";
    import { createEventDispatcher, getContext } from "svelte";
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

    $: user = client.user;
    // $: available = $user.nextDailyChitClaim < $now500;
    $: available = true;
    $: streak = 2;
    // $: streak = $user.streak;
    $: percent = (streak / 30) * 100;

    $: remaining = client.formatTimeRemaining($now500, Number($user.nextDailyChitClaim), true);

    function close() {
        dispatch("close");
    }

    function claim() {
        if (!available) return;

        busy = true;

        // client
        //     .claimDailyChit()
        //     .then((resp) => {
        //         if (resp.kind === "success") {
        //             claimed = true;
        //         }
        //     })
        //     .finally(() => {
        //         busy = false;
        //     });
        setTimeout(() => {
            streak += 1;
            claimed = true;
            busy = false;
            setTimeout(() => (claimed = false), 1000);
        }, 1000);
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

        <p class="balance">
            {`${$user.chitBalance.toLocaleString()} CHIT`}
        </p>

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
                <div class="badge three" class:achieved={streak >= 3}>
                    <Streak days={3} />
                </div>
                <div class="badge seven" class:achieved={streak >= 7}>
                    <Streak days={7} />
                </div>
                <div class="badge thirty" class:achieved={streak >= 30}>
                    <Streak days={30} />
                </div>
            </div>
        </div>
    </div>
    <div slot="footer">
        {#if claimed}
            <div class="confetti">
                <Confetti />
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
            filter: grayscale(80%);
            transform-origin: 50% 50%;
            transform: translateX($offset) scale(2.5);
            transition:
                filter 300ms ease-in-out,
                transform 300ms ease-in-out;

            &.achieved {
                filter: unset;
                animation: bounce 0.3s forwards;
            }

            &:hover {
                transform: translateX($offset) scale(3);
            }
        }
        .three {
            left: 10%;
        }
        .seven {
            left: 23.3%;
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
            background-color: var(--txt);
        }

        .streak {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            padding: 3px;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.1);
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

    @keyframes bounce {
        0% {
            transform: translateX($offset) scale(2.5);
        }
        50% {
            transform: translateX($offset) scale(3);
        }
        100% {
            transform: translateX($offset) scale(2.5);
        }
    }
</style>
