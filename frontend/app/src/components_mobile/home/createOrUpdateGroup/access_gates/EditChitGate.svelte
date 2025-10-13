<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        Form,
        Input,
    } from "component-lib";
    import {
        isChitEarnedGate,
        publish,
        type AccessGate,
        type ChitEarnedGate,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutChitGate from "./AboutChitGate.svelte";

    let ugs = updateGroupState;

    interface Props {
        gate: ChitEarnedGate;
    }

    let { gate }: Props = $props();

    // svelte-ignore state_referenced_locally
    let minEarnedText = $state(initialMinEarned(gate));
    let minEarned = $derived(amountFromText(minEarnedText));
    let invalidMinEarned = $derived(minEarned === undefined);
    let valid = $derived(!invalidMinEarned);

    function initialMinEarned(gate: AccessGate): string {
        if (isChitEarnedGate(gate)) {
            return gate.minEarned.toString();
        }
        return "";
    }

    function amountFromText(amountText: string): number | undefined {
        const n = Number(amountText);
        return isNaN(n) ? undefined : n;
    }

    function save() {
        if (minEarned !== undefined) {
            updateOrAddGate({
                ...gate,
                minEarned: minEarned,
            });

            publish("closeModalPage");
        }
    }

    function updateOrAddGate(gate: ChitEarnedGate) {
        const match = ugs.findMatch(gate);
        if (match === undefined) {
            ugs.addLeaf(gate);
        } else if (isChitEarnedGate(match)) {
            match.minEarned = gate.minEarned;
        }
    }
</script>

<SlidingPageContent title={i18nKey("Provide gate values")}>
    <Container height={{ kind: "fill" }} gap={"lg"} direction={"vertical"} padding={["xl", "lg"]}>
        <AboutChitGate padding={"lg"} background={ColourVars.background1} />

        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Gate values")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Specify the minimum amount of CHIT that user must have earned to obtain access.",
                        )}></Translatable>
                </BodySmall>
            </Container>

            <Form onSubmit={save}>
                <Container direction={"vertical"} gap={"xl"}>
                    <Input
                        maxlength={100}
                        placeholder={interpolate($_, i18nKey("Minimum CHIT earned"))}
                        error={invalidMinEarned}
                        bind:value={minEarnedText}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("This value is required")}
                            ></Translatable>
                        {/snippet}
                    </Input>
                </Container>
            </Form>
        </Container>

        <Container mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
            <CommonButton disabled={!valid} onClick={save} mode={"active"} size={"medium"}>
                {#snippet icon(color)}
                    <Save {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
