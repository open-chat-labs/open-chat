<script lang="ts">
    import Alarm from "svelte-material-icons/Alarm.svelte";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import VectorCombine from "svelte-material-icons/VectorCombine.svelte";
    import ShieldLockOpenOutline from "svelte-material-icons/ShieldLockOpenOutline.svelte";
    import { _ } from "svelte-i18n";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import {
        type AccessGate,
        isNeuronGate,
        OpenChat,
        isPaymentGate,
        type CryptocurrencyDetails,
        isBalanceGate,
        type Level,
        type AccessGateConfig,
    } from "openchat-client";
    import { getContext } from "svelte";
    import type { Alignment, Position } from "../../../utils/alignment";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import CredentialGatePopup from "./CredentialGatePopup.svelte";
    import GoldDiamond from "../../icons/GoldDiamond.svelte";
    import BlueDiamond from "../../icons/BlueDiamond.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import AccessGateBuilder from "./AccessGateBuilder.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    export let gateConfig: AccessGateConfig;
    export let position: Position = "top";
    export let align: Alignment = "start";
    export let small = false;
    export let showNoGate = false;
    export let level: Level;
    export let clickable = false;
    export let button = false;

    const client = getContext<OpenChat>("client");

    let showDetail = false;

    $: tokenDetails = client.getTokenDetailsForAccessGate(gateConfig.gate);
    $: params = formatParams(gateConfig.gate, tokenDetails);
    $: defaultColor = button ? "var(--button-txt)" : "var(--icon-txt)";

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

    function onClick(ev: Event) {
        if (clickable) {
            showDetail = true;
            ev.stopPropagation();
            ev.preventDefault();
        }
    }
</script>

{#if showDetail}
    <AccessGateBuilder
        valid={true}
        {level}
        onClose={() => (showDetail = false)}
        {gateConfig}
        editable={false} />
{/if}

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:click={onClick} class="wrapper">
    {#if gateConfig.gate.kind === "no_gate" && showNoGate}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="open">
                <ShieldLockOpenOutline size={$iconSize} color={defaultColor} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.openAccessInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "locked_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="locked"></div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable
                        resourceKey={i18nKey("access.lockedGateInfo", undefined, level, true)} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "composite_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="composite">
                <VectorCombine size={$iconSize} color={defaultColor} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.compositeGate")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "diamond_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="diamond">
                <BlueDiamond />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.diamondGateInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "lifetime_diamond_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="diamond">
                <GoldDiamond />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.lifetimeDiamondGateInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "unique_person_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="unique">
                <AccountCheck size={$iconSize} color={defaultColor} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.uniquePersonInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "credential_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="credential">🔒️</div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <CredentialGatePopup gate={gateConfig.gate} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if gateConfig.gate.kind === "referred_by_member_gate"}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="referred_by_member">
                <AccountPlusOutline size={$iconSize} color={defaultColor} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={i18nKey("access.referredByMemberInfo")} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else if isNeuronGate(gateConfig.gate)}
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
    {:else if isPaymentGate(gateConfig.gate)}
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
    {:else if isBalanceGate(gateConfig.gate)}
        <TooltipWrapper {position} {align}>
            <img slot="target" class="icon" class:small src={tokenDetails?.logo} />
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                "access.minimumBalanceInfo2",
                                tokenDetails
                                    ? {
                                          token: tokenDetails.symbol,
                                          n: client.formatTokens(
                                              gateConfig.gate.minBalance,
                                              tokenDetails?.decimals ?? 8,
                                          ),
                                      }
                                    : undefined,
                            )} />
                    </p>
                    <p class="params">{params}</p>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}

    {#if gateConfig.expiry !== undefined}
        <TooltipWrapper {position} {align}>
            <div slot="target" class="expiry">
                <Alarm size={"0.9em"} color={defaultColor} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    <AccessGateExpiry expiry={gateConfig.expiry} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
</div>

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

    .locked {
        $size: 20px;
        background-repeat: no-repeat;
        width: $size;
        height: $size;
        background-image: url("/assets/locked.svg");
    }

    .wrapper {
        display: flex;
        gap: $sp2;
        align-items: center;
    }

    .expiry {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        background-color: var(--icon-hv);
        border-radius: 50%;
    }
</style>
