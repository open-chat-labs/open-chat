<script lang="ts">
    import type { Alignment, Position } from "component-lib";
    import {
        type AccessGate,
        type AccessGateConfig,
        type CryptocurrencyDetails,
        iconSize,
        isBalanceGate,
        isNeuronGate,
        isPaymentGate,
        type Level,
        OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import Alarm from "svelte-material-icons/Alarm.svelte";
    import ShieldLockOpenOutline from "svelte-material-icons/ShieldLockOpenOutline.svelte";
    import VectorCombine from "svelte-material-icons/VectorCombine.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import BlueDiamond from "../../icons/BlueDiamond.svelte";
    import GoldDiamond from "../../icons/GoldDiamond.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateBuilder from "./AccessGateBuilder.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";
    import CredentialGatePopup from "./CredentialGatePopup.svelte";

    interface Props {
        gateConfig: AccessGateConfig;
        position?: Position;
        align?: Alignment;
        small?: boolean;
        showNoGate?: boolean;
        level: Level;
        clickable?: boolean;
        button?: boolean;
    }

    let {
        gateConfig,
        position = "top",
        align = "start",
        small = false,
        showNoGate = false,
        level,
        clickable = false,
        button = false,
    }: Props = $props();

    const client = getContext<OpenChat>("client");

    let showDetail = $state(false);

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
    let tokenDetails = $derived(client.getTokenDetailsForAccessGate(gateConfig.gate));
    let params = $derived(formatParams(gateConfig.gate, tokenDetails));
    let defaultColor = $derived(button ? "var(--button-txt)" : "var(--icon-txt)");
</script>

{#if showDetail}
    <AccessGateBuilder
        valid={true}
        {level}
        onClose={() => (showDetail = false)}
        {gateConfig}
        editable={false} />
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={onClick} class="wrapper">
    {#if gateConfig.gate.kind === "no_gate" && showNoGate}
        <Tooltip {position} {align}>
            <div class="open">
                <ShieldLockOpenOutline size={$iconSize} color={defaultColor} />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.openAccessInfo")} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "locked_gate"}
        <Tooltip {position} {align}>
            <div class="locked"></div>
            {#snippet popupTemplate()}
                <Translatable
                    resourceKey={i18nKey("access.lockedGateInfo", undefined, level, true)} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "chit_earned_gate"}
        <Tooltip {position} {align}>
            <div class="chit"></div>
            {#snippet popupTemplate()}
                <Translatable
                    resourceKey={i18nKey("access.chitEarnedGateInfo", undefined, level, true)} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "composite_gate"}
        <Tooltip {position} {align}>
            <div class="composite">
                <VectorCombine size={$iconSize} color={defaultColor} />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.compositeGate")} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "diamond_gate"}
        <Tooltip {position} {align}>
            <div class="diamond">
                <BlueDiamond />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.diamondGateInfo")} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "lifetime_diamond_gate"}
        <Tooltip {position} {align}>
            <div class="diamond">
                <GoldDiamond />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.lifetimeDiamondGateInfo")} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "unique_person_gate"}
        <Tooltip {position} {align}>
            <div class="unique">
                <AccountCheck size={$iconSize} color={defaultColor} />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.uniquePersonInfo")} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "credential_gate"}
        {@const gate = gateConfig.gate}
        <Tooltip {position} {align}>
            <div class="credential">🔒️</div>
            {#snippet popupTemplate()}
                <CredentialGatePopup {gate} />
            {/snippet}
        </Tooltip>
    {:else if gateConfig.gate.kind === "referred_by_member_gate"}
        <Tooltip {position} {align}>
            <div class="referred_by_member">
                <AccountPlusOutline size={$iconSize} color={defaultColor} />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("access.referredByMemberInfo")} />
            {/snippet}
        </Tooltip>
    {:else if isNeuronGate(gateConfig.gate)}
        <Tooltip {position} {align}>
            <img class="icon" class:small src={tokenDetails?.logo} />
            {#snippet popupTemplate()}
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            "access.neuronHolderInfo",
                            tokenDetails ? { token: tokenDetails.symbol } : undefined,
                        )} />
                </p>
                <p class="params">{params}</p>
            {/snippet}
        </Tooltip>
    {:else if isPaymentGate(gateConfig.gate)}
        <Tooltip {position} {align}>
            <img class="icon" class:small src={tokenDetails?.logo} />
            {#snippet popupTemplate()}
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            "access.tokenPaymentInfo",
                            tokenDetails ? { token: tokenDetails.symbol } : undefined,
                        )} />
                </p>
                <p class="params">{params}</p>
            {/snippet}
        </Tooltip>
    {:else if isBalanceGate(gateConfig.gate)}
        {@const gate = gateConfig.gate}
        <Tooltip {position} {align}>
            <img class="icon" class:small src={tokenDetails?.logo} />
            {#snippet popupTemplate()}
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            "access.minimumBalanceInfo2",
                            tokenDetails
                                ? {
                                      token: tokenDetails.symbol,
                                      n: client.formatTokens(
                                          gate.minBalance,
                                          tokenDetails?.decimals ?? 8,
                                      ),
                                  }
                                : undefined,
                        )} />
                </p>
                <p class="params">{params}</p>
            {/snippet}
        </Tooltip>
    {/if}

    {#if gateConfig.expiry !== undefined}
        <Tooltip {position} {align}>
            <div class="expiry">
                <Alarm size={"0.9em"} color={defaultColor} />
            </div>
            {#snippet popupTemplate()}
                <AccessGateExpiry expiry={gateConfig.expiry} />
            {/snippet}
        </Tooltip>
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

    .chit {
        $size: 20px;
        background-repeat: no-repeat;
        width: $size;
        height: $size;
        background-image: url("/assets/chit.svg");
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
