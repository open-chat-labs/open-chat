<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { Caption, Container, FloatingButton } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        OpenChat,
        publish,
        type PublicProfile,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import FlashOutline from "svelte-material-icons/FlashOutline.svelte";
    import RobotOutline from "svelte-material-icons/RobotOutline.svelte";
    import Sync from "svelte-material-icons/Sync.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import LinkedCard from "../../LinkedCard.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import UserProfileSummaryCard from "./UserProfileSummaryCard.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let verified = $derived(user?.isUniquePerson ?? false);
    let profile: PublicProfile | undefined = $state();

    // this is no good. We need to have already loaded this profile to avoid a horrible clunk in the UI
    onMount(async () => {
        try {
            user = await client.getUser($currentUserIdStore);
            client.getPublicProfile($currentUserIdStore).subscribe({
                onResult: (result) => {
                    profile = result;
                },
            });
        } catch (e: any) {
            client.logError("Failed to load user profile", e);
        }
    });
</script>

<Container
    padding={["zero", "lg", "zero", "lg"]}
    gap={"lg"}
    height={{ kind: "fill" }}
    crossAxisAlignment={"center"}
    direction={"vertical"}>
    <Container gap={"lg"} direction={"vertical"}>
        {#if user !== undefined && profile !== undefined}
            <UserProfileSummaryCard {user} {profile} />
        {/if}
        {#if !verified}
            <SparkleBox
                buttonText={i18nKey("Start verification")}
                onClick={() => publish("verifyHumanity")}>
                {#snippet title()}
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey("Verify you are a "),
                                colour: "primaryLight",
                            },
                            {
                                text: i18nKey("real person"),
                                colour: "primary",
                            },
                        ]} />
                {/snippet}
                {#snippet body()}
                    <MulticolourText
                        parts={[
                            {
                                text: i18nKey(
                                    "Verify your unique personhood as a signal of your trustworthiness to other users! ",
                                ),
                                colour: "primaryLight",
                            },
                            {
                                text: i18nKey("It only takes a minute."),
                                colour: "textPrimary",
                            },
                        ]} />
                {/snippet}
                {#snippet buttonIcon(color)}
                    <AccountStar {color} />
                {/snippet}
            </SparkleBox>
        {/if}
        <Container padding={["zero", "xl"]}>
            <Caption>
                <Translatable resourceKey={i18nKey("General options")}></Translatable>
            </Caption>
        </Container>
        <LinkedCard
            Icon={Cog}
            title={i18nKey("Chat & video call settings")}
            info={i18nKey(
                "Modify the behaviour of your chats, video calls, and manage restricted content.",
            )} />

        <LinkedCard
            Icon={AccountMultiple}
            title={i18nKey("Community settings")}
            info={i18nKey(
                "This section allows you to set your desired display name per community.",
            )} />

        <LinkedCard
            Icon={Eye}
            title={i18nKey("Appearance")}
            info={i18nKey(
                "Set the default language or the font size. New options to adjust the app's theme will soon be added.",
            )} />

        <LinkedCard
            Icon={FlashOutline}
            title={i18nKey("CHIT rewards")}
            info={i18nKey(
                "You can earn rewards in the form of CHIT while using the app, and then exchange your hard earned CHIT for exclusive features.",
            )} />

        <Container padding={["zero", "xl"]}>
            <Caption>
                <Translatable resourceKey={i18nKey("Advanced options")}></Translatable>
            </Caption>
        </Container>

        <LinkedCard
            Icon={Sync}
            title={i18nKey("Cache management")}
            info={i18nKey(
                "In some circumstances, clearing the app's cached data can resolve issues. You should not normally need to use this.",
            )} />

        <LinkedCard
            Icon={RobotOutline}
            title={i18nKey("Bot configuration")}
            info={i18nKey(
                "View configuration data required when creating your own OpenChat bot.",
            )} />

        <LinkedCard
            Icon={Delete}
            title={i18nKey("Delete account")}
            info={i18nKey(
                "You've decided not to be a member of OpenChat anymore. We'd hate to see you go... Perhaps we can havve a CHAT about it?",
            )} />
    </Container>
</Container>
<div class="floating">
    <FloatingButton onClick={() => publish("wallet")}>
        {#snippet icon(color)}
            <Wallet {color}></Wallet>
        {/snippet}
    </FloatingButton>
</div>

<style lang="scss">
    :global(.container.user_profile_summary_buttons) {
        margin-top: auto;
        margin-bottom: var(--sp-md);
    }
    .floating {
        position: absolute;
        bottom: var(--sp-md);
        right: var(--sp-md);
    }
</style>
