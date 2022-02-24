<script lang="ts">
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import { flip } from "svelte/animate";
    import Input from "../Input.svelte";
    import Toggle from "./profile/Toggle.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { PollContent, TotalPollVotes } from "domain/chat/chat";
    const dispatch = createEventDispatcher();

    const MAX_QUESTION_LENGTH = 100;
    const MAX_ANSWER_LENGTH = 100;
    const MAX_ANSWERS = 10;
    const durations: Duration[] = ["oneHour", "oneDay", "oneWeek"];

    type Duration = "oneHour" | "oneDay" | "oneWeek";

    export let open: boolean;
    let pollQuestion: string = "";
    let nextAnswer: string = "";
    let answerError: string | undefined = "";
    let anonymous = true;
    let limitedDuration = true;
    let showVotesBeforeEndDate = false;
    let allowMultipleVotesPerUser = false;
    let selectedTab: "poll" | "settings" = "poll";
    let selectedDuration: Duration = "oneDay";

    let pollAnswers: Set<string> = new Set();

    $: valid = pollAnswers.size >= 2;

    function answerIsValid(answer: string): boolean {
        if (answer === undefined) return false;
        if (pollAnswers.has(nextAnswer)) return false;
        return answer.length > 0 && answer.length <= MAX_ANSWER_LENGTH;
    }

    function addAnswer() {
        if (answerIsValid(nextAnswer)) {
            answerError = undefined;
            pollAnswers = new Set(pollAnswers.add(nextAnswer));
            nextAnswer = "";
        } else {
            answerError = "poll.invalidAnswer";
        }
    }

    function deleteAnswer(answer: string) {
        pollAnswers.delete(answer);
        pollAnswers = new Set(pollAnswers);
    }

    function createPollVotes(): TotalPollVotes {
        if (anonymous) {
            return { kind: "anonymous_poll_votes", votes: {} };
        } else if (showVotesBeforeEndDate) {
            return { kind: "visible_poll_votes", votes: {} };
        } else {
            return { kind: "hidden_poll_votes", votes: 0 };
        }
    }

    const ONE_HOUR = 1000 * 60 * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const ONE_WEEK = ONE_DAY * 7;

    function createPollEndDate() {
        if (!limitedDuration) return undefined;
        const now = Date.now();
        if (selectedDuration === "oneHour") return BigInt(now + ONE_HOUR);
        if (selectedDuration === "oneDay") return BigInt(now + ONE_DAY);
        if (selectedDuration === "oneWeek") return BigInt(now + ONE_WEEK);
    }

    function createPollContent(): PollContent {
        return {
            kind: "poll_content",
            votes: {
                total: createPollVotes(),
                user: new Set(),
            },
            config: {
                allowMultipleVotesPerUser,
                text: pollQuestion === "" ? undefined : pollQuestion,
                showVotesBeforeEndDate,
                endDate: createPollEndDate(),
                anonymous,
                options: [...pollAnswers],
            },
        };
    }

    function start() {
        dispatch("sendPoll", createPollContent());
        open = false;
    }
</script>

<Overlay bind:active={open}>
    <ModalContent>
        <span slot="header">{$_("poll.create")}</span>
        <span slot="body">
            <div class="wrapper">
                <div class="tabs">
                    <div
                        class="tab"
                        class:selected={selectedTab === "poll"}
                        on:click={() => (selectedTab = "poll")}>
                        {$_("poll.poll")}
                    </div>
                    <div
                        class="tab"
                        class:selected={selectedTab === "settings"}
                        on:click={() => (selectedTab = "settings")}>
                        {$_("poll.settings")}
                    </div>
                </div>
                <div class="tab-page" class:selected={selectedTab === "poll"}>
                    <form>
                        <div class="section">
                            <div class="legend">{$_("poll.questionLabel")}</div>
                            <Input
                                bind:value={pollQuestion}
                                autofocus={true}
                                minlength={0}
                                maxlength={MAX_QUESTION_LENGTH}
                                countdown={true}
                                placeholder={$_("poll.optionalQuestion")} />
                        </div>

                        {#if pollAnswers.size > 0}
                            <div class="section">
                                <div class="legend">{$_("poll.answersLabel")}</div>
                                {#each [...pollAnswers] as answer, i (answer)}
                                    <div animate:flip={{ duration: 200 }} class="answer-text">
                                        {answer}
                                        <div class="delete" on:click={() => deleteAnswer(answer)}>
                                            <DeleteOutline
                                                size={$iconSize}
                                                color={"var(--icon-txt)"} />
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        {#if pollAnswers.size < MAX_ANSWERS}
                            <div class="section">
                                <div class="legend">
                                    {$_(
                                        pollAnswers.size < 2
                                            ? "poll.addAnswer"
                                            : "poll.addAnotherAnswer"
                                    )}
                                </div>
                                <Input
                                    bind:value={nextAnswer}
                                    disabled={pollAnswers.size >= MAX_ANSWERS}
                                    minlength={1}
                                    maxlength={MAX_ANSWER_LENGTH}
                                    countdown={true}
                                    onEnter={addAnswer}
                                    placeholder={$_(
                                        pollAnswers.size === MAX_ANSWERS
                                            ? "poll.maxReached"
                                            : "poll.answerText"
                                    )}>
                                    {#if answerError !== undefined}
                                        <div class="error">{$_(answerError)}</div>
                                    {/if}
                                </Input>
                            </div>
                        {/if}
                    </form>
                </div>
                <div class="tab-page" class:selected={selectedTab === "settings"}>
                    <table>
                        <tr>
                            <td class="label">
                                {$_("poll.anonymous")}
                            </td>
                            <td>
                                <Toggle
                                    small={true}
                                    id={"anonymous"}
                                    on:change={() => (anonymous = !anonymous)}
                                    checked={anonymous} />
                            </td>
                        </tr>

                        <tr>
                            <td class="label">
                                {$_("poll.allowMultipleVotes")}
                            </td>
                            <td>
                                <Toggle
                                    small={true}
                                    id={"allow-multiple"}
                                    on:change={() =>
                                        (allowMultipleVotesPerUser = !allowMultipleVotesPerUser)}
                                    checked={allowMultipleVotesPerUser} />
                            </td>
                        </tr>

                        <tr>
                            <td class="label">
                                {$_("poll.limitedDuration")}
                            </td>
                            <td>
                                <Toggle
                                    small={true}
                                    id={"limited-duration"}
                                    on:change={() => (limitedDuration = !limitedDuration)}
                                    checked={limitedDuration} />
                            </td>
                        </tr>

                        {#if limitedDuration}
                            <tr>
                                <td class="label">
                                    {$_("poll.showBeforeEnd")}
                                </td>
                                <td>
                                    <Toggle
                                        small={true}
                                        id={"show-before-end"}
                                        on:change={() =>
                                            (showVotesBeforeEndDate = !showVotesBeforeEndDate)}
                                        checked={showVotesBeforeEndDate} />
                                </td>
                            </tr>

                            <tr>
                                <td class="label">
                                    {$_("poll.pollDuration")}
                                </td>
                                <td class="durations">
                                    {#each durations as d}
                                        <div
                                            class="duration"
                                            on:click={() => (selectedDuration = d)}
                                            class:selected={selectedDuration === d}>
                                            {$_(`poll.${d}`)}
                                        </div>
                                    {/each}
                                </td>
                            </tr>
                        {/if}
                    </table>
                </div>
            </div>
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button disabled={!valid} small={true} on:click={start}>{$_("poll.start")}</Button>
                <Button small={true} secondary={true} on:click={() => (open = false)}
                    >{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    :global(.tab-page .toggle-wrapper) {
        margin-bottom: 0 !important;
    }

    .section {
        margin-bottom: $sp4;
    }

    .durations {
        display: flex;
        gap: $sp3;
        align-items: center;

        .duration {
            border-radius: 22px;
            border: 1px solid var(--accent);
            padding: $sp3 $sp4;
            text-align: center;
            cursor: pointer;

            &.selected {
                background-color: var(--accent);
                color: #fff;
            }
        }
    }

    table {
        width: 100%;
        .label {
            @include font(light, normal, fs-70);
            text-align: right;
            padding: 0 $sp3;
            width: 40%;

            @include size-below(xs) {
                width: 30%;
            }
        }
        td {
            vertical-align: middle;
            padding: $sp3 0;
        }
    }

    .answer-text {
        flex: 1;
        padding: $sp3;
        border-radius: $sp2;
        margin-bottom: $sp3;
        position: relative;
        border: 1px solid var(--input-bd);
    }

    .delete {
        position: absolute;
        right: $sp2;
        top: $sp3;
        cursor: pointer;
    }

    .legend {
        @include font(light, normal, fs-60);
        margin-bottom: $sp2;
        text-transform: lowercase;
    }

    .error {
        @include font(bold, normal, fs-80);
        color: var(--error);
    }

    .tab-page {
        display: none;

        &.selected {
            display: block;
        }
    }

    .tabs {
        display: flex;
        border-bottom: 1px solid var(--button-bg);
        margin-bottom: $sp4;
    }

    .tab {
        cursor: pointer;
        padding: $sp3 $sp4;
        min-width: 100px;
        border: 1px solid var(--button-bg);
        text-align: center;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
        &.selected {
            background-color: var(--button-bg);
            color: var(--button-txt);
        }
    }
</style>
