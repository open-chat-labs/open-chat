<script lang="ts">
    import ShieldHalfFull from "svelte-material-icons/ShieldHalfFull.svelte";
    import Equal from "svelte-material-icons/Equal.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import {
        LEDGER_CANISTER_CHAT,
        OpenChat,
        cryptoBalance,
        cryptoLookup,
        streakInsuranceStore,
    } from "openchat-client";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { getContext } from "svelte";
    import ButtonGroup from "@src/components/ButtonGroup.svelte";
    import Button from "@src/components/Button.svelte";
    import { toastStore } from "@src/stores/toast";

    const client = getContext<OpenChat>("client");
    interface Props {
        onClose: () => void;
    }

    const MAX_DAYS = 30;
    const ledger = LEDGER_CANISTER_CHAT;
    let { onClose }: Props = $props();
    let tokenDetails = $derived({
        symbol: $cryptoLookup[ledger],
        balance: $cryptoBalance[ledger] ?? BigInt(0),
    });
    let additionalDays = $state(0);
    let confirming = $state(false);
    let confirmed = $state(false);
    let refreshingBalance = $state(false);
    let priceE8s = $derived(
        client.streakInsurancePrice($streakInsuranceStore.daysInsured, additionalDays),
    );
    let price = $derived(priceE8s / 100_000_000n);
    let remainingBalance = $derived(tokenDetails.balance - priceE8s);
    let insufficientBalance = $derived(remainingBalance < 0);
    let paying = $state(false);
    let remaining = $derived(
        $streakInsuranceStore.daysInsured + additionalDays - $streakInsuranceStore.daysMissed,
    );
    let totalDays = $derived($streakInsuranceStore.daysInsured + additionalDays);
    let maxReached = $derived(totalDays >= MAX_DAYS);

    function pay() {
        paying = true;
        client
            .payForStreakInsurance(additionalDays, priceE8s)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast(i18nKey("streakInsurance.failure"));
                } else {
                    onClose();
                }
            })
            .finally(() => (paying = false));
    }
</script>

<Overlay {onClose}>
    <ModalContent fill {onClose}>
        {#snippet header()}
            <div class="header">
                {#if !confirming && !confirmed}
                    <div class="title">
                        <ShieldHalfFull size={"1em"} />
                        <Translatable resourceKey={i18nKey("streakInsurance.topUpTitle")} />
                    </div>
                    <div class="balance">
                        <BalanceWithRefresh
                            {ledger}
                            value={remainingBalance}
                            bind:refreshing={refreshingBalance} />
                    </div>
                {/if}
            </div>
        {/snippet}
        {#snippet body()}
            <div class="details">
                <div class="column">
                    <div class="label">
                        <Translatable resourceKey={i18nKey("streakInsurance.bought")}
                        ></Translatable>
                    </div>
                    <div class="number">
                        {totalDays}
                    </div>
                </div>

                <div class="column operator">
                    <Minus color={"var(--txt-light)"} />
                </div>

                <div class="column">
                    <div class="label">
                        <Translatable resourceKey={i18nKey("streakInsurance.missed")}
                        ></Translatable>
                    </div>
                    <div class="number">
                        {$streakInsuranceStore.daysMissed}
                    </div>
                </div>

                <div class="column operator">
                    <Equal color={"var(--txt-light)"} />
                </div>

                <div class="column">
                    <div class="label">
                        <Translatable resourceKey={i18nKey("streakInsurance.remaining")}
                        ></Translatable>
                    </div>
                    <div class="number">
                        {remaining}
                    </div>
                </div>
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup nowrap>
                <Button disabled={paying} small secondary onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")}></Translatable>
                </Button>
                <Button disabled={paying || maxReached} small onClick={() => (additionalDays += 1)}>
                    <Translatable resourceKey={i18nKey("streakInsurance.addDay")}></Translatable>
                </Button>
                <Button
                    loading={paying}
                    disabled={paying || additionalDays === 0 || insufficientBalance}
                    small
                    onClick={pay}>
                    <Translatable
                        resourceKey={i18nKey("streakInsurance.pay", {
                            price: price.toLocaleString(),
                        })}></Translatable>
                </Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .title {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .details {
        display: flex;
        gap: $sp3;
        padding: $sp5;
        justify-content: space-evenly;
        max-width: toRem(500);
        margin: 0 auto;
        min-width: 75%;

        .column {
            text-align: center;
            align-self: center;

            .label {
                text-transform: uppercase;
                @include font(light, normal, fs-80);
                color: var(--txt-light);
            }

            .number {
                @include font(bold, normal, fs-240);
                color: var(--error);
            }
        }

        .operator {
            margin-top: $sp6;
            @include font(light, normal, fs-200);
            color: var(--txt-light);
        }
    }
</style>
