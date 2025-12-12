<script lang="ts">
    import {
        Body,
        Button,
        ColourVars,
        Column,
        CommonButton,
        Container,
        H2,
        Row,
        Sheet,
        type SwipeDirection,
    } from "component-lib";
    import { canExtendDiamondStore, isDiamondStore, publish } from "openchat-client";
    import { onMount } from "svelte";
    import Diamond from "svelte-material-icons/DiamondOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MulticolourText from "../..//MulticolourText.svelte";
    import Translatable from "../../Translatable.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";

    let showPayment = $state(false);

    onMount(() => {
        if ($canExtendDiamondStore) {
            showPayment = true;
        }
    });

    function insideEnd(n: number) {
        console.log("from end", n);
    }

    function onCancel() {
        publish("closeModalPage");
    }

    let onSwipe = $derived((dir: SwipeDirection) => {
        if (dir === "right") {
            onCancel();
        }
    });
</script>

<Container {onSwipe} background={ColourVars.background0} height={"fill"} direction={"vertical"}>
    <Container onInsideEnd={insideEnd} direction={"vertical"} closeMenuOnScroll height={"fill"}>
        <Column gap={"xl"} padding={["xxl", "xxl", "xxxl", "xxl"]} supplementalClass={"starfield"}>
            <Column width={{ size: "80%" }} gap={"sm"}>
                <Diamond color={ColourVars.primary} size={"4.5rem"} />
                <H2 fontWeight={"bold"}>
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Explore "),
                                colour: "textPrimary",
                            },
                            {
                                text: i18nKey("OpenChat Diamond"),
                                colour: "primary",
                            },
                            {
                                text: i18nKey(" Membership"),
                                colour: "textPrimary",
                            },
                        ]} />
                </H2>
            </Column>
            <Body>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Diamond gives you "),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey("enhanced features "),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" and valuable "),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey("extra perks, "),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(
                                "offering a smoother, more powerful chat experience than the standard tier.",
                            ),
                            colour: "textPrimary",
                        },
                    ]} />
            </Body>
        </Column>
        <Row
            height={{ size: "4px" }}
            background={"linear-gradient(90deg, var(--primary), var(--secondary))"}>
            <span></span>
        </Row>
        <Features />
        <div class="fade"></div>
    </Container>
    <Column gap={"lg"} crossAxisAlignment={"center"} padding={["lg", "xl"]}>
        {#if !$isDiamondStore}
            <Button onClick={() => (showPayment = true)}>
                {#snippet icon(color)}
                    <Diamond {color} />
                {/snippet}

                <Translatable resourceKey={i18nKey("upgrade.button")} /></Button>
        {:else if $canExtendDiamondStore}
            <Button onClick={() => (showPayment = true)}>
                {#snippet icon(color)}
                    <Diamond {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("upgrade.extendShort")} /></Button>
        {/if}
        <CommonButton onClick={onCancel} size={"small_text"} mode={"active"}>
            <Translatable resourceKey={i18nKey("Go back")} />
        </CommonButton>
    </Column>
</Container>

{#if showPayment}
    <Sheet onDismiss={() => (showPayment = false)}>
        <Payment onSuccess={() => publish("closeModalStack")} />
    </Sheet>
{/if}

<style lang="scss">
    .fade {
        position: sticky;
        bottom: 0;
        inset: auto 0 0 0;
        flex: 0 0 3rem;
        width: 100%;
        pointer-events: none;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0), var(--background-1));
    }
</style>
