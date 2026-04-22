<script lang="ts">
    import { getContext } from "svelte";
    import { Body, BodySmall, Column, Row, Subtitle, UserChip } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        publish,
        type OpenChat,
        type PollContent,
        type ReducedPublicProfile,
    } from "openchat-client";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";
    import { voteCount, getVotersForAnswer, percentageOfVote } from "@utils/polls";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: PollContent;
        senderId: string;
        onClose: () => void;
    }

    let { content, senderId }: Props = $props();
    let haveIVoted = $derived(content.votes.user.length > 0);
    let showVotes = $derived(
        content.ended ||
            ((haveIVoted || senderId === $currentUserIdStore) &&
                (content.config.showVotesBeforeEndDate || content.config.endDate === undefined)),
    );
    let answerCount = $derived(content.config.options.length);
    let voteCounts = $derived(getAnsRange().map((i) => voteCount(content, i)));
    let voteProfiles = $derived(getAnsRange().map(getVoterUsernamesForAnswer));

    function back() {
        publish("closeModalPage");
    }

    function getAnsRange() {
        return [...Array(answerCount).keys()];
    }

    function getVoterUsernamesForAnswer(idx: number): ReducedPublicProfile[] {
        const voters = getVotersForAnswer(content, idx);
        if (voters === undefined || voters.length === 0 || !showVotes) return [];
        return client.buildReducedProfileDataList(new Set(voters), undefined, $allUsersStore, 20);
    }

    function dataToBlobUrl(data: Uint8Array, type?: string): string {
        const options = type ? { type } : undefined;
        const blob = new Blob([data.slice().buffer], options);
        return URL.createObjectURL(blob);
    }
</script>

<SlidingPageContent onBack={back} title={i18nKey(`poll.app.viewPollVotesTitle`)}>
    <Column padding="xl" gap="xxl">
        <Row>
            <Subtitle colour="primaryLight" fontWeight="bold">{content.config?.text}</Subtitle>
        </Row>
        {#each [...content.config.options] as answer, i (answer)}
            {@const pct = percentageOfVote(content, i)}
            {@const pctSingleDec = Math.round(pct * 10) / 10}

            <Column gap="lg">
                <Column gap="sm">
                    <!-- Question and vote pct -->
                    <Column>
                        <Row gap="xs" crossAxisAlignment="end">
                            <Body width="fill">{answer}</Body>
                        </Row>
                        <Row>
                            <BodySmall width="fill" colour="textSecondary">
                                <Translatable
                                    resourceKey={i18nKey("poll.totalVotes", {
                                        total: voteCounts[i].toString(),
                                    })} />
                            </BodySmall>
                            {#if showVotes}
                                <Row width="hug" gap="md">
                                    <BodySmall width="hug" colour="textSecondary">
                                        {`${pctSingleDec}%`}
                                    </BodySmall>
                                </Row>
                            {/if}
                        </Row>
                    </Column>

                    <!-- Separator and pct bar -->
                    <div class="separator">
                        {#if showVotes}
                            <div class="pct" style:width={`${pct}%`}></div>
                        {/if}
                    </div>
                </Column>

                <!-- Vote count and usernames -->
                <Column gap="sm">
                    <Row gap="sm" wrap crossAxisAlignment="center">
                        {#each voteProfiles[i] as profile}
                            <UserChip
                                avatarSize="sm"
                                avatarUrl={profile.blobData
                                    ? dataToBlobUrl(profile.blobData)
                                    : profile.blobUrl}>
                                <Body>{profile.displayName ?? profile.username}</Body>
                            </UserChip>
                        {/each}
                        {#if voteProfiles[i].length < voteCounts[i]}
                            <BodySmall colour="textSecondary">
                                <!-- TODO make this clickable, open sheet with full paginated list of users who voted for this option -->
                                +{10 - voteProfiles[i].length}
                                <Translatable resourceKey={i18nKey("poll.app.plusMoreVotes")} />
                            </BodySmall>
                        {/if}
                    </Row>
                </Column>
            </Column>
        {/each}
    </Column>
</SlidingPageContent>

<style lang="scss">
    .separator,
    .pct {
        width: 100%;
        height: 0.25rem;
        border-radius: var(--rad-lg);
    }

    .separator {
        background-color: var(--background-2);
    }

    .pct {
        height: 0.25rem;
        background-color: var(--primary-light);
    }
</style>
