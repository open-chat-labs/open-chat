<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import {
        Avatar,
        Body,
        BodySmall,
        ColourVars,
        Container,
        defaultBackgroundGradient,
        H2,
        Logo,
    } from "component-lib";
    import {
        currentUserIdStore,
        OpenChat,
        publish,
        type PublicProfile,
        type UserSummary,
    } from "openchat-client";
    import { getContext, onMount, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountBadgeOutline.svelte";
    import Calendar from "svelte-material-icons/CalendarMonthOutline.svelte";
    import Markdown from "../Markdown.svelte";
    import Badges from "../profile/Badges.svelte";
    import ChitSummary from "./ChitSummary.svelte";

    const client = getContext<OpenChat>("client");

    type Mode = "edit" | "view";

    interface Props {
        user: UserSummary;
        profile: PublicProfile;
        mode?: Mode;
        buttons?: Snippet;
        showChit?: boolean;
    }

    let { user, profile, mode = "edit", buttons, showChit = true }: Props = $props();

    let me = $derived(user.userId === $currentUserIdStore);

    let lastOnline: number | undefined = $state();

    onMount(async () => {
        try {
            lastOnline = await client.getLastOnlineDate(user.userId, Date.now());
        } catch (_) {}
    });

    let [status] = $derived(
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : ["", false],
    );

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

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }
</script>

<Container direction={"vertical"}>
    <Container
        supplementalClass={"user_background_image"}
        borderRadius={"md"}
        minHeight={"10rem"}
        mainAxisAlignment={"end"}
        padding={"sm"}
        gap={"sm"}
        backgroundImage={backgroundUrl}
        background={defaultBackgroundGradient}>
        {#if buttons !== undefined}
            {@render buttons()}
        {/if}
    </Container>
    <Container
        supplementalClass={"username_and_bio"}
        gap={"xl"}
        padding={["zero", "lg"]}
        direction="vertical">
        <Container gap={"sm"}>
            <Avatar borderWidth={"thick"} size={"xxl"} url={avatarUrl}></Avatar>
            <Container height={{ kind: "fill" }} mainAxisAlignment={"end"} direction={"vertical"}>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <H2 width={{ kind: "hug" }}>{profile.displayName ?? `@${profile.username}`}</H2>
                    <Badges
                        diamondStatus={user.diamondStatus}
                        uniquePerson={user.isUniquePerson}
                        streak={user.streak}
                        chitEarned={user.totalChitEarned} />
                </Container>
                <BodySmall colour={"textSecondary"}>@{user.username}</BodySmall>
            </Container>
        </Container>
        <Body fontWeight={"light"}>
            <Markdown inline={false} text={profile.bio} />
        </Body>

        <Container gap={"sm"} direction={"vertical"}>
            <Container gap={"sm"} crossAxisAlignment={"center"}>
                <div class="icon">
                    <Calendar size={"1.25rem"} color={ColourVars.primary} />
                </div>
                <Container gap={"xs"}>
                    <Body width={{ kind: "hug" }} colour={"textSecondary"}>joined</Body>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}
                        >{formatDate(profile.created)}</Body>
                </Container>
            </Container>
            <Container gap={"sm"} crossAxisAlignment={"center"}>
                <Logo size={"xs"}></Logo>
                <Container gap={"xs"}>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}
                        >{user.totalChitEarned.toLocaleString()}</Body>
                    <Body width={{ kind: "hug" }} colour={"textSecondary"}>CHIT earned</Body>
                </Container>
            </Container>
            <Container gap={"sm"} crossAxisAlignment={"center"}>
                <div class="icon">
                    <Account size={"1.25rem"} color={ColourVars.primary} />
                </div>
                <Container gap={"xs"}>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}>{status}</Body>
                </Container>
            </Container>
        </Container>
    </Container>

    {#if !$disableChit && showChit}
        <Container
            onClick={me ? () => publish("userProfileChitRewards") : undefined}
            padding={["xl", "zero"]}
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

    :global(.container.user_background_image > .icon_button:first-child) {
        margin-inline-end: auto;
    }

    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
