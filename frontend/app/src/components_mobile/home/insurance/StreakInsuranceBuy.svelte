<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        type ColourVarKeys,
        ColourVars,
        Column,
        CommonButton,
        Container,
        H2,
        Row,
        Subtitle,
    } from "component-lib";
    import {
        LEDGER_CANISTER_CHAT,
        OpenChat,
        enhancedCryptoLookup,
        publish,
        streakInsuranceStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import QrCode from "svelte-material-icons/QrCode.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import StreakHeadline from "../user_profile/StreakHeadline.svelte";
    import { TokenState } from "../wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        onClose: () => void;
    }

    const MAX_DAYS = 30;
    const ledger = LEDGER_CANISTER_CHAT;
    const token = $derived($enhancedCryptoLookup.get(ledger));
    const tokenState = $derived(new TokenState(token!));
    const currentDaysInsured = $streakInsuranceStore.daysInsured;
    const currentDaysMissed = $streakInsuranceStore.daysMissed;
    let { onClose }: Props = $props();
    let additionalDays = $state(0);
    let insufficientBalance = $derived(tokenState.remainingBalance < 0);
    let paying = $state(false);
    let remaining = $derived(currentDaysInsured + additionalDays - currentDaysMissed);
    let totalDays = $derived(currentDaysInsured + additionalDays);
    let maxReached = $derived(totalDays >= MAX_DAYS);

    $effect(() => {
        tokenState.draftAmount = client.streakInsurancePrice(currentDaysInsured, additionalDays);
    });

    function pay() {
        paying = true;
        client
            .payForStreakInsurance(additionalDays, tokenState.draftAmount)
            .then((resp) => {
                if (resp.kind !== "success") {
                    toastStore.showFailureToast(i18nKey("streakInsurance.failure"));
                } else {
                    onClose();
                }
            })
            .finally(() => (paying = false));
    }
</script>

{#snippet metric(word: string, subtext: string, accent: ColourVarKeys, val: number)}
    <Row
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        borderRadius={"md"}
        minHeight={"4rem"}
        gap={"md"}
        background={ColourVars.background2}
        padding={["md", "lg"]}>
        <Column width={"fill"}>
            <Subtitle fontWeight={"bold"}>
                <MulticolourText
                    parts={[
                        { text: i18nKey("Days "), colour: "textPrimary" },
                        { text: i18nKey(word), colour: accent },
                    ]} />
            </Subtitle>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey(subtext)} />
            </BodySmall>
        </Column>
        <H2 colour={accent} width={"hug"} fontWeight={"bold"}>{val}</H2>
    </Row>
{/snippet}

{#snippet tokenBalance()}
    <Row gap={"sm"}>
        <Row
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            minHeight={"4rem"}
            gap={"md"}
            background={ColourVars.background2}
            padding={["md", "lg"]}>
            <Avatar url={tokenState.logo} />
            <Column width={"fill"}>
                <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}
                    >{tokenState.symbol}</Body>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {tokenState.formattedTokenBalance}
                </Caption>
            </Column>
        </Row>
        {#if insufficientBalance}
            <Column
                onClick={() => publish("receiveToken", tokenState)}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                width={{ size: "4rem" }}
                height={"fill"}
                borderRadius={"lg"}
                background={ColourVars.background2}
                padding={["sm", "md"]}>
                <QrCode size={"2rem"} color={ColourVars.textSecondary} />
            </Column>
        {/if}
    </Row>
{/snippet}

<SlidingPageContent
    title={i18nKey("Streak insurance")}
    subtitle={i18nKey("Make sure your streak stays intact")}>
    <Container height={"fill"} padding={["xl", "xl", "huge"]} gap={"xl"} direction={"vertical"}>
        <StreakHeadline />

        <Body>
            <MulticolourText
                parts={[
                    {
                        text: i18nKey("Use our "),
                        colour: "textSecondary",
                    },
                    {
                        text: i18nKey("streak insurance "),
                        colour: "primary",
                    },
                    {
                        text: i18nKey(
                            "feature to prevent your streak from reseting to zero if you miss a day or two for any reason.",
                        ),
                        colour: "textSecondary",
                    },
                ]} />
        </Body>

        {@render tokenBalance()}

        <Column gap={"sm"}>
            {@render metric(
                "insured",
                "Number of streak days you've insured",
                "primary",
                totalDays,
            )}
            {@render metric(
                "missed",
                "Number of used streak insurance days",
                "secondary",
                currentDaysMissed,
            )}
            {@render metric("remaining", "Remaining insured streak days", "warning", remaining)}
        </Column>

        <Row crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
            <CommonButton
                mode={"active"}
                size={"small_text"}
                disabled={paying || maxReached}
                onClick={() => (additionalDays += 1)}>
                {#snippet icon(color)}
                    <Plus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("streakInsurance.addDay")}></Translatable>
            </CommonButton>
            <CommonButton
                mode={"active"}
                size={"medium"}
                loading={paying}
                disabled={paying || additionalDays === 0 || insufficientBalance}
                onClick={pay}>
                {#snippet icon(color, size)}
                    <Wallet {color} {size} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("streakInsurance.pay", {
                        price: tokenState.formatTokens(tokenState.draftAmount),
                    })}></Translatable>
            </CommonButton>
        </Row>
    </Container>
</SlidingPageContent>
