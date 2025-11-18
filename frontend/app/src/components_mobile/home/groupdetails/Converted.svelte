<script lang="ts">
    import { Body, Button, ColourVars, Container, H2 } from "component-lib";
    import { publish, routeForChatIdentifier, type ChannelIdentifier } from "openchat-client";
    import page from "page";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import PartyPopper from "svelte-material-icons/PartyPopper.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MulticolourText from "../../MulticolourText.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        name: string;
        channelId: ChannelIdentifier;
    }

    let { name, channelId }: Props = $props();

    function go() {
        if (channelId !== undefined) {
            page(routeForChatIdentifier("community", channelId));
            publish("closeModalStack");
        }
    }
</script>

<SlidingPageContent title={i18nKey("Convert to community")} subtitle={i18nKey(name)}>
    <Container direction={"vertical"} gap={"xxl"} padding={["xxl", "lg"]}>
        <Container padding={["zero", "lg"]} gap={"sm"} direction={"vertical"}>
            <PartyPopper color={ColourVars.primary} size={"7rem"} />
            <H2>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(name),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" successfully converted into a community "),
                            colour: "textPrimary",
                        },
                    ]}></MulticolourText>
            </H2>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Your group is now available as a community, and you may start adding more channels and more members. Use the power of a community at your disposal!",
                    )} />
            </Body>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Hint: If you have more groups you’d like to consolidate as parts of communities, you can import them into any community which you own as channels.",
                    )} />
            </Body>
        </Container>

        <Container direction={"vertical"} gap={"lg"}>
            <Button onClick={go}>
                <Translatable resourceKey={i18nKey("Go to the community")} />
                {#snippet icon(color)}
                    <AccountGroup {color} />
                {/snippet}
            </Button>
            <Button secondary onClick={() => publish("closeModalStack")}>
                <Translatable resourceKey={i18nKey("Finish")} />
                {#snippet icon(color)}
                    <ChevronRight {color} />
                {/snippet}
            </Button>
        </Container>
    </Container>
</SlidingPageContent>
