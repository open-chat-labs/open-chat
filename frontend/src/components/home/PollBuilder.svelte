<script lang="ts">
    import Button from "../Button.svelte";
    import TabControl from "../TabControl.svelte";
    import Tab from "../Tab.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { flip } from "svelte/animate";
    import Input from "../Input.svelte";
    import Toggle from "./profile/Toggle.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import PlusCircleOutline from "svelte-material-icons/PlusCircleOutline.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { PollContent, TotalPollVotes } from "domain/chat/chat";
    const dispatch = createEventDispatcher();

    const MAX_QUESTION_LENGTH = 100;
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

    $: valid = poll.pollAnswers.size >= 2;

    export function resetPoll() {
        selectedDuration = "oneDay";
        answerError = "";
        nextAnswer = "";
        poll = emptyPoll();
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
        } else {
            answerError = "poll.invalidAnswer";
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

    function createPollContent(): PollContent {
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
        dispatch("sendPoll", createPollContent());
        open = false;
    }
</script>

<Overlay bind:active={open}>
    <ModalContent>
        <span slot="header">{$_("poll.create")}</span>
        <span slot="body">
            <div class="wrapper">
                <TabControl let:isTitle let:isContent>
                    <Tab id={0} {isTitle} {isContent}>
                        <span slot="title">{$_("poll.poll")}</span>
                        <form>
                            <div class="section">
                                <div class="legend">{$_("poll.questionLabel")}</div>
                                <Input
                                    bind:value={poll.pollQuestion}
                                    autofocus={true}
                                    minlength={0}
                                    maxlength={MAX_QUESTION_LENGTH}
                                    countdown={true}
                                    placeholder={$_("poll.optionalQuestion")} />
                            </div>

                            {#if poll.pollAnswers.size > 0}
                                <div class="section">
                                    <div class="legend">{$_("poll.answersLabel")}</div>
                                    {#each [...poll.pollAnswers] as answer, _i (answer)}
                                        <div animate:flip={{ duration: 200 }} class="answer-text">
                                            {answer}
                                            <div
                                                class="delete"
                                                on:click={() => deleteAnswer(answer)}>
                                                <DeleteOutline
                                                    size={$iconSize}
                                                    color={"var(--icon-txt)"} />
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            {#if poll.pollAnswers.size < MAX_ANSWERS}
                                <div class="section">
                                    <div class="legend">
                                        {$_(
                                            poll.pollAnswers.size < 2
                                                ? "poll.addAnswer"
                                                : "poll.addAnotherAnswer"
                                        )}
                                    </div>
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
                                </div>
                            {/if}
                        </form>
                    </Tab>
                    <Tab id={1} {isTitle} {isContent}>
                        <span slot="title">{$_("poll.settings")}</span>
                        <table>
                            <!-- <tr>
                            <td class="label">
                                {$_("poll.anonymous")}
                            </td>
                            <td>
                                <Toggle
                                    small={true}
                                    id={"anonymous"}
                                    on:change={() => (poll.anonymous = !poll.anonymous)}
                                    checked={poll.anonymous} />
                            </td>
                        </tr> -->

                            <tr>
                                <td class="label">
                                    {$_("poll.allowMultipleVotes")}
                                </td>
                                <td>
                                    <Toggle
                                        small={true}
                                        id={"allow-multiple"}
                                        on:change={() =>
                                            (poll.allowMultipleVotesPerUser =
                                                !poll.allowMultipleVotesPerUser)}
                                        checked={poll.allowMultipleVotesPerUser} />
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
                                        on:change={() =>
                                            (poll.limitedDuration = !poll.limitedDuration)}
                                        checked={poll.limitedDuration} />
                                </td>
                            </tr>

                            {#if poll.limitedDuration}
                                <tr>
                                    <td class="label">
                                        {$_("poll.showBeforeEnd")}
                                    </td>
                                    <td>
                                        <Toggle
                                            small={true}
                                            id={"show-before-end"}
                                            on:change={() =>
                                                (poll.showVotesBeforeEndDate =
                                                    !poll.showVotesBeforeEndDate)}
                                            checked={poll.showVotesBeforeEndDate} />
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
                    </Tab>
                </TabControl>
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

            @include mobile() {
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

    .next {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
    }

    .next-txt {
        flex: 1;
    }

    .add-btn {
        flex: 0 0 30px;
        cursor: pointer;
    }

    .legend {
        @include font(light, normal, fs-60);
        margin-bottom: $sp2;
        text-transform: lowercase;
    }
</style>
