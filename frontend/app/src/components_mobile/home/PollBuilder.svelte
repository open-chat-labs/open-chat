<script lang="ts">
    import {
        AnchoredSheet,
        Body,
        BodySmall,
        ColourVars,
        Column,
        CommonButton2,
        Row,
        Switch,
        transition,
        ExpandingTextArea,
    } from "component-lib";
    import {
        ONE_DAY,
        OpenChat,
        publish,
        type MessageContext,
        type PollContent,
        type TotalPollVotes,
    } from "openchat-client";
    import { dragHandle, dragHandleZone, type DndEvent } from "svelte-dnd-action";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Cog from "svelte-material-icons/Cog.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Chart from "svelte-material-icons/ChartBoxOutline.svelte";
    import UnfoldMoreHorizontal from "svelte-material-icons/UnfoldMoreHorizontal.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Setting from "../Setting.svelte";
    import Translatable from "../Translatable.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import { keyboard } from "@stores/keyboard.svelte";
    import { flip } from "svelte/animate";

    const MAX_QUESTION_LENGTH = 250;
    const MAX_ANSWER_LENGTH = 75;
    const MAX_ANSWERS = 10;

    const client = getContext<OpenChat>("client");
    const flipDurationMs = 100;

    type Answer = {
        _id: number;
        value: string;
    };

    let answerId = 0;
    const emptyAnswer = () => ({ _id: answerId++, value: "" });
    const isAnswerEmpty = ({ value }: Answer): boolean => value.length === 0;

    type CandidatePoll = {
        pollQuestion: string;
        anonymous: boolean;
        showVotesBeforeEndDate: boolean;
        allowMultipleVotesPerUser: boolean;
        allowUserToChangeVote: boolean;
        pollAnswers: Answer[];
        duration: bigint;
    };

    interface Props {
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { messageContext, onClose }: Props = $props();

    let anchoredSheet: AnchoredSheet;
    let poll: CandidatePoll = $state(emptyPoll());
    let enoughAnswers = $derived(poll.pollAnswers.filter((a) => !isAnswerEmpty(a)).length >= 2);
    let uniqueAnswers = $derived.by(() => {
        const a = poll.pollAnswers.map((a) => a.value.toUpperCase());
        return a.length === new Set(a).size;
    });
    let validQuestion = $derived(poll.pollQuestion.length > 0);
    let validAnswers = $derived(enoughAnswers && uniqueAnswers);
    let valid = $derived(validQuestion && validAnswers);

    type ShortStatusKeys = {
        visibility: string;
        voteType: string;
        voteEdit: string;
        viewResults: string | undefined;
    };

    // Internationalisation required here, and in the component layout.
    let shortStatus = $derived.by<ShortStatusKeys>(() => {
        return {
            visibility: poll.anonymous ? "poll.anonymous" : "poll.app.public",
            voteType: poll.allowMultipleVotesPerUser ? "poll.app.multiVote" : "poll.app.singleVote",
            voteEdit: poll.allowUserToChangeVote
                ? "poll.app.canChangeVote"
                : "poll.app.cantChangeVote",
            viewResults: poll.showVotesBeforeEndDate ? undefined : "poll.app.resultsWillShow",
        };
    });

    onMount(() => {
        const wasViewportResizeEnabled = keyboard.viewportResizeEnabled;
        // If resize is currently not enabled, enable it!
        if (!wasViewportResizeEnabled) keyboard.enableViewportResize();

        return () => {
            // If resize was not enabled enabled when the component was mounted,
            // disable it again.
            if (!wasViewportResizeEnabled) keyboard.disableViewportResize();
        };
    });

    export function resetPoll() {
        poll = emptyPoll();
    }

    function emptyPoll() {
        return {
            pollQuestion: "",
            anonymous: true,
            showVotesBeforeEndDate: true,
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: true,
            pollAnswers: [emptyAnswer(), emptyAnswer()],
            duration: BigInt(ONE_DAY),
        };
    }

    let addingAnswer = $state(false);
    function addAnswer() {
        if (addingAnswer) return;

        addingAnswer = true;
        const emptyCount = poll.pollAnswers.filter(isAnswerEmpty).length;

        // Only add a new field if there are NO empty slots left
        if (emptyCount === 0 && poll.pollAnswers.length < MAX_ANSWERS) {
            transition(["fade"], () => {
                poll.pollAnswers = [...poll.pollAnswers, emptyAnswer()];
            });
        }

        setTimeout(() => (addingAnswer = false), 100);
    }

    function checkInputIfEmpty(idx: number) {
        const emptyCount = poll.pollAnswers.filter(isAnswerEmpty).length;

        // Remove if input is empty, and there's at least one more empty answer
        if (idx > 1 && emptyCount > 1 && isAnswerEmpty(poll.pollAnswers[idx])) {
            deleteAnswer(idx);
        }
    }

    // TODO fix an (android) issue where an answer input loses the focus, after
    // a previously focused input value was fully removed, and the input deleted.
    function deleteAnswer(idx: number) {
        transition(["fade"], () => {
            poll.pollAnswers.splice(idx, 1);
            normalizeTrailingEmpty();
        });
    }

    // Helper to keep the "one trailing empty" rule
    function normalizeTrailingEmpty() {
        const nonEmpty = poll.pollAnswers.filter((a) => !isAnswerEmpty(a));

        if (nonEmpty.length === 0) {
            poll.pollAnswers = [emptyAnswer(), emptyAnswer()];
        } else {
            // Keep non-empty + one empty at the end
            poll.pollAnswers = [...nonEmpty, emptyAnswer()];
        }
    }

    function handleDndConsider(e: CustomEvent<DndEvent<Answer>>) {
        poll.pollAnswers = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<Answer>>) {
        poll.pollAnswers = e.detail.items;
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

    function createPollContent(): PollContent | undefined {
        return {
            kind: "poll_content",
            votes: {
                total: createPollVotes(),
                user: [],
            },
            config: {
                allowMultipleVotesPerUser: poll.allowMultipleVotesPerUser,
                allowUserToChangeVote: poll.allowUserToChangeVote,
                text: poll.pollQuestion === "" ? undefined : poll.pollQuestion,
                showVotesBeforeEndDate: poll.showVotesBeforeEndDate,
                endDate: BigInt(+new Date()) + poll.duration,
                anonymous: poll.anonymous,
                options: [
                    ...poll.pollAnswers
                        .filter(({ value }) => value.length > 0)
                        .map((a) => a.value)
                        .values(),
                ],
            },
            ended: false,
        };
    }

    function start() {
        const poll = createPollContent();
        if (poll) {
            client.sendMessageWithContent(messageContext, poll, false);
            onClose();
        }
    }

    function back() {
        publish("closeModalPage");
    }

    // Used to preemptively hide the anchored sheet when input is focused, and
    // we expect the keyboard to show, but it has not shown yet.
    let preemptiveHideOptions = $state(false);
    function inputFocused() {
        if (client.isNativeApp() && !keyboard.visible) {
            preemptiveHideOptions = true;
        }
    }

    $effect(() => {
        if (keyboard.visible) {
            // Resets the value once the keyboard is visible.
            preemptiveHideOptions = false;
        }
    });
</script>

<SlidingPageContent onBack={back} title={i18nKey("poll.create")}>
    <Column height={"fill"} gap={"xxl"} padding={["xxl", "lg", "huge"]}>
        <Column gap="sm" padding={["zero", "lg"]}>
            <DurationSelector bind:duration={poll.duration}>
                {#snippet title()}
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("poll.pollDuration")} />
                    </Body>
                {/snippet}
            </DurationSelector>
        </Column>
        <Column gap={"md"}>
            <Column gap="sm" padding={["zero", "lg"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("poll.app.questionLabel")} />
                </Body>
            </Column>
            <ExpandingTextArea
                maxlength={MAX_QUESTION_LENGTH}
                countdown
                bind:value={poll.pollQuestion}
                placeholder={interpolate($_, i18nKey("poll.app.questionInputPlaceholder"))}
                onfocus={inputFocused}>
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("poll.app.questionInputSubtext")} />
                {/snippet}
            </ExpandingTextArea>
        </Column>

        <Column gap={"lg"}>
            <Column gap="sm" padding={["zero", "lg"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("poll.app.answerLabel")} />
                </Body>
                <Body colour="textSecondary">
                    <Translatable resourceKey={i18nKey("poll.app.answerRequirements")} />
                </Body>
            </Column>
            <Column gap="sm">
                <div
                    class={"dropzone"}
                    use:dragHandleZone={{
                        items: poll.pollAnswers,
                        flipDurationMs,
                        dropTargetStyle: {},
                    }}
                    onconsider={handleDndConsider}
                    onfinalize={handleDndFinalize}>
                    {#each poll.pollAnswers as ans, i (ans._id)}
                        <div animate:flip={{ duration: flipDurationMs }}>
                            <Row gap="sm" overflow="visible">
                                <ExpandingTextArea
                                    placeholder={interpolate(
                                        $_,
                                        i18nKey("poll.app.answerPlaceholder"),
                                    )}
                                    maxlength={MAX_ANSWER_LENGTH}
                                    countdown
                                    bind:value={poll.pollAnswers[i].value}
                                    oninput={addAnswer}
                                    onfocus={inputFocused}
                                    onblur={() => checkInputIfEmpty(i)} />
                                <div
                                    use:dragHandle
                                    aria-label="drag-handle for answer {i}"
                                    class="handle">
                                    <UnfoldMoreHorizontal
                                        size="1.5rem"
                                        color={ColourVars.textSecondary} />
                                </div>
                            </Row>
                        </div>
                    {/each}
                </div>
            </Column>
        </Column>
    </Column>

    <div class="opts_sheet" class:hidden={keyboard.visible || preemptiveHideOptions}>
        <AnchoredSheet bind:this={anchoredSheet}>
            {#snippet collapsedContent()}
                <Row
                    gap="xl"
                    mainAxisAlignment="spaceBetween"
                    crossAxisAlignment={"center"}
                    padding={["sm", "lg", "xl"]}>
                    <Row
                        gap="sm"
                        width="fill"
                        crossAxisAlignment="center"
                        onClick={() => anchoredSheet.expand()}>
                        <Column width="fill">
                            <Row width="hug" gap="xs" crossAxisAlignment="end">
                                <Body fontWeight="bold" colour="primary">
                                    <Translatable
                                        resourceKey={i18nKey("poll.app.additionalSettings")} />
                                </Body>
                                <Column padding={["zero", "zero", "xxs"]} width="hug">
                                    <Cog size="1rem" color={ColourVars.primary} />
                                </Column>
                            </Row>
                            <BodySmall colour="textSecondary" maxLines={3}>
                                <Translatable resourceKey={i18nKey(shortStatus.visibility)} /> •
                                <Translatable resourceKey={i18nKey(shortStatus.voteType)} /> •
                                <Translatable resourceKey={i18nKey(shortStatus.voteEdit)} />
                                {#if shortStatus.viewResults}
                                    • <Translatable
                                        resourceKey={i18nKey(shortStatus.viewResults)} />
                                {/if}
                            </BodySmall>
                        </Column>
                    </Row>
                    <CommonButton2
                        disabled={!valid}
                        onClick={start}
                        variant="primary"
                        mode="regular">
                        {#snippet icon(color, size)}
                            <Chart {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("poll.app.publish")} />
                    </CommonButton2>
                </Row>
            {/snippet}
            {#snippet expandedContent()}
                <Column gap="xxl" padding={["xl", "xl", "huge"]}>
                    <Setting
                        toggle={() => (poll.anonymous = !poll.anonymous)}
                        info={"poll.app.settings.publicSwitchInfo"}>
                        <Switch
                            onChange={() => (poll.anonymous = !poll.anonymous)}
                            width={"fill"}
                            reverse
                            checked={!poll.anonymous}>
                            <Translatable
                                resourceKey={i18nKey("poll.app.settings.publicSwitchLabel")} />
                        </Switch>
                    </Setting>

                    <Setting
                        toggle={() =>
                            (poll.allowMultipleVotesPerUser = !poll.allowMultipleVotesPerUser)}
                        info={"poll.app.settings.multipleVotesInfo"}>
                        <Switch
                            onChange={() =>
                                (poll.allowMultipleVotesPerUser = !poll.allowMultipleVotesPerUser)}
                            width={"fill"}
                            reverse
                            checked={poll.allowMultipleVotesPerUser}>
                            <Translatable
                                resourceKey={i18nKey("poll.app.settings.multipleVotesLabel")} />
                        </Switch>
                    </Setting>

                    <Setting
                        toggle={() => (poll.allowUserToChangeVote = !poll.allowUserToChangeVote)}
                        info={"poll.app.settings.changeVoteInfo"}>
                        <Switch
                            onChange={() =>
                                (poll.allowUserToChangeVote = !poll.allowUserToChangeVote)}
                            width={"fill"}
                            reverse
                            checked={!poll.allowUserToChangeVote}>
                            <Translatable
                                resourceKey={i18nKey("poll.app.settings.changeVoteLabel")} />
                        </Switch>
                    </Setting>

                    <Setting
                        toggle={() => (poll.showVotesBeforeEndDate = !poll.showVotesBeforeEndDate)}
                        info={"poll.app.settings.hideVotesInfo"}>
                        <Switch
                            onChange={() =>
                                (poll.showVotesBeforeEndDate = !poll.showVotesBeforeEndDate)}
                            width={"fill"}
                            reverse
                            checked={!poll.showVotesBeforeEndDate}>
                            <Translatable
                                resourceKey={i18nKey("poll.app.settings.hideVotesLabel")} />
                        </Switch>
                    </Setting>

                    <Row mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
                        <CommonButton2
                            onClick={() => anchoredSheet.collapse()}
                            variant="primary"
                            mode="text">
                            {#snippet icon(color, size)}
                                <Check {color} {size} />
                            {/snippet}
                            <Translatable
                                resourceKey={i18nKey("poll.app.settings.closeSettings")} />
                        </CommonButton2>
                    </Row>
                </Column>
            {/snippet}
        </AnchoredSheet>
    </div>
</SlidingPageContent>

<style lang="scss">
    .handle {
        display: flex;
        flex-direction: column;
        height: 3.5rem;
        justify-content: center;
        padding: var(--sp-xs);
    }

    .dropzone {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--sp-md);
    }

    @keyframes slide-down-and-fade {
        from {
            opacity: 1;
            bottom: 0;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            bottom: 0;
            transform: translateY(100%);
        }
    }

    .opts_sheet.hidden {
        position: absolute;
        bottom: 0;
        opacity: 0;
        transform: translateY(100%);
    }

    :global {
        #dnd-action-dragged-el {
            .dl_expanding_textarea {
                box-shadow: 0 0 0.5rem var(--primary) !important;
            }
        }
    }
</style>
