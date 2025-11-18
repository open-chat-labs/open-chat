<script lang="ts">
    import { Body, BodySmall, Button, ColourVars, Container, H2, StatusCard } from "component-lib";
    import {
        defaultChatRules,
        publish,
        type GroupChatSummary,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: GroupChatSummary;
    }

    let { chat = $bindable() }: Props = $props();

    let state: "idle" | "converting" | "error" = $state("idle");

    let steps: string[] = [
        "freeze the existing group",
        "create a new community with the same name as the group",
        "add a public channel to the community with the same name as the group",
        "add all members of the group as members of the community",
        "copy the full message history from the group into the channel",
        "delete the existing group",
        "inform all members of the group that it has been converted to a community",
    ];

    function convert() {
        state = "converting";
        client.convertGroupToCommunity(chat, defaultChatRules("community")).then((id) => {
            if (id !== undefined) {
                publish("convertedGroupToCommunity", { name: chat.name, channelId: id });
            } else {
                state = "error";
            }
        });
    }

    function close() {
        state = "idle";
        publish("closeModalStack");
    }
</script>

<SlidingPageContent title={i18nKey("Convert to community")} subtitle={i18nKey(chat.name)}>
    <Container direction={"vertical"} gap={"xxl"} padding={["xxl", "lg"]}>
        <Container padding={["zero", "lg"]} gap={"sm"} direction={"vertical"}>
            <AccountGroup color={ColourVars.primary} size={"10rem"} />
            <H2>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Convert "),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey(chat.name),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" into a community"),
                            colour: "textPrimary",
                        },
                    ]}></MulticolourText>
            </H2>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "We can take care of converting your group into a community.",
                    )} />
            </Body>
        </Container>

        <Container direction={"vertical"} gap={"lg"}>
            <StatusCard
                mode={"warning"}
                title={"This is irreversible"}
                body={"Converting a group into a community is an irreversible process. Make sure you are okay with this before proceeding."}
            ></StatusCard>
            <Container
                borderRadius={"lg"}
                gap={"md"}
                direction={"vertical"}
                padding={"lg"}
                background={ColourVars.background1}>
                {#if state === "converting"}
                    <Container
                        minHeight={"24rem"}
                        direction={"vertical"}
                        mainAxisAlignment={"center"}
                        padding={["zero", "xxl"]}
                        gap={"lg"}
                        crossAxisAlignment={"center"}>
                        <div class="spinner">
                            <FancyLoader />
                        </div>
                        <Body align={"center"} colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("communities.pleaseWait")} />
                        </Body>
                    </Container>
                {:else if state === "idle"}
                    <Container gap={"md"} direction={"vertical"}>
                        {#each steps as step}
                            <Container gap={"md"}>
                                <Check color={ColourVars.primary} size={"1.5rem"} />
                                <Body>{step}</Body>
                            </Container>
                        {/each}
                    </Container>
                {:else if state === "error"}
                    <Container
                        minHeight={"24rem"}
                        direction={"vertical"}
                        mainAxisAlignment={"center"}
                        padding={["zero", "xxl"]}
                        gap={"lg"}
                        crossAxisAlignment={"center"}>
                        <div class="error-img"></div>
                        <Body align={"center"} colour={"textSecondary"}>
                            <Translatable
                                resourceKey={i18nKey("communities.errors.convertFailed")} />
                        </Body>
                    </Container>
                {/if}
            </Container>

            <BodySmall align={"center"} colour={"textSecondary"}>
                {"This process might take a few minutes depending on the size of the group so please be patient"}
            </BodySmall>

            {#if state !== "error"}
                <Button
                    disabled={state === "converting"}
                    loading={state === "converting"}
                    onClick={convert}>
                    <Translatable resourceKey={i18nKey("Convert to community")} />
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                </Button>
                <Button secondary onClick={close}>
                    <Translatable resourceKey={i18nKey("Cancel")} />
                    {#snippet icon(color)}
                        <Close {color} />
                    {/snippet}
                </Button>
            {/if}
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    .spinner {
        width: 4rem;
        height: 4rem;
    }
    .error-img {
        background-image: url("/assets/dead-bot.svg");
        background-repeat: no-repeat;
        width: 150px;
        height: 150px;
        margin: 30px auto;
    }
</style>
