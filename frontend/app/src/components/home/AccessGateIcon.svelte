<script lang="ts">
    import { _ } from "svelte-i18n";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import {
        type AccessGate,
        isNeuronGate,
        OpenChat,
        isPaymentGate,
        type CryptocurrencyDetails,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Alignment, Position } from "../../utils/alignment";
    import Diamond from "../icons/Diamond.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import CredentialGatePopup from "./CredentialGatePopup.svelte";

    export let gate: AccessGate;
    export let position: Position = "top";
    export let align: Alignment = "start";
    export let small = false;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: tokenDetails = client.getTokenDetailsForAccessGate(gate);
    $: params = formatParams(gate, tokenDetails);

    function formatParams(
        gate: AccessGate,
        tokenDetails: CryptocurrencyDetails | undefined,
    ): string {
        const parts = [];
        if (isNeuronGate(gate)) {
            if (gate.minDissolveDelay) {
                parts.push(
                    `${$_("access.minDissolveDelayN", {
                        values: { n: gate.minDissolveDelay / (24 * 60 * 60 * 1000) },
                    })}`,
                );
            }
            if (gate.minStakeE8s) {
                parts.push(
                    `${$_("access.minStakeN", {
                        values: {
                            n: client.formatTokens(
                                BigInt(gate.minStakeE8s),
                                tokenDetails?.decimals ?? 8,
                            ),
                        },
                    })}`,
                );
            }
        } else if (isPaymentGate(gate)) {
            parts.push(
                `${$_("access.amountN", {
                    values: { n: client.formatTokens(gate.amount, tokenDetails?.decimals ?? 8) },
                })}`,
            );
        }
        return parts.length > 0 ? ` (${parts.join(", ")})` : "";
    }
</script>

{#if gate.kind !== "no_gate"}
    {#if gate.kind === "diamond_gate"}
        <TooltipWrapper {position} {align}>
            <div on:click={() => dispatch("upgrade")} slot="target" class="diamond">
                <Diamond />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.diamondGateInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gate.kind === "credential_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="credential">🔒️</div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <CredentialGatePopup {gate} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if isNeuronGate(gate)}
        <TooltipWrapper {position} {align}>
            <img slot="target" class="icon" class:small src={tokenDetails?.logo} />
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                "access.neuronHolderInfo",
                                tokenDetails ? { token: tokenDetails.symbol } : undefined,
                            )} />
                    </p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if isPaymentGate(gate)}
        <TooltipWrapper {position} {align}>
            <img slot="target" class="icon" class:small src={tokenDetails?.logo} />
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                "access.tokenPaymentInfo",
                                tokenDetails ? { token: tokenDetails.symbol } : undefined,
                            )} />
                    </p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
{/if}

<style lang="scss">
    $size: 32px;
    .icon {
        height: $size;
        width: $size;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
        background-size: contain;
        position: relative;

        &.small {
            height: 26px;
            width: 26px;
        }
    }
    .diamond,
    .credential {
        cursor: pointer;
        @include font-size(fs-130);
    }

    .params {
        margin-top: $sp3;
    }
</style>
