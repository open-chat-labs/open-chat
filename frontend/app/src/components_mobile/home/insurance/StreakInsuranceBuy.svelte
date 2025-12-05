<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Button, ColourVars, Container, Label, Overview, Sheet } from "component-lib";
    import {
        LEDGER_CANISTER_CHAT,
        OpenChat,
        cryptoBalanceStore,
        cryptoLookup,
        streakInsuranceStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import CreditCard from "svelte-material-icons/CreditCardOutline.svelte";
    import Equal from "svelte-material-icons/Equal.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import ShieldHalfFull from "svelte-material-icons/ShieldHalfFull.svelte";
    import ShieldPlusOutline from "svelte-material-icons/ShieldPlusOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        onClose: () => void;
    }

    const MAX_DAYS = 30;
    const ledger = LEDGER_CANISTER_CHAT;
    const currentDaysInsured = $streakInsuranceStore.daysInsured;
    const currentDaysMissed = $streakInsuranceStore.daysMissed;
    let { onClose }: Props = $props();
    let tokenDetails = $derived({
        symbol: $cryptoLookup.get(ledger),
        balance: $cryptoBalanceStore.get(ledger) ?? 0n,
    });
    let additionalDays = $state(0);
    let confirming = $state(false);
    let confirmed = $state(false);
    let refreshingBalance = $state(false);
    let priceE8s = $derived(client.streakInsurancePrice(currentDaysInsured, additionalDays));
    let price = $derived(priceE8s / 100_000_000n);
    let remainingBalance = $derived(tokenDetails.balance - priceE8s);
    let insufficientBalance = $derived(remainingBalance < 0);
    let paying = $state(false);
    let remaining = $derived(currentDaysInsured + additionalDays - currentDaysMissed);
    let totalDays = $derived(currentDaysInsured + additionalDays);
    let maxReached = $derived(totalDays >= MAX_DAYS);

    function pay() {
        paying = true;
        client
            .payForStreakInsurance(additionalDays, priceE8s)
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

<Sheet onDismiss={onClose}>
    <Container padding={"xl"} gap={"lg"} direction={"vertical"}>
        {#if !confirming && !confirmed}
            <Container crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
                <Container width={"fill"} crossAxisAlignment={"center"} gap={"sm"}>
                    <ShieldHalfFull size={"1em"} />
                    <Translatable resourceKey={i18nKey("streakInsurance.topUpTitle")} />
                </Container>

                <BalanceWithRefresh
                    {ledger}
                    value={remainingBalance}
                    bind:refreshing={refreshingBalance} />
            </Container>
        {/if}
        <Container
            padding={"lg"}
            gap={"md"}
            mainAxisAlignment={"spaceAround"}
            crossAxisAlignment={"end"}>
            <Container crossAxisAlignment={"center"} direction={"vertical"}>
                <Label align={"center"} width={"hug"} colour={"textSecondary"} uppercase>
                    <Translatable resourceKey={i18nKey("streakInsurance.bought")}></Translatable>
                </Label>
                <Overview align={"center"} width={"hug"} colour={"primary"} fontWeight={"bold"}>
                    {totalDays}
                </Overview>
            </Container>

            <Container
                padding={["zero", "md"]}
                width={"hug"}
                height={"fill"}
                crossAxisAlignment={"center"}>
                <Minus color={ColourVars.textSecondary} />
            </Container>

            <Container crossAxisAlignment={"center"} direction={"vertical"}>
                <Label align={"center"} width={"hug"} colour={"textSecondary"} uppercase>
                    <Translatable resourceKey={i18nKey("streakInsurance.missed")}></Translatable>
                </Label>
                <Overview align={"center"} width={"hug"} colour={"primary"} fontWeight={"bold"}>
                    {currentDaysMissed}
                </Overview>
            </Container>

            <Container
                width={"hug"}
                padding={["zero", "md"]}
                height={"fill"}
                crossAxisAlignment={"center"}>
                <Equal color={ColourVars.textSecondary} />
            </Container>

            <Container crossAxisAlignment={"center"} direction={"vertical"}>
                <Label align={"center"} width={"hug"} colour={"textSecondary"} uppercase>
                    <Translatable resourceKey={i18nKey("streakInsurance.remaining")}></Translatable>
                </Label>
                <Overview align={"center"} width={"hug"} colour={"primary"} fontWeight={"bold"}>
                    {remaining}
                </Overview>
            </Container>
        </Container>
        <Container
            direction={"vertical"}
            gap={"md"}
            mainAxisAlignment={"end"}
            crossAxisAlignment={"end"}>
            <Button secondary disabled={paying || maxReached} onClick={() => (additionalDays += 1)}>
                {#snippet icon(color)}
                    <ShieldPlusOutline {color}></ShieldPlusOutline>
                {/snippet}
                <Translatable resourceKey={i18nKey("streakInsurance.addDay")}></Translatable>
            </Button>
            <Button
                loading={paying}
                disabled={paying || additionalDays === 0 || insufficientBalance}
                onClick={pay}>
                {#snippet icon(color)}
                    <CreditCard {color}></CreditCard>
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("streakInsurance.pay", {
                        price: price.toLocaleString(),
                    })}></Translatable>
            </Button>
        </Container>
    </Container>
</Sheet>
