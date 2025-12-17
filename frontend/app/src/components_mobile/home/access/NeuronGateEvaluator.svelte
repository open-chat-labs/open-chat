<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        StatusCard,
        Switch,
    } from "component-lib";
    import { type CryptocurrencyDetails, type NeuronGate, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: NeuronGate & { expiry: bigint | undefined };
        onClose: () => void;
        onApprove: () => void;
    }

    let { gate, onClose, onApprove }: Props = $props();

    let token = client.getTokenDetailsForAccessGate(gate);
    let confirmed = $state(false);

    function neuronGateSubtext(gate: NeuronGate): string | undefined {
        const dissolveDelayDays = client.getMinDissolveDelayDays(gate);
        const minStake = client.getMinStakeInTokens(gate);
        const parts: string[] = [];
        if (dissolveDelayDays !== undefined) {
            parts.push(`${dissolveDelayDays}d dissolve delay`);
        }
        if (minStake !== undefined) {
            parts.push(`${minStake} token stake`);
        }
        return parts.join(" / ");
    }

    function neuronGateSummary(token: CryptocurrencyDetails, gate: NeuronGate): string | undefined {
        const dissolveDelayDays = client.getMinDissolveDelayDays(gate);
        const minStake = client.getMinStakeInTokens(gate);
        const parts: string[] = [
            `We need you to confirm that you are a ${token.name} neuron holder `,
        ];
        if (dissolveDelayDays === undefined && minStake === undefined) {
            parts.push(".");
        } else if (dissolveDelayDays !== undefined && minStake === undefined) {
            parts.push(`with a minimum dissolve delay of ${dissolveDelayDays}d.`);
        } else if (dissolveDelayDays === undefined && minStake !== undefined) {
            parts.push(`with as least a ${minStake} token stake.`);
        } else if (dissolveDelayDays !== undefined && minStake !== undefined) {
            parts.push(
                `with at least a ${minStake} token stake and a minimum dissolve delay of ${dissolveDelayDays}d.`,
            );
        }
        return parts.join("");
    }
</script>

{#snippet tokenCard(token: CryptocurrencyDetails)}
    {@const subtext = neuronGateSubtext(gate)}
    <Row gap={"sm"}>
        <Row
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            minHeight={"4rem"}
            gap={"md"}
            background={ColourVars.background2}
            padding={["md", "lg"]}>
            <Avatar url={token.logo} />
            <Column width={"fill"}>
                <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}>{token.name}</Body>
                {#if subtext !== undefined}
                    <Caption colour={"textSecondary"} fontWeight={"bold"}>
                        {subtext}
                    </Caption>
                {/if}
            </Column>
        </Row>
    </Row>
{/snippet}

{#if token !== undefined}
    <Column gap={"xl"}>
        <img
            class={"icon"}
            src={`/assets/access_gate/neuron_colour.svg`}
            alt={"Neuron access gate"} />
        <H2 fontWeight={"bold"}>
            <MulticolourText
                parts={[
                    {
                        text: i18nKey(token.symbol),
                        colour: "primary",
                    },
                    {
                        text: i18nKey(" neuron holder gate"),
                        colour: "textPrimary",
                    },
                ]} />
        </H2>

        <Body colour={"textSecondary"}>
            {neuronGateSummary(token, gate)}
        </Body>

        <Column gap={"sm"}>
            {@render tokenCard(token)}
            <StatusCard
                borderColour={ColourVars.background2}
                background={ColourVars.background0}
                mode={"warning"}
                body={interpolate(
                    $_,
                    i18nKey(
                        "If you falsely confirm that you are a qualifying neuron holder, you will not be able to successfully join.",
                    ),
                )}
                title={interpolate($_, i18nKey("Confirm only if true"))}>
            </StatusCard>
            {#if gate.expiry !== undefined}
                <StatusCard
                    background={ColourVars.background2}
                    mode={"information"}
                    title={interpolate($_, i18nKey("This is a recurring payment"))}>
                    {#snippet body()}
                        <AccessGateExpiry expiry={gate.expiry} />
                    {/snippet}
                </StatusCard>
            {/if}
            <Row
                onClick={() => (confirmed = !confirmed)}
                borderRadius={"lg"}
                gap={"md"}
                padding={"lg"}
                background={ColourVars.background2}>
                <BodySmall>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("I confirm that I am a "),
                                colour: "textPrimary",
                            },
                            {
                                text: i18nKey(`${token.name} neuron`),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(
                                    " holder, and that my neuron meets the required criteria.",
                                ),
                                colour: "textPrimary",
                            },
                        ]} />
                </BodySmall>
                <Switch bind:checked={confirmed}></Switch>
            </Row>
        </Column>
    </Column>
    <Button disabled={!confirmed} width={"fill"} onClick={onApprove}>
        {#snippet icon(color)}
            <Wallet {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Continue")} />
    </Button>
    <CommonButton width={"fill"} size={"small_text"} onClick={onClose}>
        <Translatable resourceKey={i18nKey("cancel")} />
    </CommonButton>
{/if}

<style lang="scss">
    img.icon {
        width: 3.5rem;
    }
</style>
