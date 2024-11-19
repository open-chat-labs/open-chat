<script lang="ts">
    import {
        isBalanceGate,
        isNeuronGate,
        isPaymentGate,
        type AccessGate,
        type CryptocurrencyDetails,
        type NeuronGate,
        type OpenChat,
        type PaymentGate,
        type TokenBalanceGate,
        type InterpolationValues,
        type Level,
    } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Select from "../../Select.svelte";
    import {
        balanceGateFolder,
        neuronGateFolder,
        paymentGateFolder,
        type GateBinding,
    } from "../../../utils/access";
    import { getContext, onMount } from "svelte";
    import Legend from "../../Legend.svelte";
    import Input from "../../Input.svelte";
    import CredentialSelector from "./CredentialSelector.svelte";
    import Markdown from "../Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: AccessGate;
        editable: boolean;
        level: Level;
        allowNone: boolean;
        valid: boolean;
        neuronGateBindings: GateBinding[];
        paymentGateBindings: GateBinding[];
        balanceGateBindings: GateBinding[];
        gateBindings: GateBinding[];
    }

    let {
        gate = $bindable(),
        editable,
        level,
        allowNone,
        valid = $bindable(),
        neuronGateBindings,
        paymentGateBindings,
        balanceGateBindings,
        gateBindings,
    }: Props = $props();

    let selectedGateKey: string | undefined = $state(undefined);
    let selectedNeuronGateKey: string | undefined = $state(undefined);
    let selectedPaymentGateKey: string | undefined = $state(undefined);
    let selectedBalanceGateKey: string | undefined = $state(undefined);
    let minDissolveDelay = $state(client.getMinDissolveDelayDays(gate) ?? "");
    let minStake = $state(client.getMinStakeInTokens(gate) ?? "");
    let minBalanceText = $state(initialMinBalance(gate));
    let amountText = $state(initialPaymentAmount(gate));
    let credentialIssuerValid = $state(true);

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

    function tokenParams(gate: NeuronGate | PaymentGate | TokenBalanceGate): InterpolationValues {
        const tokenDetails = client.getTokenDetailsForAccessGate(gate);
        return tokenDetails ? { token: tokenDetails.symbol } : undefined;
    }

    function amountFromText(
        amountText: string,
        tokenDetails: CryptocurrencyDetails | undefined,
    ): bigint | undefined {
        if (tokenDetails === undefined) {
            return undefined;
        }
        const { amount } = client.validateTokenInput(amountText, tokenDetails.decimals);
        return amount;
    }

    function buildPaymentInfoMessage(gate: AccessGate): string {
        if (isPaymentGate(gate)) {
            const sentences = [
                $_("access.tokenPaymentInfo", { values: tokenParams(gate) }),
                interpolate(
                    $_,
                    i18nKey("access.paymentDistributionMessage", undefined, level, true),
                ),
                $_("access.subscriptionComingSoon"),
            ];
            return sentences.join(" ");
        }
        return "";
    }

    function updateGate() {
        let selectedGate = undefined;

        if (selectedGateKey === "neuron_gate_folder") {
            selectedGate = neuronGateBindings.find((g) => g.key === selectedNeuronGateKey);
            if (selectedGate === undefined) {
                selectedGate = neuronGateFolder;
            }
        } else if (selectedGateKey === "payment_gate_folder") {
            selectedGate = paymentGateBindings.find((g) => g.key === selectedPaymentGateKey);
            if (selectedGate === undefined) {
                selectedGate = paymentGateFolder;
            }
        } else if (selectedGateKey === "balance_gate_folder") {
            selectedGate = balanceGateBindings.find((g) => g.key === selectedBalanceGateKey);
            if (selectedGate === undefined) {
                selectedGate = balanceGateFolder;
            }
        } else {
            selectedGate = gateBindings.find((g) => g.key === selectedGateKey);
        }

        gate = selectedGate?.gate ?? { kind: "no_gate" };
        minDissolveDelay = "";
        minStake = "";
    }

    onMount(() => {
        selectedGateKey = gateBindings.find((g) => {
            switch (gate.kind) {
                case "neuron_gate":
                    return "neuron_gate_folder" === g.key;
                case "payment_gate":
                    return "payment_gate_folder" === g.key;
                case "token_balance_gate":
                    return "balance_gate_folder" === g.key;
                default:
                    return gate.kind === g.gate.kind;
            }
        })?.key;

        switch (gate.kind) {
            case "neuron_gate":
                selectedNeuronGateKey = gate.governanceCanister;
                break;
            case "payment_gate":
                selectedPaymentGateKey = gate.ledgerCanister;
                break;
            case "token_balance_gate":
                selectedBalanceGateKey = gate.ledgerCanister;
                break;
        }
    });

    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(gate));
    let amount = $derived(amountFromText(amountText, candidateTokenDetails));
    let minPayment = $derived((candidateTokenDetails?.transferFee ?? BigInt(0)) * BigInt(100));
    let invalidAmount = $derived(amount === undefined || amount < minPayment);
    let minBalance = $derived(amountFromText(minBalanceText, candidateTokenDetails));
    let invalidMinBalance = $derived(minBalance === undefined || minBalance < minPayment);
    let invalidDissolveDelay = $derived(minDissolveDelay !== "" && isNaN(Number(minDissolveDelay)));
    let invalidMinStake = $derived(minStake !== "" && isNaN(Number(minStake)));
    let isValid = $derived.by(() => {
        return (
            !(!allowNone && selectedGateKey === "no_gate") &&
            !(
                selectedGateKey === "neuron_gate_folder" &&
                (invalidDissolveDelay || invalidMinStake)
            ) &&
            !(selectedGateKey === "payment_gate_folder" && invalidAmount) &&
            !(selectedGateKey === "balance_gate_folder" && invalidMinBalance) &&
            credentialIssuerValid
        );
    });

    $effect(() => {
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    $effect(() => {
        if (isNeuronGate(gate)) {
            const delay =
                minDissolveDelay !== "" && !invalidDissolveDelay
                    ? Number(minDissolveDelay) * 24 * 60 * 60 * 1000
                    : undefined;
            const stake =
                minStake !== "" && !invalidMinStake
                    ? Number(minStake) * Math.pow(10, candidateTokenDetails?.decimals ?? 8)
                    : undefined;

            if (delay !== gate.minDissolveDelay || stake !== gate.minStakeE8s) {
                gate = {
                    ...gate,
                    minDissolveDelay: delay,
                    minStakeE8s: stake,
                };
            }
        } else if (isPaymentGate(gate) && amount !== undefined && amount !== gate.amount) {
            gate = {
                ...gate,
                amount,
            };
        } else if (
            isBalanceGate(gate) &&
            minBalance !== undefined &&
            minBalance !== gate.minBalance
        ) {
            gate = {
                ...gate,
                minBalance,
            };
        }
    });
</script>

<section class="section">
    {#if editable}
        <div class="section-title">
            <Translatable resourceKey={i18nKey("access.chooseGate")} />
        </div>
        <div class="choose-gate">
            <Select
                invalid={!allowNone && selectedGateKey === "no_gate"}
                disabled={!editable}
                margin={false}
                onchange={updateGate}
                bind:value={selectedGateKey}>
                {#each gateBindings as gate}
                    <option disabled={!gate.enabled} value={gate.key}
                        ><Translatable resourceKey={i18nKey(gate.label)} /></option>
                {/each}
            </Select>
        </div>
    {/if}
    {#if selectedGateKey === "neuron_gate_folder"}
        <Legend label={i18nKey("access.chooseNervousSystem")} />
        <div class="choose-gate">
            <Select
                disabled={!editable}
                margin={false}
                onchange={updateGate}
                bind:value={selectedNeuronGateKey}>
                {#each neuronGateBindings as g}
                    <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                {/each}
            </Select>
        </div>

        <Legend label={i18nKey("access.minDissolveDelay")} />
        <Input
            disabled={!editable}
            maxlength={100}
            placeholder={i18nKey("access.optional")}
            invalid={invalidDissolveDelay}
            bind:value={minDissolveDelay} />

        <Legend label={i18nKey("access.minStake")} />
        <Input
            disabled={!editable}
            maxlength={100}
            placeholder={i18nKey("access.optional")}
            invalid={invalidMinStake}
            bind:value={minStake} />
    {:else if selectedGateKey === "payment_gate_folder"}
        <Legend label={i18nKey("access.chooseToken")} />
        <div class="choose-gate">
            <Select
                disabled={!editable}
                margin={false}
                onchange={updateGate}
                bind:value={selectedPaymentGateKey}>
                {#each paymentGateBindings as g}
                    <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                {/each}
            </Select>
        </div>

        <Legend label={i18nKey("access.amount")} required={editable} />
        <Input
            disabled={!editable}
            maxlength={100}
            invalid={invalidAmount}
            bind:value={amountText} />
    {:else if selectedGateKey === "balance_gate_folder"}
        <Legend label={i18nKey("access.chooseToken")} />
        <div class="choose-gate">
            <Select
                disabled={!editable}
                margin={false}
                onchange={updateGate}
                bind:value={selectedBalanceGateKey}>
                {#each balanceGateBindings as g}
                    <option disabled={!g.enabled} value={g.key}>{g.label}</option>
                {/each}
            </Select>
        </div>

        <Legend label={i18nKey("access.minimumBalance")} required={editable} />
        <Input
            disabled={!editable}
            maxlength={100}
            invalid={invalidMinBalance}
            bind:value={minBalanceText} />
    {:else if gate.kind === "diamond_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.diamondGateInfo")} />
        </div>
    {:else if gate.kind === "lifetime_diamond_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.lifetimeDiamondGateInfo")} />
        </div>
    {:else if gate.kind === "unique_person_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.uniquePersonInfo")} />
        </div>
    {:else if isNeuronGate(gate)}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.neuronHolderInfo", tokenParams(gate))} />
        </div>
    {:else if isPaymentGate(gate)}
        <div class="info">
            <Markdown text={buildPaymentInfoMessage(gate)} />
        </div>
    {:else if isBalanceGate(gate)}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.minimumBalanceInfo")} />
        </div>
    {:else if gate.kind === "referred_by_member_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.referredByMemberInfo")} />
        </div>
    {:else if gate.kind === "no_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.openAccessInfo")} />
        </div>
    {:else if gate.kind === "locked_gate"}
        <div class="info">
            <Translatable resourceKey={i18nKey("access.lockedGateInfo", undefined, level, true)} />
        </div>
    {:else if gate.kind === "credential_gate"}
        <CredentialSelector {editable} bind:valid={credentialIssuerValid} bind:gate />
    {/if}
</section>

<style lang="scss">
    .section-title {
        margin-bottom: $sp3;
    }

    .section {
        flex: auto;
    }

    .choose-gate {
        margin-bottom: $sp3;
    }

    .info {
        @include font(book, normal, fs-90, 22);
        color: var(--txt-light);
    }

    .section-title {
        display: flex;
        gap: $sp3;
        align-items: center;
    }
</style>
