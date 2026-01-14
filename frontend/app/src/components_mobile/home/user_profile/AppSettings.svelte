<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, Container, MenuItem } from "component-lib";
    import { publish } from "openchat-client";
    import page from "page";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import FlashOutline from "svelte-material-icons/FlashOutline.svelte";
    import RobotOutline from "svelte-material-icons/RobotOutline.svelte";
    import Sync from "svelte-material-icons/Sync.svelte";
    import LinkedCard from "../../LinkedCard.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    function help() {
        publish("closeModalStack");
        page("/community/dgegb-daaaa-aaaar-arlhq-cai/channel/3798400021");
    }
</script>

<SlidingPageContent title={i18nKey("App settings")}>
    {#snippet menu()}
        <MenuItem onclick={() => publish("userProfileAbout")}>About OpenChat</MenuItem>
        <MenuItem onclick={help}>Get help</MenuItem>
    {/snippet}
    <Container
        padding={["xxl", "lg", "huge"]}
        gap={"lg"}
        height={"fill"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container padding={["zero", "xl"]}>
                <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("General options")}></Translatable>
                </BodySmall>
            </Container>

            <LinkedCard
                onClick={() => publish("userProfileChatsAndVideo")}
                Icon={Cog}
                title={i18nKey("Chat & video call settings")}
                info={i18nKey(
                    "Modify the behaviour of your chats, video calls, and manage restricted content.",
                )} />

            <LinkedCard
                onClick={() => publish("userProfileCommunitySettings")}
                Icon={AccountMultiple}
                title={i18nKey("Community settings")}
                info={i18nKey(
                    "This section allows you to set your desired display name per community.",
                )} />

            <LinkedCard
                onClick={() => publish("userProfileAppearance")}
                Icon={Eye}
                title={i18nKey("Appearance")}
                info={i18nKey(
                    "Set the default language or the font size. New options to adjust the app's theme will soon be added.",
                )} />

            <LinkedCard
                onClick={() => publish("userProfileChitRewards")}
                Icon={FlashOutline}
                title={i18nKey("CHIT rewards")}
                info={i18nKey(
                    "You can earn rewards in the form of CHIT while using the app, and then exchange your hard earned CHIT for exclusive features.",
                )} />

            <Container padding={["zero", "xl"]}>
                <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Advanced options")}></Translatable>
                </BodySmall>
            </Container>

            <LinkedCard
                onClick={() => publish("userProfileCacheManagement")}
                Icon={Sync}
                title={i18nKey("Cache management")}
                info={i18nKey(
                    "In some circumstances, clearing the app's cached data can resolve issues. You should not normally need to use this.",
                )} />

            <LinkedCard
                onClick={() => publish("userProfileBotConfig")}
                Icon={RobotOutline}
                title={i18nKey("Bot configuration")}
                info={i18nKey(
                    "View configuration data required when creating your own OpenChat bot.",
                )} />

            <LinkedCard
                onClick={() => publish("userProfileDeleteAccount")}
                Icon={Delete}
                title={i18nKey("Delete account")}
                info={i18nKey(
                    "You've decided not to be a member of OpenChat anymore. We'd hate to see you go... Perhaps we can havve a CHAT about it?",
                )} />
        </Container>
    </Container>
</SlidingPageContent>
