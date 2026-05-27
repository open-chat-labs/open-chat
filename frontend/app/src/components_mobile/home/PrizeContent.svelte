<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { disableClaimPrizeFeature } from "@src/utils/features";

    import type { TextContent as TextContentType } from "openchat-client";
    import {
        Body,
        BodySmall,
        ChatCaption,
        Column,
        ColourVars,
        defaultBackgroundGradient,
        Row,
        Sheet,
        Subtitle,
    } from "component-lib";
    import {
        AuthProvider,
        chitBands,
        chitStateStore,
        cryptoLookup,
        currentUserStore,
        enhancedCryptoLookup,
        isDiamondStore,
        isLifetimeDiamondStore,
        type ChatIdentifier,
        type DiamondMembershipStatus,
        type OpenChat,
        type PrizeContent,
        type PrizeContentInitial,
    } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { Confetti } from "svelte-confetti";
    import { _ } from "svelte-i18n";
    import Clock from "svelte-material-icons/ClockOutline.svelte";
    import Fingerprint from "svelte-material-icons/Fingerprint.svelte";
    import Gift from "svelte-material-icons/GiftOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { claimsStore } from "../../stores/claims";
    import { rtlStore } from "../../stores/rtl";
    import { now500 } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import Diamond from "../icons/Diamond.svelte";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import Verified from "../icons/Verified.svelte";
    import SecureButton from "../SecureButton.svelte";
    import Translatable from "../Translatable.svelte";
    import Badges from "./profile/Badges.svelte";
    import ChitEarnedBadge from "./profile/ChitEarnedBadge.svelte";
    import ReAuthenticateModal from "./profile/ReAuthenticateModal.svelte";
    import Streak from "./profile/Streak.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import { TokenState } from "./wallet/walletState.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import TextContent from "./TextContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: PrizeContent | PrizeContentInitial;
        me: boolean;
        intersecting?: boolean;
        chatId?: ChatIdentifier;
        messageId?: bigint;
        title?: Snippet;
        draft?: boolean;
        reply?: boolean;
        edited?: boolean;
        isPreview?: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
    }

    let {
        content,
        me,
        intersecting = false,
        chatId,
        messageId,
        title,
        draft = false,
        reply = false,
        edited = false,
        isPreview = false,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let progressWidth = $state(0);
    let showRestrictionDetails = $state(false);
    let mouseEvent = $state<MouseEvent>();
    let normalisedTextContent = $derived.by<TextContentType | undefined>(() => {
        if (content.caption && content.caption.length > 0) {
            return {
                kind: "text_content",
                text: content.caption,
            };
        }
    });
    let hasTextContent = $derived(normalisedTextContent !== undefined);

    async function claim(
        e: MouseEvent,
        auth: { key: ECDSAKeyIdentity; delegation: DelegationChain } | undefined,
    ) {
        if (!chatId || !messageId) return;

        let signInProof: string | undefined = undefined;
        if (content.requiresCaptcha) {
            if (auth) {
                signInProof = await client.getSignInProof(auth.key, auth.delegation);
            } else {
                mouseEvent = e;
                showAuthentication = true;
                return;
            }
        }

        showAuthentication = false;
        if (e.isTrusted && chatId.kind !== "direct_chat" && !me && userEligible) {
            claimsStore.add(messageId);
            client
                .claimPrize(chatId, messageId, e, signInProof)
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("prizes.claimFailed"));
                    }
                })
                .finally(() => claimsStore.delete(messageId));
        }
    }

    let logo = $derived(
        [...$cryptoLookup.values()].find((t) =>
            content.kind === "prize_content"
                ? t.symbol.toLowerCase() === content.token.toLowerCase()
                : false,
        )?.logo ?? "",
    );
    let total = $derived(
        content.kind === "prize_content"
            ? content.prizesRemaining + content.prizesPending + content.winnerCount
            : 0,
    );
    let percentage = $derived(
        content.kind === "prize_content" ? (content.winnerCount / total) * 100 : 0,
    );
    let claimedByYou = $derived(content.kind === "prize_content" ? content.userIsWinner : false);
    let finished = $derived($now500 >= Number(content.endDate));
    let allClaimed = $derived(
        content.kind === "prize_content" ? content.prizesRemaining <= 0 : false,
    );
    let userEligible = $derived(
        (!content.diamondOnly || $isDiamondStore) &&
            (!content.lifetimeDiamondOnly || $isLifetimeDiamondStore) &&
            (!content.uniquePersonOnly || $currentUserStore.isUniquePerson) &&
            content.streakOnly <= $chitStateStore.streak &&
            content.minChitEarned <= $chitStateStore.totalChitEarned,
    );
    let disabled = $derived(finished || claimedByYou || allClaimed || !userEligible);
    let timeRemaining = $derived(
        finished
            ? $_("prizes.finished")
            : client.formatTimeRemaining($now500, Number(content.endDate)),
    );
    let diamondStatus = $derived(
        (content.lifetimeDiamondOnly
            ? "lifetime"
            : content.diamondOnly
              ? "active"
              : "inactive") as DiamondMembershipStatus["kind"],
    );
    let restrictedPrize = $derived(
        content.diamondOnly ||
            content.lifetimeDiamondOnly ||
            content.uniquePersonOnly ||
            content.streakOnly > 0 ||
            content.requiresCaptcha ||
            content.minChitEarned > 0,
    );
    let showAuthentication = $state(false);
    let spin = $derived(intersecting && !finished && !allClaimed);

    let initialTokenState = $derived(
        content.kind === "prize_content_initial"
            ? new TokenState($enhancedCryptoLookup.get(content.transfer.ledger)!)
            : undefined,
    );

    function reauthenticated(detail: {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
    }) {
        if (mouseEvent !== undefined) {
            claim(mouseEvent, detail);
        }
    }
</script>

{#snippet replyView(textContent?: Snippet)}
    {#if content.kind === "prize_content"}
        <Row gap="sm" minWidth="12rem">
            <Column width="fill" gap="xxs" padding={["xxs", "zero"]}>
                {@render title?.()}
                {#if textContent}
                    {@render textContent()}
                {:else}
                    <Row gap="xs" crossAxisAlignment="center">
                        <Gift
                            color={me ? ColourVars.secondaryLight : ColourVars.primaryLight}
                            size="1.15rem" />
                        <ChatCaption colour={me ? "secondaryLight" : "primaryLight"}>
                            <Translatable resourceKey={i18nKey("Prize")} />
                        </ChatCaption>
                    </Row>
                {/if}
            </Column>
        </Row>
    {/if}
{/snippet}

{#snippet draftView()}
    {#if content.kind === "prize_content_initial" && initialTokenState}
        <Column padding="xxs">
            <Column
                padding={["xs", "sm"]}
                borderRadius={["xl", "xl", "md", "md"]}
                backgroundColor={ColourVars.background0}>
                <Row padding="sm" width="fill" gap="sm" crossAxisAlignment="center">
                    <Gift size="1rem" color={ColourVars.primary} />
                    <Body width="hug" fontWeight="semi-bold">
                        <Translatable
                            resourceKey={i18nKey(
                                `${initialTokenState.formatTokens(content.amount)} ${initialTokenState.symbol}`,
                            )} />
                    </Body>
                    <Body width="fill" colour="primary">
                        <!-- TODO i18n -->
                        <Translatable resourceKey={i18nKey("prize draw")} />
                    </Body>
                </Row>
                <Row
                    width="fill"
                    height={{ size: "0.25rem" }}
                    background={ColourVars.background1}
                    borderRadius="circle">.</Row>
                <Row padding="sm">
                    <TransferFeesMessage
                        symbol={initialTokenState.symbol}
                        tokenDecimals={initialTokenState.decimals}
                        transferFees={content.fees} />
                </Row>
            </Column>
        </Column>
    {/if}
{/snippet}

<!-- TODO allow prize message to be edited - to update their text caption -->
{#snippet regularView()}
    {#if content.kind === "prize_content"}
        {#if showAuthentication}
            <ReAuthenticateModal
                onCancel={() => (showAuthentication = false)}
                onSuccess={reauthenticated}
                title={i18nKey("prizes.authRequiredTitle")}
                message={i18nKey("prizes.authRequiredMessage")} />
        {/if}
        <Column
            gap="xxs"
            minWidth="62vw"
            padding={["zero", "zero", hasTextContent ? "zero" : "xl"]}>
            <!-- Spinning Token & Countdown -->
            <Column>
                <Column
                    padding="xl"
                    mainAxisAlignment="center"
                    crossAxisAlignment="center"
                    background={defaultBackgroundGradient}
                    borderRadius={[me ? "lg" : "md", !me ? "lg" : "md", "zero", "zero"]}>
                    <div class="prize-coin">
                        <SpinningToken {logo} {spin} mirror={true} size="small" />
                    </div>
                </Column>
                <Column
                    gap="xs"
                    padding="md"
                    crossAxisAlignment="center"
                    backgroundColor={me ? ColourVars.primaryMuted : ColourVars.background1}>
                    <!-- Time remaining -->
                    <Row gap="xs" mainAxisAlignment="center" crossAxisAlignment="center">
                        {#if allClaimed}
                            <BodySmall width="hug" fontWeight="semi-bold">
                                <Translatable resourceKey={i18nKey("prizes.allClaimed")} />
                            </BodySmall>
                        {:else if finished}
                            <BodySmall width="hug" fontWeight="semi-bold">
                                <Translatable resourceKey={i18nKey("prizes.finished")} />
                            </BodySmall>
                        {:else}
                            <Clock size="1em" color={ColourVars.textPrimary} />
                            <BodySmall width={{ size: "4.75rem" }} fontWeight="semi-bold">
                                {timeRemaining}
                            </BodySmall>
                        {/if}
                    </Row>

                    <!-- Badges -->
                    {#if restrictedPrize}
                        <Row
                            mainAxisAlignment="center"
                            onClick={() => (showRestrictionDetails = true)}>
                            <!-- If chit features are turned off minChitEarned is zero, and chit badge cannot be rendered. -->
                            <!-- Streak badge can still be forced to show, since that prize constriction is returned. -->
                            <Badges
                                size="large"
                                forceStreakBadge
                                withFingerprint={content.requiresCaptcha}
                                {diamondStatus}
                                uniquePerson={content.uniquePersonOnly}
                                chitEarned={content.minChitEarned}
                                streak={content.streakOnly}
                                borderColor={me
                                    ? ColourVars.primaryMuted
                                    : ColourVars.background1} />
                        </Row>
                    {/if}
                </Column>
            </Column>

            <!-- Claimed, Confetti & Button -->
            <Column
                gap="md"
                padding={["sm", me ? "sm" : "xs", me ? "lg" : "xs"]}
                borderRadius={["zero", "zero", "lg", "lg"]}
                backgroundColor={me ? ColourVars.primaryMuted : ColourVars.background1}>
                <Column gap="xxs">
                    <!-- Claimed count -->
                    <Row mainAxisAlignment="center">
                        <BodySmall width="hug">
                            {content.winnerCount}/{total}
                            <Translatable resourceKey={i18nKey("claimed")} />
                        </BodySmall>
                    </Row>

                    <!-- Claimed Progress -->
                    <Row padding={["zero", "sm"]}>
                        <div class="progress" class:me bind:clientWidth={progressWidth}>
                            <div
                                class="claimed"
                                class:rtl={$rtlStore}
                                style="background-size: {progressWidth}px 100%; width: {percentage}%">
                            </div>
                        </div>
                    </Row>
                </Column>

                {#if !me && !disableClaimPrizeFeature && messageId}
                    <SecureButton
                        width="fill"
                        label={"Prize message clicked"}
                        loading={$claimsStore.has(messageId)}
                        onClick={(e) => claim(e, undefined)}
                        {disabled}>
                        <Body>
                            <Translatable
                                resourceKey={i18nKey(
                                    claimedByYou
                                        ? "prizes.claimed"
                                        : finished
                                          ? "prizes.finished"
                                          : allClaimed
                                            ? "prizes.allClaimed"
                                            : "prizes.claim",
                                )} />
                        </Body>
                    </SecureButton>
                {/if}
            </Column>
        </Column>
        {#if claimedByYou}
            <div class="tada">
                <div class="confetti">
                    <Confetti size={30} colorArray={[`url(${logo})`]} />
                </div>
            </div>
        {/if}
        {#if normalisedTextContent}
            <TextContent {me} content={normalisedTextContent} />
        {/if}
    {/if}
{/snippet}

<MessageRenderer
    {replyView}
    {draftView}
    {regularView}
    caption={content.caption}
    {me}
    {reply}
    {draft}
    {edited}
    {blockLevelMarkdown}
    {isPreview}
    {onRemove} />

{#snippet restrictionsBanner(key: string)}
    <Column padding="md" borderRadius="md" backgroundColor={ColourVars.secondaryMuted}>
        <BodySmall>
            <Translatable resourceKey={i18nKey(key)} />
        </BodySmall>
    </Column>
{/snippet}

{#if showRestrictionDetails}
    <Sheet onDismiss={() => (showRestrictionDetails = false)}>
        <!-- Prize participation gates -->
        <Column
            gap="md"
            borderRadius="md"
            padding={["md", "xl", "xxl"]}
            backgroundColor={ColourVars.background1}>
            {#if restrictedPrize}
                <Column>
                    <Subtitle fontWeight="semi-bold">
                        <Translatable resourceKey={i18nKey("prizes.restrictions")} />
                    </Subtitle>
                    <Body colour="textSecondary">
                        <Translatable resourceKey={i18nKey("prizes.restrictedMessage")} />
                    </Body>
                </Column>

                <Column gap="sm" padding={["zero", "xs", "md"]}>
                    {#if content.requiresCaptcha}
                        <Row gap="md">
                            <Column
                                borderRadius="circle"
                                width={{ size: "1.375rem" }}
                                height={{ size: "1.375rem" }}
                                mainAxisAlignment="center"
                                crossAxisAlignment="center"
                                backgroundColor={ColourVars.background2}>
                                <Fingerprint
                                    viewBox={"0 -1 24 24"}
                                    size={"1rem"}
                                    color={"var(--text-primary)"} />
                            </Column>
                            <Body>
                                <Translatable
                                    resourceKey={i18nKey("prizes.authRequiredLabel", {
                                        n: content.streakOnly,
                                    })} />
                            </Body>
                        </Row>
                    {/if}
                    {#if content.diamondOnly || content.lifetimeDiamondOnly}
                        <Row gap="md">
                            <Diamond
                                borderColor={ColourVars.background1}
                                size={"default"}
                                status={content.lifetimeDiamondOnly ? "lifetime" : "active"} />

                            <Body>
                                <Translatable
                                    resourceKey={i18nKey(
                                        "prizes." +
                                            (content.lifetimeDiamondOnly
                                                ? "lifetimeDiamondMembership"
                                                : "diamondMembership"),
                                    )} />
                            </Body>
                        </Row>
                    {/if}
                    {#if content.uniquePersonOnly}
                        <Row gap="md">
                            <Verified
                                borderColor={ColourVars.background1}
                                verified={content.uniquePersonOnly}
                                tooltip={i18nKey("prizes.uniquePerson")} />

                            <Body>
                                <Translatable resourceKey={i18nKey("prizes.uniquePerson")} />
                            </Body>
                        </Row>
                    {/if}
                    {#if content.streakOnly > 0}
                        <Row gap="md">
                            <Streak
                                borderColor={ColourVars.background1}
                                days={content.streakOnly} />
                            <Body>
                                <Translatable
                                    resourceKey={i18nKey("prizes.streakFull", {
                                        n: content.streakOnly,
                                    })} />
                            </Body>
                        </Row>
                    {/if}

                    {#if content.minChitEarned > 0}
                        <Row gap="md">
                            <ChitEarnedBadge
                                borderColor={ColourVars.background1}
                                earned={content.minChitEarned} />

                            <Body>
                                <Translatable
                                    resourceKey={i18nKey("prizes.minChitEarnedValue", {
                                        n: chitBands.get(content.minChitEarned) ?? "0",
                                    })} />
                            </Body>
                        </Row>
                    {/if}
                </Column>
            {/if}
            {#if me}
                {#if allClaimed || finished}
                    {@render restrictionsBanner("prizes.prizeFinished")}
                {:else}
                    {@render restrictionsBanner("prizes.live")}
                {/if}
            {/if}
        </Column>
    </Sheet>
{/if}

<style lang="scss">
    .progress {
        height: 0.35rem;
        width: 100%;
        overflow: hidden;
        position: relative;
        border-radius: var(--rad-lg);

        &:not(.me) {
            background: var(--background-0);
        }

        &.me {
            background: var(--backdrop);
        }

        .claimed {
            $red: rgba(234, 41, 41, 1);
            $orange: rgba(244, 118, 4, 1);
            $green: rgba(74, 233, 122, 1);
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background-image: linear-gradient(90deg, $green 0%, $orange 50%, $red 100%);
            &.rtl {
                left: unset;
                right: 0;
                background-image: linear-gradient(90deg, $red 0%, $orange 50%, $green 100%);
            }
        }
    }

    .tada {
        position: relative;

        .confetti {
            position: absolute;
            pointer-events: none;
            top: 50%;
            left: 50%;
        }
    }
</style>
