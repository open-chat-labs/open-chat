<script lang="ts">
    import { afterUpdate, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import CredentialSelector from "./CredentialSelector.svelte";
    import {
        getGateBindings,
        getNeuronGateBindings,
        type GateBinding,
        getPaymentGateBindings,
        getBalanceGateBindings,
    } from "../../../utils/access";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import Select from "../../Select.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Legend from "../../Legend.svelte";
    import Input from "../../Input.svelte";
    import { fade } from "svelte/transition";
    import {
        type CandidateGroupChat,
        type CommunitySummary,
        type InterpolationValues,
        type OpenChat,
        type NeuronGate,
        isNeuronGate,
        isPaymentGate,
        type AccessGate,
        type CryptocurrencyDetails,
        type PaymentGate,
        isBalanceGate,
        type TokenBalanceGate,
    } from "openchat-client";
    import Markdown from "../Markdown.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    export let candidate: CandidateGroupChat | CommunitySummary;
    export let original: CandidateGroupChat | CommunitySummary;
    export let valid: boolean;

    let gateBindings: GateBinding[] = getGateBindings();
    let neuronGateBindings: GateBinding[] = [];
    let paymentGateBindings: GateBinding[] = [];
    let balanceGateBindings: GateBinding[] = [];
    let selectedGateKey: string | undefined = undefined;
    let selectedNeuronGateKey: string | undefined = undefined;
    let selectedPaymentGateKey: string | undefined = undefined;
    let selectedBalanceGateKey: string | undefined = undefined;
    let minDissolveDelay = client.getMinDissolveDelayDays(original.gate) ?? "";
    let minStake = client.getMinStakeInTokens(original.gate) ?? "";
    let amountText = initialPaymentAmount(original.gate);
    let minBalanceText = initialMinBalance(original.gate);
    let credentialIssuerValid = true;

    $: candidateTokenDetails = client.getTokenDetailsForAccessGate(candidate.gate);
    // The minimum payment is 100x the transfer fee for the given token
    $: minPayment = (candidateTokenDetails?.transferFee ?? BigInt(0)) * BigInt(100);
    $: amount = amountFromText(amountText, candidateTokenDetails);
    $: minBalance = amountFromText(minBalanceText, candidateTokenDetails);
    $: invalidAmount = amount === undefined || amount < minPayment;
    $: invalidMinBalance = minBalance === undefined || minBalance < minPayment;
    $: invalidDissolveDelay = minDissolveDelay !== "" && isNaN(Number(minDissolveDelay));
    $: invalidMinStake = minStake !== "" && isNaN(Number(minStake));
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: cryptoLookup = client.cryptoLookup;

    $: {
        valid =
            !(
                selectedGateKey === "neuron_gate_folder" &&
                (invalidDissolveDelay || invalidMinStake)
            ) &&
            !(selectedGateKey === "payment_gate_folder" && invalidAmount) &&
            !(selectedGateKey === "balance_gate_folder" && invalidMinBalance) &&
            credentialIssuerValid;
    }

    onMount(() => {
        neuronGateBindings = getNeuronGateBindings($nervousSystemLookup);
        const nsLedgers = new Set(
            Object.values($nervousSystemLookup).map((d) => d.ledgerCanisterId),
        );
        paymentGateBindings = getPaymentGateBindings($cryptoLookup, nsLedgers);
        balanceGateBindings = getBalanceGateBindings($cryptoLookup);

        selectedGateKey = gateBindings.find((g) => {
            switch (candidate.gate.kind) {
                case "neuron_gate":
                    return "neuron_gate_folder" === g.key;
                case "payment_gate":
                    return "payment_gate_folder" === g.key;
                case "token_balance_gate":
                    return "balance_gate_folder" === g.key;
                default:
                    return candidate.gate.kind === g.gate.kind;
            }
        })?.key;

        switch (candidate.gate.kind) {
            case "neuron_gate":
                selectedNeuronGateKey = candidate.gate.governanceCanister;
                break;
            case "payment_gate":
                selectedPaymentGateKey = candidate.gate.ledgerCanister;
                break;
            case "token_balance_gate":
                selectedBalanceGateKey = candidate.gate.ledgerCanister;
                break;
        }
    });

    afterUpdate(() => {
        if (isNeuronGate(candidate.gate)) {
            candidate = {
                ...candidate,
                gate: {
                    ...candidate.gate,
                    minDissolveDelay:
                        minDissolveDelay !== "" && !invalidDissolveDelay
                            ? Number(minDissolveDelay) * 24 * 60 * 60 * 1000
                            : undefined,
                    minStakeE8s:
                        minStake !== "" && !invalidMinStake
                            ? Number(minStake) * Math.pow(10, candidateTokenDetails?.decimals ?? 8)
                            : undefined,
                },
            };
        } else if (isPaymentGate(candidate.gate) && amount !== undefined) {
            candidate = {
                ...candidate,
                gate: {
                    ...candidate.gate,
                    amount,
                },
            };
        } else if (isBalanceGate(candidate.gate) && minBalance !== undefined) {
            candidate = {
                ...candidate,
                gate: {
                    ...candidate.gate,
                    minBalance,
                },
            };
        }
    });

    function initialPaymentAmount(gate: AccessGate): string {
        if (isPaymentGate(gate)) {
            const token = client.tryGetCryptocurrency(gate.ledgerCanister);
            if (token !== undefined) {
                return client.formatTokens(gate.amount, token.decimals);
            }
        }

        return "";
    }

    function initialMinBalance(gate: AccessGate): string {
        if (isBalanceGate(gate)) {
            const token = client.tryGetCryptocurrency(gate.ledgerCanister);
            if (token !== undefined) {
                return client.formatTokens(gate.minBalance, token.decimals);
            }
        }

        return "";
    }

    function amountFromText(
        amountText: string,
        tokenDetails: CryptocurrencyDetails | undefined,
    ): bigint | undefined {
        if (tokenDetails === undefined) {
            return undefined;
        }

        const amount = Number(amountText);
        if (isNaN(amount)) {
            return undefined;
        }

        return BigInt((amount * 10 ** tokenDetails.decimals).toFixed(0));
    }

    function updateGate() {
        let selectedGate = undefined;

        if (selectedGateKey === "neuron_gate_folder") {
            selectedGate = neuronGateBindings.find((g) => g.key === selectedNeuronGateKey);
        } else if (selectedGateKey === "payment_gate_folder") {
            selectedGate = paymentGateBindings.find((g) => g.key === selectedPaymentGateKey);
        } else if (selectedGateKey === "balance_gate_folder") {
            selectedGate = balanceGateBindings.find((g) => g.key === selectedBalanceGateKey);
        } else {
            selectedGate = gateBindings.find((g) => g.key === selectedGateKey);
        }

        candidate.gate = (selectedGate?.gate as AccessGate) ?? { kind: "no_gate" };
        minDissolveDelay = "";
        minStake = "";
    }

    function tokenParams(gate: NeuronGate | PaymentGate | TokenBalanceGate): InterpolationValues {
        const tokenDetails = client.getTokenDetailsForAccessGate(gate);
        return tokenDetails ? { token: tokenDetails.symbol } : undefined;
    }

    function buildPaymentInfoMessage(candidate: CandidateGroupChat | CommunitySummary): string {
        if (isPaymentGate(candidate.gate)) {
            const sentences = [
                $_("access.tokenPaymentInfo", { values: tokenParams(candidate.gate) }),
                interpolate(
                    $_,
                    i18nKey(
                        "access.paymentDistributionMessage",
                        undefined,
                        candidate.id.kind === "group_chat" ? "group" : "community",
                        true,
                    ),
                ),
                $_("access.subscriptionComingSoon"),
            ];

            return sentences.join(" ");
        }

        return "";
    }
</script>

<div transition:fade|local={{ duration: 250 }} class="wrapper">
    <div class="icon">
        <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
    <div class="section">
        <div class="section-title">{$_("access.chooseGate")}</div>
        <div class="choose-gate">
            <Select margin={false} on:change={updateGate} bind:value={selectedGateKey}>
                {#each gateBindings as gate}
                    <option disabled={!gate.enabled} value={gate.key}
                        ><Translatable resourceKey={i18nKey(gate.label)} /></option>
                {/each}
            </Select>
        </div>
        {#if selectedGateKey === "neuron_gate_folder"}
            <Legend label={i18nKey("access.chooseNervousSystem")} />
            <div class="choose-gate">
                <Select margin={false} on:change={updateGate} bind:value={selectedNeuronGateKey}>
                    {#each neuronGateBindings as g}
                        <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                    {/each}
                </Select>
            </div>

            <Legend label={i18nKey("access.minDissolveDelay")} />
            <Input
                maxlength={100}
                placeholder={i18nKey("access.optional")}
                invalid={invalidDissolveDelay}
                bind:value={minDissolveDelay} />

            <Legend label={i18nKey("access.minStake")} />
            <Input
                maxlength={100}
                placeholder={i18nKey("access.optional")}
                invalid={invalidMinStake}
                bind:value={minStake} />
        {:else if selectedGateKey === "payment_gate_folder"}
            <Legend label={i18nKey("access.chooseToken")} />
            <div class="choose-gate">
                <Select margin={false} on:change={updateGate} bind:value={selectedPaymentGateKey}>
                    {#each paymentGateBindings as g}
                        <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                    {/each}
                </Select>
            </div>

            <Legend label={i18nKey("access.amount")} required />
            <Input maxlength={100} invalid={invalidAmount} bind:value={amountText} />
        {:else if selectedGateKey === "balance_gate_folder"}
            <Legend label={i18nKey("access.chooseToken")} />
            <div class="choose-gate">
                <Select margin={false} on:change={updateGate} bind:value={selectedBalanceGateKey}>
                    {#each balanceGateBindings as g}
                        <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                    {/each}
                </Select>
            </div>

            <Legend label={i18nKey("access.minimumBalance")} required />
            <Input maxlength={100} invalid={invalidMinBalance} bind:value={minBalanceText} />
        {:else if candidate.gate.kind === "diamond_gate"}
            <div class="info"><Translatable resourceKey={i18nKey("access.diamondGateInfo")} /></div>
        {:else if candidate.gate.kind === "lifetime_diamond_gate"}
            <div class="info">
                <Translatable resourceKey={i18nKey("access.lifetimeDiamondGateInfo")} />
            </div>
        {:else if candidate.gate.kind === "unique_person_gate"}
            <div class="info">
                <Translatable resourceKey={i18nKey("access.uniquePersonInfo")} />
            </div>
        {:else if isNeuronGate(candidate.gate)}
            <div class="info">
                <Translatable
                    resourceKey={i18nKey("access.neuronHolderInfo", tokenParams(candidate.gate))} />
            </div>
        {:else if isPaymentGate(candidate.gate)}
            <div class="info">
                <Markdown text={buildPaymentInfoMessage(candidate)} />
            </div>
        {:else if isBalanceGate(candidate.gate)}
            <div class="info">
                <Translatable resourceKey={i18nKey("access.minimumBalanceInfo")} />
            </div>
        {:else if candidate.gate.kind === "no_gate"}
            <div class="info"><Translatable resourceKey={i18nKey("access.openAccessInfo")} /></div>
        {/if}
        {#if candidate.gate.kind === "credential_gate"}
            <CredentialSelector
                editable
                bind:valid={credentialIssuerValid}
                bind:gate={candidate.gate} />
        {/if}
    </div>
</div>

<style lang="scss">
    .wrapper {
        display: flex;
        align-items: flex-start;
        max-width: 85%;

        .icon {
            flex: 0 0 toRem(34);
        }

        .section-title {
            margin-bottom: $sp3;
        }

        .section {
            flex: auto;
        }

        @include mobile() {
            max-width: unset;
        }
    }

    .section {
        margin-bottom: $sp6;
    }

    .choose-gate {
        margin-bottom: $sp3;
    }

    .info {
        @include font(book, normal, fs-80, 22);
        color: var(--txt-light);
    }

    .section-title {
        display: flex;
        gap: $sp3;
        align-items: center;
    }
</style>
