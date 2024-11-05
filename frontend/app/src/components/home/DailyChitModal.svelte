<script lang="ts">
    import TrophyOutline from "svelte-material-icons/TrophyOutline.svelte";
    import { Confetti } from "svelte-confetti";
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import { fade } from "svelte/transition";
    import ModalContent from "../ModalContent.svelte";
    import {
        type AirdropChannelDetails,
        type OpenChat,
        chitStateStore as chitState,
    } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { now500 } from "../../stores/time";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";
    import Streak from "./profile/Streak.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import LearnToEarn from "./profile/LearnToEarn.svelte";
    import ChitBalance from "./profile/ChitBalance.svelte";
    import AlertBox from "../AlertBox.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let busy = false;
    let claimed = false;
    let additional: number | undefined = undefined;
    let learnToEarn = false;
    let airdropChannel: AirdropChannelDetails | undefined = undefined;
    let isMemberOfAirdropChannel = false;

    $: available = $chitState.nextDailyChitClaim < $now500;
    $: streak = $chitState.streakEnds < $now500 ? 0 : $chitState.streak;
    $: percent = calculatePercentage(streak);
    $: remaining = client.formatTimeRemaining($now500, Number($chitState.nextDailyChitClaim), true);

    onMount(() => {
        isMemberOfAirdropChannel = client.isMemberOfAirdropChannel();
        if (!isMemberOfAirdropChannel) {
            airdropChannel = client.currentAirdropChannel;
        }
    });

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

        const previousBalance = $chitState.chitBalance;

        client
            .claimDailyChit()
            .then((resp) => {
                if (resp.kind === "success") {
                    claimed = true;
                    additional = $chitState.chitBalance - previousBalance;
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

    function leaderboard() {
        close();
        tick().then(() => dispatch("leaderboard"));
    }

    function earnMore() {
        learnToEarn = true;
    }
</script>

{#if learnToEarn}
    <LearnToEarn on:close={() => (learnToEarn = false)} />
{/if}

<ModalContent closeIcon on:close={close}>
    <div class="header" slot="header">
        <div class="leaderboard">
            <HoverIcon onclick={leaderboard}>
                <TrophyOutline size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
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
                <ChitBalance
                    balance={$chitState.chitBalance}
                    totalEarned={$chitState.totalChitEarned}
                    me={false}
                    size={"large"} />
            </div>
            <div class="additional">
                {#if additional}
                    <div transition:fade={{ duration: 500 }}>{`+ ${additional}`}</div>
                {/if}
            </div>
        </div>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-missing-attribute -->
        <a
            class="earn-more"
            tabindex="0"
            on:click|preventDefault|stopPropagation={earnMore}
            role="button">
            <Translatable resourceKey={i18nKey("profile.earnMore")} />
        </a>

        <p>
            <Translatable
                resourceKey={i18nKey(
                    available ? "dailyChit.available" : "dailyChit.alreadyClaimed",
                )} />
        </p>
        <p class="info">
            <Translatable resourceKey={i18nKey("dailyChit.info")} />
        </p>

        <div class="progress-wrapper">
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

        {#if airdropChannel !== undefined}
            <AlertBox>
                <Markdown
                    text={$_("airdropWarning", {
                        values: {
                            url: airdropChannel.url,
                            channelName: airdropChannel.channelName,
                            communityName: airdropChannel.communityName,
                        },
                    })}></Markdown>
            </AlertBox>
        {/if}
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
    :root {
        --offset: -20px;
        --margin-top: -24px;
        --scale: 2.5;
        @include mobile() {
            --offset: -18px;
            --margin-top: -22px;
            --scale: 2;
        }
    }

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

    .progress-wrapper {
        width: 100%;
        padding: 0 $sp4;
        margin-bottom: $sp3;
    }

    .progress {
        position: relative;
        margin: $sp6 0 48px 0;
        width: 100%;

        @include mobile() {
            margin: $sp6 0 $sp6 0;
        }
    }

    .info {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }

    .badges {
        margin-top: var(--margin-top);
        position: relative;

        .badge {
            position: absolute;
            transform-origin: 50% 50%;
            transform: translateX(var(--offset)) scale(var(--scale));
            transition:
                filter 300ms ease-in-out,
                transform 300ms ease-in-out;

            &:hover {
                transform: translateX(var(--offset)) scale(3);
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

        @include mobile() {
            width: 100px;
        }

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
        }
    }

    .earn-more {
        color: var(--txt);
        text-decoration: underline;
        text-underline-offset: $sp2;
        align-self: center;
        margin: 0 0 $sp3 0;
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .leaderboard {
        position: absolute;
        top: $sp3;
        left: $sp3;
    }
</style>
