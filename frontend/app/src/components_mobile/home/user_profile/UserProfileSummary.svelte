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
    import Cog from "svelte-material-icons/Cog.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import SquareEdit from "svelte-material-icons/SquareEditOutline.svelte";
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

    function appSettings() {
        publish("appSettings");
    }

    function userInformation() {
        if (profile !== undefined) {
            publish("userInformation", profile);
        }
    }

    function shareProfile() {
        publish("userProfileShare");
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
            <UserProfileSummaryCard {user} {profile}>
                {#snippet buttons()}
                    <IconButton onclick={() => client.logout()} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <Logout {color} />
                        {/snippet}
                    </IconButton>
                    <IconButton onclick={shareProfile} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <Share {color} />
                        {/snippet}
                    </IconButton>
                    <IconButton onclick={userInformation} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <SquareEdit {color} />
                        {/snippet}
                    </IconButton>
                    <IconButton onclick={appSettings} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <Cog {color} />
                        {/snippet}
                    </IconButton>
                {/snippet}
            </UserProfileSummaryCard>
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
    </Container>
</Container>

<style lang="scss">
    :global(.container.user_profile_summary_buttons) {
        margin-top: auto;
        margin-bottom: var(--sp-md);
    }
</style>
