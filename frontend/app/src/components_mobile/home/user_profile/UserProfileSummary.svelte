<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { Body, BodySmall, ColourVars, Container, IconButton } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        currentUserProfileStore,
        OpenChat,
        percentageStorageUsedStore,
        publish,
        storageInGBStore,
        userMetricsStore,
        type PublicProfile,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import Progress from "../../Progress.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import Stats from "../Stats.svelte";
    import UserProfileSummaryCard from "./UserProfileSummaryCard.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let verified = $derived(user?.isUniquePerson ?? false);
    let profile: PublicProfile | undefined = $state();

    onMount(() => {
        client.getUser($currentUserIdStore).then((u) => {
            if (u) {
                user = u;
            }
        });
        return currentUserProfileStore.subscribe((p) => {
            profile = p;
        });
    });

    function onCopy() {
        navigator.clipboard.writeText(user.userId).then(() => {
            toastStore.showSuccessToast(i18nKey("userIdCopiedToClipboard"));
        });
    }
</script>

<Container
    padding={["lg", "lg", "lg", "lg"]}
    gap={"lg"}
    height={{ kind: "fill" }}
    crossAxisAlignment={"center"}
    direction={"vertical"}>
    <Container padding={["zero", "zero", "lg", "zero"]} gap={"lg"} direction={"vertical"}>
        {#if user !== undefined && profile !== undefined}
            <UserProfileSummaryCard {user} {profile} />
        {/if}
        {#if !verified}
            <SparkleBox
                buttonText={i18nKey("Start verification")}
                onClick={() => publish("userProfileVerify")}>
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
        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Account details")}></Translatable>
            </BodySmall>
            <Container gap={"sm"} direction={"vertical"}>
                <Container crossAxisAlignment={"center"}>
                    <Container direction={"vertical"}>
                        <Body colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("user & canister id")}
                            ></Translatable>
                        </Body>

                        <Body fontWeight={"bold"}>
                            {user.userId}
                        </Body>
                    </Container>
                    <IconButton onclick={onCopy} size={"sm"}>
                        {#snippet icon()}
                            <CopyIcon color={ColourVars.textSecondary} />
                        {/snippet}
                    </IconButton>
                </Container>
            </Container>
            <Container gap={"sm"} direction={"vertical"}>
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("account storage usage")}></Translatable>
                </Body>

                <Progress
                    colour={ColourVars.secondary}
                    size={"6px"}
                    percent={$percentageStorageUsedStore} />

                <Body fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey("storageUsed", {
                            used: $storageInGBStore.gbUsed.toFixed(2),
                            limit: $storageInGBStore.gbLimit.toFixed(1),
                        })} />
                    <Translatable
                        resourceKey={i18nKey("storagePercentRemaining", {
                            percent: $percentageStorageUsedStore,
                        })} />
                </Body>
            </Container>
        </Container>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("User stats")}></Translatable>
            </BodySmall>
            <Stats showReported stats={$userMetricsStore} />
        </Container>
        <!--
        <Container padding={["zero", "xl"]}>
            <Caption>
                <Translatable resourceKey={i18nKey("General options")}></Translatable>
            </Caption>
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
            <Caption>
                <Translatable resourceKey={i18nKey("Advanced options")}></Translatable>
            </Caption>
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
            )} /> -->
    </Container>
</Container>

<style lang="scss">
    :global(.container.user_profile_summary_buttons) {
        margin-top: auto;
        margin-bottom: var(--sp-md);
    }
</style>
