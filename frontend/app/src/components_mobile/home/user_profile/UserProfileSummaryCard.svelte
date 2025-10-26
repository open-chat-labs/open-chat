<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { Avatar, Body, BodySmall, Container, H2, IconButton } from "component-lib";
    import {
        currentUserIdStore,
        OpenChat,
        publish,
        type PublicProfile,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import Markdown from "../Markdown.svelte";
    import Badges from "../profile/Badges.svelte";
    import ChitSummary from "./ChitSummary.svelte";

    const client = getContext<OpenChat>("client");

    type Mode = "edit" | "view";

    interface Props {
        user: UserSummary;
        profile: PublicProfile;
        mode?: Mode;
    }

    let { user, profile, mode = "edit" }: Props = $props();

    let me = $derived(user.userId === $currentUserIdStore);

    let avatarUrl = $derived(
        profile !== undefined
            ? client.buildUserAvatarUrl(
                  import.meta.env.OC_BLOB_URL_PATTERN!,
                  user.userId,
                  profile.avatarId,
              )
            : "/assets/unknownUserAvatar.svg",
    );

    let backgroundUrl = $derived(
        client.buildUserBackgroundUrl(
            import.meta.env.OC_BLOB_URL_PATTERN!,
            user.userId,
            profile.backgroundId,
        ),
    );

    // This doesn't exist as a first-class thing in the theme at the moment - not sure if it _should_
    const gradient =
        "linear-gradient(90deg, var(--warning) 0%, var(--primary) 30%, var(--primary) 70%, var(--tertiary) 100%)";

    function profileSettings() {
        publish("userProfileSettings", profile);
    }

    function shareProfile() {
        publish("userProfileShare");
    }

    function about() {
        publish("userProfileAbout");
    }
</script>

<Container direction={"vertical"}>
    <Container
        borderRadius={"md"}
        minHeight={"10rem"}
        mainAxisAlignment={"end"}
        padding={"sm"}
        gap={"sm"}
        backgroundImage={backgroundUrl}
        background={gradient}>
        {#if mode === "edit"}
            <IconButton onclick={about} size={"md"} mode={"dark"}>
                {#snippet icon(color)}
                    <Info {color} />
                {/snippet}
            </IconButton>
            <IconButton onclick={shareProfile} size={"md"} mode={"dark"}>
                {#snippet icon(color)}
                    <Share {color} />
                {/snippet}
            </IconButton>
            <IconButton onclick={profileSettings} size={"md"} mode={"dark"}>
                {#snippet icon(color)}
                    <Cog {color} />
                {/snippet}
            </IconButton>
        {/if}
    </Container>
    <Container
        supplementalClass={"username_and_bio"}
        gap={"lg"}
        padding={["zero", "lg"]}
        direction="vertical">
        <Container gap={"sm"}>
            <Avatar borderWidth={"thick"} size={"xxl"} url={avatarUrl}></Avatar>
            <Container height={{ kind: "fill" }} mainAxisAlignment={"end"} direction={"vertical"}>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <H2 width={{ kind: "hug" }}>{profile.displayName ?? profile.username}</H2>
                    <Badges diamondStatus={user.diamondStatus} uniquePerson={user.isUniquePerson} />
                </Container>
                <BodySmall colour={"textSecondary"}>@{user.username}</BodySmall>
            </Container>
        </Container>
        <Body fontWeight={"light"}>
            <Markdown inline={false} text={profile.bio} />
        </Body>
    </Container>

    {#if !$disableChit}
        <Container
            onClick={me ? () => publish("userProfileChitRewards") : undefined}
            padding={["xl", "lg"]}
            direction={"vertical"}
            allowOverflow>
            <ChitSummary
                {mode}
                streak={user.streak}
                earned={user.totalChitEarned}
                balance={user.chitBalance} />
        </Container>
    {/if}
</Container>

<style lang="scss">
    :global(.container.username_and_bio) {
        margin-top: -1.75rem;
    }
</style>
