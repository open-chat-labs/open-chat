<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Avatar, Caption, Container, H1 } from "component-lib";
    import { allUsersStore, currentUserIdStore, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import FlashOutline from "svelte-material-icons/FlashOutline.svelte";
    import RobotOutline from "svelte-material-icons/RobotOutline.svelte";
    import Sync from "svelte-material-icons/Sync.svelte";
    import SectionButton from "../../SectionButton.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import UserProfileHeader from "./UserProfileHeader.svelte";

    type SubArea = "profile" | "general" | "advanced" | "about";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let name = $derived(client.getDisplayName($currentUserIdStore));
    let avatarUrl = $derived(client.userAvatarUrl(user));
    let subarea = $state<SubArea>("profile");
</script>

<UserProfileHeader />

<Container
    padding={["xl", "lg", "zero", "lg"]}
    gap={"lg"}
    height={{ kind: "fill" }}
    crossAxisAlignment={"center"}
    direction={"vertical"}>
    <Avatar size={"huge"} url={avatarUrl}></Avatar>
    <Container crossAxisAlignment={"center"} direction={"vertical"}>
        <H1 align={"center"}>{name}</H1>
        <Caption colour={"secondary"} align={"center"}>@{user?.username}</Caption>
    </Container>

    <Container gap={"lg"} direction={"vertical"}>
        <SparkleBox
            buttonText={i18nKey("Start verification")}
            onClick={() => console.log("Verify")}>
            {#snippet title()}
                <Translatable resourceKey={i18nKey("Verify you are a real person")}></Translatable>
            {/snippet}
            {#snippet body()}
                <Translatable
                    resourceKey={i18nKey(
                        "Verify your unique personhood as a signal of your trustworthiness to other users! It only takes a minute.",
                    )}></Translatable>
            {/snippet}
            {#snippet buttonIcon(color)}
                <AccountStar {color} />
            {/snippet}
        </SparkleBox>
        <Container padding={["zero", "xl"]}>
            <Caption>
                <Translatable resourceKey={i18nKey("General options")}></Translatable>
            </Caption>
        </Container>
        <SectionButton
            Icon={Cog}
            title={i18nKey("Chat & video call settings")}
            info={i18nKey(
                "Modify the behaviour of your chats, video calls, and manage restricted content.",
            )} />

        <SectionButton
            Icon={AccountMultiple}
            title={i18nKey("Community settings")}
            info={i18nKey(
                "This section allows you to set your desired display name per community.",
            )} />

        <SectionButton
            Icon={Eye}
            title={i18nKey("Appearance")}
            info={i18nKey(
                "Set the default language or the font size. New options to adjust the app's theme will soon be added.",
            )} />

        <SectionButton
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

        <SectionButton
            Icon={Sync}
            title={i18nKey("Cache management")}
            info={i18nKey(
                "In some circumstances, clearing the app's cached data can resolve issues. You should not normally need to use this.",
            )} />

        <SectionButton
            Icon={RobotOutline}
            title={i18nKey("Bot configuration")}
            info={i18nKey(
                "View configuration data required when creating your own OpenChat bot.",
            )} />

        <SectionButton
            Icon={Delete}
            title={i18nKey("Delete account")}
            info={i18nKey(
                "You've decided not to be a member of OpenChat anymore. We'd hate to see you go... Perhaps we can havve a CHAT about it?",
            )} />
    </Container>
</Container>

<style lang="scss">
    :global(.container.user_profile_summary_buttons) {
        margin-top: auto;
        margin-bottom: var(--sp-md);
    }
</style>
