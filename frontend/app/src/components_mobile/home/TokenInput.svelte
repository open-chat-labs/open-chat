<script lang="ts">
    import { Caption, ColourVars, Container, InputTextButton } from "component-lib";
    import { cryptoLookup, type OpenChat } from "openchat-client";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        amount?: bigint;
        minAmount?: bigint;
        maxAmount?: bigint | undefined;
        ledger: string;
        valid?: boolean;
        status?: "ok" | "zero" | "too_low" | "too_high";
        subtext?: Snippet;
        error?: boolean;
        fees?: Snippet;
        disabled?: boolean;
        icon?: Snippet;
        converted?: Snippet;
    }

    let {
        amount = $bindable(BigInt(0)),
        minAmount = BigInt(0),
        maxAmount = undefined,
        ledger,
        subtext,
        valid = $bindable(false),
        status = $bindable("zero"),
        error = false,
        fees,
        disabled = false,
        icon,
        converted,
    }: Props = $props();

    valid;

    let inputElement: HTMLInputElement | undefined = $state();

    onMount(() => {
        if (amount > BigInt(0) && inputElement) {
            inputElement.value = client.formatTokens(amount, tokenDecimals, ".", true);
        }
    });

    function onKeyup() {
        trimDecimals();
        const value = inputElement?.value ?? "";
        const inputAmount = Math.round(Number(value) * Math.pow(10, tokenDecimals));
        if (!isNaN(inputAmount)) {
            const [integral, fractional] = value.split(".");
            let units = BigInt(integral) * BigInt(10) ** BigInt(tokenDecimals);

            if (fractional !== undefined) {
                units += BigInt(fractional.padEnd(tokenDecimals, "0"));
            }

            amount = units;
        }
    }

    function max() {
        if (maxAmount !== undefined) {
            amount = maxAmount;
        }
        validate();
    }

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

    function trimDecimals() {
        const value = inputElement?.value ?? "";
        const fractional = value.split(".")[1];
        if (fractional !== undefined) {
            const toTrim = fractional.length - tokenDecimals;
            if (toTrim > 0 && inputElement) {
                inputElement.value = value.substring(0, value.length - toTrim);
            }
        }
    }
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenDecimals = $derived(tokenDetails?.decimals ?? 0);
    $effect(() => {
        // TODO - worry about this
        if (inputElement !== undefined) {
            trimDecimals();
            const validateResult = client.validateTokenInput(inputElement.value, tokenDecimals);
            if (validateResult.amount !== amount) {
                inputElement.value = client.formatTokens(amount, tokenDecimals, ".", true);
            }
            validate();
        }
    });
    $effect(() => {
        // Re-validate whenever minAmount or maxAmount changes
        if (minAmount || maxAmount) {
            validate();
        }
    });
</script>

<Container direction={"vertical"}>
    {#if fees !== undefined}
        <div class="fees">
            {@render fees()}
        </div>
    {/if}
    <Container
        padding={["xs", converted ? "xl" : "xs", "xs", "xl"]}
        crossAxisAlignment={"center"}
        maxHeight={"3rem"}
        background={ColourVars.textTertiary}
        borderRadius={"circle"}>
        <input
            {disabled}
            class="amount-val"
            min={Number(minAmount) / Math.pow(10, tokenDecimals)}
            max={maxAmount !== undefined
                ? Number(maxAmount) / Math.pow(10, tokenDecimals)
                : undefined}
            type="number"
            step="0.00000001"
            bind:this={inputElement}
            onkeyup={onKeyup}
            placeholder="0" />
        {#if maxAmount !== undefined}
            <InputTextButton onClick={max}>
                <Translatable resourceKey={i18nKey("tokenTransfer.max")} />
            </InputTextButton>
        {/if}
        {@render converted?.()}
        {@render icon?.()}
    </Container>

    {#if subtext}
        <div class="subtext">
            <Caption colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </Caption>
        </div>
    {/if}
</Container>

<style lang="scss">
    .subtext {
        padding-inline-start: var(--sp-xl);
        padding-inline-end: var(--sp-xl);
    }

    .usd,
    .min {
        @include font(light, normal, fs-60);
        color: var(--txt-light);
        flex: 1;
        text-align: right;
    }

    .amount-val {
        width: 100%;
        display: block;
        text-align: start;
        height: 3rem;

        @include input();
        color: var(--text-secondary);
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);
        padding: 0;

        &::placeholder {
            color: var(--placeholder);
        }
    }

    .fees {
        position: absolute;
        right: toRem(20);
        top: toRem(28);
    }

    /* Chrome, Safari, Edge, Opera */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>
