<script lang="ts">
    import {
        Body,
        Column,
        CommonButton,
        Input,
        InputIconButton,
        Row,
        StatusCard,
        Switch,
        transition,
    } from "component-lib";
    import {
        ONE_DAY,
        OpenChat,
        publish,
        type MessageContext,
        type PollContent,
        type TotalPollVotes,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Chart from "svelte-material-icons/ChartBoxOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Setting from "../Setting.svelte";
    import Translatable from "../Translatable.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    type Step = "definition" | "settings";

    const MAX_QUESTION_LENGTH = 250;
    const MAX_ANSWER_LENGTH = 50;
    const MAX_ANSWERS = 10;

    type CandidatePoll = {
        pollQuestion: string;
        anonymous: boolean;
        showVotesBeforeEndDate: boolean;
        allowMultipleVotesPerUser: boolean;
        allowUserToChangeVote: boolean;
        pollAnswers: string[];
        duration: bigint;
    };

    interface Props {
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { messageContext, onClose }: Props = $props();

    let step = $state<Step>("definition");
    let poll: CandidatePoll = $state(emptyPoll());

    let emptyAnswers = $derived(
        poll.pollAnswers.reduce((n, a) => {
            if (a.length === 0) {
                return n + 1;
            }
            return n;
        }, 0),
    );
    let enoughAnswers = $derived(poll.pollAnswers.length >= 2);
    let uniqueAnswers = $derived.by(() => {
        const a = poll.pollAnswers.map((a) => a.toUpperCase());
        return a.length === new Set(a).size;
    });
    let validQuestion = $derived(poll.pollQuestion.length > 0);
    let validAnswers = $derived(enoughAnswers && uniqueAnswers && emptyAnswers === 0);
    let valid = $derived(validQuestion && validAnswers);

    export function resetPoll() {
        poll = emptyPoll();
    }

    function emptyPoll() {
        return {
            pollQuestion: "Which is the best chat app?",
            anonymous: true,
            showVotesBeforeEndDate: true,
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: true,
            pollAnswers: ["OpenChat", "Nah - it's OpenChat"],
            duration: BigInt(ONE_DAY),
        };
    }

    function setStep(s: Step) {
        transition(["fade"], () => {
            step = s;
        });
    }

    function addAnswer() {
        transition(["fade"], () => {
            poll.pollAnswers.push("");
        });
    }

    function deleteAnswer(idx: number) {
        transition(["fade"], () => {
            poll.pollAnswers = poll.pollAnswers.reduce((all, a, i) => {
                if (i !== idx) {
                    all.push(a);
                }
                return all;
            }, [] as string[]);
        });
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
                options: [...poll.pollAnswers.values()],
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
        if (step === "definition") {
            publish("closeModalPage");
        } else {
            setStep("definition");
        }
    }
</script>

<SlidingPageContent
    onBack={back}
    title={i18nKey(`Create a poll ${step === "definition" ? 1 : 2} / 2`)}
    subtitle={i18nKey("Duration, question and answers")}>
    <Column height={"fill"} gap={"xxl"} padding={["lg", "xxl"]}>
        {#if step === "definition"}
            <Column gap={"md"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Poll question")} />
                </Body>
                <Input
                    bind:value={poll.pollQuestion}
                    autofocus
                    minlength={1}
                    maxlength={MAX_QUESTION_LENGTH}
                    countdown
                    placeholder={interpolate($_, i18nKey("Enter your question here"))}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("What do you want to ask in this poll?")} />
                    {/snippet}
                </Input>
            </Column>

            <Column gap={"md"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Poll answers (min 2)")} />
                </Body>
                {#each poll.pollAnswers as _, i}
                    {#snippet iconButtons(color: string)}
                        <InputIconButton onClick={() => deleteAnswer(i)}>
                            <Close {color} />
                        </InputIconButton>
                    {/snippet}

                    <Input
                        iconButtons={i >= 2 ? iconButtons : undefined}
                        maxlength={MAX_ANSWER_LENGTH}
                        minlength={1}
                        placeholder={"Provide a unique answer"}
                        bind:value={poll.pollAnswers[i]}>
                    </Input>
                {/each}
            </Column>

            {#if !valid}
                <StatusCard
                    mode={"warning"}
                    title={"Poll is not currently valid"}
                    body={"Please make sure that you have a question and at least two answers. Each answer must be different."}>
                </StatusCard>
            {/if}

            <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <CommonButton
                    disabled={poll.pollAnswers.length >= MAX_ANSWERS}
                    onClick={() => addAnswer()}
                    mode={"active"}
                    size={"small_text"}>
                    {#snippet icon(color, size)}
                        <Plus {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Add answer")} />
                </CommonButton>
                <CommonButton
                    disabled={!valid}
                    onClick={() => setStep("settings")}
                    mode={"active"}
                    size={"medium"}>
                    {#snippet icon(color, size)}
                        <ArrowRight {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("To settings")} />
                </CommonButton>
            </Row>
        {:else if step === "settings"}
            <Setting
                toggle={() => (poll.anonymous = !poll.anonymous)}
                info={"Polls are anonymous by default. If you make it public, everyone will be able to ssee each others votes."}>
                <Switch
                    onChange={() => (poll.anonymous = !poll.anonymous)}
                    width={"fill"}
                    reverse
                    checked={!poll.anonymous}>
                    <Translatable resourceKey={i18nKey("Public poll")} />
                </Switch>
            </Setting>

            <DurationSelector bind:duration={poll.duration}>
                {#snippet title()}
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Poll duration")} />
                    </Body>
                {/snippet}
            </DurationSelector>

            <Setting
                toggle={() => (poll.allowMultipleVotesPerUser = !poll.allowMultipleVotesPerUser)}
                info={"Users can only vote for a single option by default, but if you would like to allow users to vote for multiple options, toggle this on."}>
                <Switch
                    onChange={() =>
                        (poll.allowMultipleVotesPerUser = !poll.allowMultipleVotesPerUser)}
                    width={"fill"}
                    reverse
                    checked={poll.allowMultipleVotesPerUser}>
                    <Translatable resourceKey={i18nKey("Allow multiple votes")} />
                </Switch>
            </Setting>

            <Setting
                toggle={() => (poll.allowUserToChangeVote = !poll.allowUserToChangeVote)}
                info={"With this option on, once they vote, users will not be able to change their opinion."}>
                <Switch
                    onChange={() => (poll.allowUserToChangeVote = !poll.allowUserToChangeVote)}
                    width={"fill"}
                    reverse
                    checked={!poll.allowUserToChangeVote}>
                    <Translatable resourceKey={i18nKey("Users cannot change their votes")} />
                </Switch>
            </Setting>

            <Setting
                toggle={() => (poll.showVotesBeforeEndDate = !poll.showVotesBeforeEndDate)}
                info={"If you don't want the poll participants to see the results before the poll ends, turn this option on."}>
                <Switch
                    onChange={() => (poll.showVotesBeforeEndDate = !poll.showVotesBeforeEndDate)}
                    width={"fill"}
                    reverse
                    checked={!poll.showVotesBeforeEndDate}>
                    <Translatable resourceKey={i18nKey("Hide votes before end of the poll")} />
                </Switch>
            </Setting>

            <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                <CommonButton onClick={back} mode={"active"} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("back")} />
                </CommonButton>
                <CommonButton disabled={!valid} onClick={start} mode={"active"} size={"medium"}>
                    {#snippet icon(color, size)}
                        <Chart {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Publish poll")} />
                </CommonButton>
            </Row>
        {/if}
    </Column>
</SlidingPageContent>
