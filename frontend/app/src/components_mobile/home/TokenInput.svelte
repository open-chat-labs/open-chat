<script lang="ts">
    import { Caption, Chip, Container, NumberInput, Row } from "component-lib";
    import { enhancedCryptoLookup as cryptoLookup, type OpenChat } from "openchat-client";
    import { getContext, untrack, type Snippet } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        balance?: bigint;
        amount?: bigint;
        minAmount?: bigint;
        maxAmount?: bigint | undefined;
        ledger: string;
        valid?: boolean;
        status?: "ok" | "zero" | "too_low" | "too_high";
        subtext?: Snippet;
        error?: boolean;
        disabled?: boolean;
        icon?: Snippet;
        converted?: Snippet;
    }

    let {
        balance,
        amount = $bindable(BigInt(0)),
        minAmount = BigInt(0),
        maxAmount = undefined,
        ledger,
        subtext,
        valid = $bindable(false),
        status = $bindable("zero"),
        error = false,
        // converted,
        icon,
        disabled = false,
    }: Props = $props();

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenDecimals = $derived(tokenDetails?.decimals ?? 0);
    let displayValue = $state(toDisplayValue(amount));

    $effect(() => {
        const validateResult = client.validateTokenInput(displayValue, tokenDecimals);
        // Avoid unnecessary updates!
        if (validateResult.amount !== amount) {
            amount = validateResult.amount;
        }

        validate();
    });

    // Re-validate whenever minAmount, maxAmount, or balance changes
    // TODO shouldn't maxAmount and balance be the same ??
    $effect(() => {
        if (minAmount || maxAmount || balance) {
            validate();
        }
    });

    function validate() {
        untrack(() => {
            if (amount === BigInt(0)) {
                status = "zero";
            } else if (amount < minAmount) {
                status = "too_low";
            } else if (maxAmount !== undefined && amount > maxAmount) {
                status = "too_high";
            } else {
                status = "ok";
            }
            valid = status === "ok";
        });
    }

    function setAmountPct(percentage: number) {
        const pctValue = BigInt(Math.floor(Number(balance) * (percentage / 100)));
        const pctValueWithFee = pctValue + tokenDetails.transferFee;

        // Update display value, this will run $effect which will set the amount!
        // We either set an actual percentage value if the value with fee is less
        // than balance, or we reduce the pct for the fee amount.
        displayValue = toDisplayValue(
            balance && pctValueWithFee <= balance ? pctValue : pctValue - tokenDetails.transferFee,
        );

        validate();
    }

    function toDisplayValue(val: bigint): string {
        if (val <= BigInt(0)) return "";
        return (Number(val) / 10 ** tokenDecimals).toString();
    }
</script>

{#snippet percentage(perc: number)}
    <Chip fill mode={"rounded"} onClick={() => setAmountPct(perc)}>
        {`${perc}%`}
    </Chip>
{/snippet}

<!-- TODO i18n -->
<Container direction="vertical" width="fill" gap="sm">
    <NumberInput
        bind:value={displayValue}
        {disabled}
        {icon}
        {subtext}
        error={error && amount > 0}
        unitText={tokenDetails.symbol}
        placeholder={"Withdrawal amount"}
        maxDecimals={tokenDecimals}
        min={Number(minAmount) / Math.pow(10, tokenDecimals)}
        max={maxAmount !== undefined
            ? Number(maxAmount) / Math.pow(10, tokenDecimals)
            : undefined} />

    {#if balance}
        <Container direction="vertical" padding={["zero", "sm"]}>
            <Row mainAxisAlignment={"spaceBetween"} gap={"sm"}>
                {@render percentage(25)}
                {@render percentage(50)}
                {@render percentage(75)}
                {@render percentage(100)}
            </Row>
            <Row padding={["zero", "sm"]} gap="md">
                <Caption colour="textSecondary">
                    <Translatable
                        resourceKey={i18nKey(
                            "Use the options above to select a specific percentage of your total token amount you would like to swap.",
                        )} />
                </Caption>
                <!-- TODO converted should be a part of the input? -->
                <!-- {@render converted?.()} -->
            </Row>
        </Container>
    {/if}
</Container>
