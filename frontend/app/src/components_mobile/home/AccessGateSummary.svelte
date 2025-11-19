<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { flattenGateConfig, gateLabel } from "@src/utils/access";
    import { Body, Container, type SizeMode } from "component-lib";
    import { type AccessGateConfig } from "openchat-client";
    import Translatable from "../Translatable.svelte";

    interface Props {
        gateConfig: AccessGateConfig;
    }

    let { gateConfig }: Props = $props();

    let gates = $derived(flattenGateConfig(gateConfig));
    const width: SizeMode = { kind: "hug" };
    let evaluationDays = $derived(initialEvaluationDays());
    function initialEvaluationDays() {
        if (gateConfig.expiry === undefined) return undefined;
        return Math.floor(Number(gateConfig.expiry) / 1000 / 60 / 60 / 24).toString();
    }
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Container direction={"vertical"} gap={"md"}>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Access gates")}></Translatable>
        </Body>

        {#if gates.length > 0}
            <Container {width} wrap gap={"sm"}>
                {#each gates as gate, i}
                    {@const last = i === gates.length - 1}
                    <Body {width}>
                        <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}></Translatable>
                    </Body>
                    {#if !last}
                        <Body colour={"primary"} {width}>/</Body>
                    {/if}
                {/each}
            </Container>
        {:else}
            <Body {width}>
                <Translatable
                    resourceKey={i18nKey(
                        "There are no access gates defined for the community. You may still define access gates for individual channels within the community.",
                    )}></Translatable>
            </Body>
        {/if}
    </Container>
    {#if evaluationDays !== undefined}
        <Container direction={"vertical"} gap={"md"}>
            <Container crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
                <Body colour={"textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Gate evaluation interval")}></Translatable>
                </Body>
                <Body {width} colour={"secondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey(`${evaluationDays} days`)}></Translatable>
                </Body>
            </Container>
            <Body>
                <Translatable
                    resourceKey={i18nKey(
                        `After ${evaluationDays} days, your members will be evaluated against your group’s access gates. Any members that do not satisfy the access gates will be demoted to lapsed members and will have to re-join.`,
                    )}></Translatable>
            </Body>
        </Container>
    {/if}
</Container>
