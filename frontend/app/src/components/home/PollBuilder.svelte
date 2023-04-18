<script lang="ts">
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Input from "../Input.svelte";
    import Toggle from "../Toggle.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Radio from "../Radio.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import PlusCircleOutline from "svelte-material-icons/PlusCircleOutline.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { PollContent, TotalPollVotes } from "openchat-client";
    import Legend from "../Legend.svelte";
    const dispatch = createEventDispatcher();

    const MAX_QUESTION_LENGTH = 250;
    const MAX_ANSWER_LENGTH = 50;
    const MAX_ANSWERS = 10;
    const durations: Duration[] = ["oneHour", "oneDay", "oneWeek"];

    type Duration = "oneHour" | "oneDay" | "oneWeek";

    type CandidatePoll = {
        pollQuestion: string;
        anonymous: boolean;
        limitedDuration: boolean;
        showVotesBeforeEndDate: boolean;
        allowMultipleVotesPerUser: boolean;
        pollAnswers: Set<string>;
    };

    export let open: boolean;

    let poll: CandidatePoll = emptyPoll();
    let nextAnswer: string = "";
    let answerError: string | undefined = "";
    let selectedDuration: Duration = "oneDay";
    let showSettings = false;

    $: valid =
        poll.pollAnswers.size >= 2 ||
        (poll.pollAnswers.size >= 1 && nextAnswer.length > 0 && answerIsValid(nextAnswer));

    export function resetPoll() {
        selectedDuration = "oneDay";
        answerError = "";
        nextAnswer = "";
        poll = emptyPoll();
        showSettings = false;
    }

    function emptyPoll() {
        return {
            pollQuestion: "",
            anonymous: true,
            limitedDuration: true,
            showVotesBeforeEndDate: true,
            allowMultipleVotesPerUser: false,
            pollAnswers: new Set<string>(),
        };
    }

    function answerIsValid(answer: string): boolean {
        if (answer === undefined) return false;
        if (poll.pollAnswers.has(nextAnswer)) return false;
        return answer.length > 0 && answer.length <= MAX_ANSWER_LENGTH;
    }

    function addAnswer() {
        if (answerIsValid(nextAnswer)) {
            answerError = undefined;
            poll.pollAnswers = new Set(poll.pollAnswers.add(nextAnswer));
            nextAnswer = "";
            return true;
        } else {
            answerError = "poll.invalidAnswer";
            return false;
        }
    }

    function deleteAnswer(answer: string) {
        poll.pollAnswers.delete(answer);
        poll.pollAnswers = new Set(poll.pollAnswers);
    }

    function createPollVotes(): TotalPollVotes {
        if (poll.anonymous) {
            return { kind: "anonymous_poll_votes", votes: {} };
        } else if (poll.showVotesBeforeEndDate) {
            return { kind: "visible_poll_votes", votes: {} };
        } else {
            return { kind: "hidden_poll_votes", votes: 0 };
        }
    }

    const ONE_HOUR = 1000 * 60 * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const ONE_WEEK = ONE_DAY * 7;

    function createPollEndDate() {
        if (!poll.limitedDuration) return undefined;
        const now = Date.now();
        if (selectedDuration === "oneHour") return BigInt(now + ONE_HOUR);
        if (selectedDuration === "oneDay") return BigInt(now + ONE_DAY);
        if (selectedDuration === "oneWeek") return BigInt(now + ONE_WEEK);
    }

    function createPollContent(): PollContent | undefined {
        if (nextAnswer !== "") {
            if (!addAnswer()) {
                return undefined;
            }
        }
        return {
            kind: "poll_content",
            votes: {
                total: createPollVotes(),
                user: [],
            },
            config: {
                allowMultipleVotesPerUser: poll.allowMultipleVotesPerUser,
                text: poll.pollQuestion === "" ? undefined : poll.pollQuestion,
                showVotesBeforeEndDate: poll.showVotesBeforeEndDate,
                endDate: createPollEndDate(),
                anonymous: poll.anonymous,
                options: [...poll.pollAnswers],
            },
            ended: false,
        };
    }

    function start() {
        const poll = createPollContent();
        if (poll) {
            dispatch("sendPoll", [poll, undefined]);
            open = false;
        }
    }
</script>

{#if open}
    <Overlay>
        <ModalContent>
            <span slot="header">{$_("poll.create")}</span>
            <span slot="body">
                <div class="buttons">
                    <ButtonGroup align={"start"}>
                        <Button
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            secondary={showSettings}
                            on:click={() => (showSettings = false)}>{$_("poll.poll")}</Button>
                        <Button
                            small={!$mobileWidth}
                            secondary={!showSettings}
                            tiny={$mobileWidth}
                            on:click={() => (showSettings = true)}>{$_("poll.settings")}</Button>
                    </ButtonGroup>
                </div>
                {#if !showSettings}
                    <form>
                        <div class="section underline">
                            <Legend label={$_("poll.questionLabel")} />
                            <Input
                                bind:value={poll.pollQuestion}
                                autofocus={true}
                                minlength={0}
                                maxlength={MAX_QUESTION_LENGTH}
                                countdown={true}
                                placeholder={$_("poll.optionalQuestion")} />
                        </div>

                        <div class="section">
                            <Legend label={$_("poll.answersLabel")} rules={$_("poll.atLeastTwo")} />
                            {#each [...poll.pollAnswers] as answer, _i (answer)}
                                <div class="answer">
                                    <div class="answer-text">
                                        {answer}
                                    </div>
                                    <div class="delete" on:click={() => deleteAnswer(answer)}>
                                        <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
                                    </div>
                                </div>
                            {/each}
                            {#if poll.pollAnswers.size < MAX_ANSWERS}
                                <div class="next">
                                    <div class="next-txt">
                                        <Input
                                            bind:value={nextAnswer}
                                            disabled={poll.pollAnswers.size >= MAX_ANSWERS}
                                            minlength={1}
                                            maxlength={MAX_ANSWER_LENGTH}
                                            countdown={true}
                                            on:enter={addAnswer}
                                            placeholder={$_(
                                                poll.pollAnswers.size === MAX_ANSWERS
                                                    ? "poll.maxReached"
                                                    : "poll.answerText"
                                            )}>
                                            {#if answerError !== undefined}
                                                <ErrorMessage>{$_(answerError)}</ErrorMessage>
                                            {/if}
                                        </Input>
                                    </div>
                                    <div class="add-btn" on:click={addAnswer}>
                                        <PlusCircleOutline
                                            size={$iconSize}
                                            color={"var(--icon-txt)"} />
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </form>
                {:else}
                    <Toggle
                        small
                        id={"anonymous"}
                        on:change={() => (poll.anonymous = !poll.anonymous)}
                        label={$_("poll.anonymous")}
                        checked={poll.anonymous} />

                    <Toggle
                        small
                        id={"allow-multiple"}
                        label={$_("poll.allowMultipleVotes")}
                        on:change={() =>
                            (poll.allowMultipleVotesPerUser = !poll.allowMultipleVotesPerUser)}
                        checked={poll.allowMultipleVotesPerUser} />

                    <Toggle
                        small
                        id={"limited-duration"}
                        label={$_("poll.limitedDuration")}
                        on:change={() => (poll.limitedDuration = !poll.limitedDuration)}
                        checked={poll.limitedDuration} />

                    {#if poll.limitedDuration}
                        <Toggle
                            small
                            id={"show-before-end"}
                            label={$_("poll.showBeforeEnd")}
                            on:change={() =>
                                (poll.showVotesBeforeEndDate = !poll.showVotesBeforeEndDate)}
                            checked={poll.showVotesBeforeEndDate} />

                        <Legend label={$_("poll.pollDuration")} />
                        {#each durations as d}
                            <Radio
                                on:change={() => (selectedDuration = d)}
                                value={d}
                                checked={selectedDuration === d}
                                id={`duration_${d}`}
                                label={$_(`poll.${d}`)}
                                group={"poll_duration"} />
                        {/each}
                    {/if}
                {/if}
            </span>
            <span slot="footer">
                <ButtonGroup>
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        secondary={true}
                        on:click={() => (open = false)}>{$_("cancel")}</Button>
                    <Button
                        small={!$mobileWidth}
                        disabled={!valid}
                        tiny={$mobileWidth}
                        on:click={start}>{$_("poll.start")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    .section {
        padding-bottom: $sp4;

        &.underline {
            margin-bottom: $sp4;
            border-bottom: 1px solid var(--bd);
        }
    }

    .buttons {
        margin-bottom: $sp4;
    }

    .answer-text {
        flex: 1;
        padding: $sp3 $sp4;
        border-radius: $sp2;
        margin-bottom: $sp3;
        position: relative;
        border: 1px solid var(--bd);
        background-color: var(--input-bg);
    }

    .next,
    .answer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
    }

    .next-txt {
        flex: 1;
    }

    .add-btn,
    .delete {
        flex: 0 0 30px;
        cursor: pointer;
    }
</style>
