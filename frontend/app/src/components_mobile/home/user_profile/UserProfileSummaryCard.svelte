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
        ReadMore,
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
    import Calendar from "svelte-material-icons/CalendarMonthOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
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

    let [status, online] = $derived(
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : ["", false],
    );

    let avatarUrl = $derived(client.userAvatarUrl(user));

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

{#snippet accountPill(Icon: any, text: string, colour: string)}
    <Container
        width={"hug"}
        background={colour}
        gap={"xs"}
        crossAxisAlignment={"center"}
        padding={["xs", "md"]}
        borderRadius={"circle"}>
        <Icon color={ColourVars.textPrimary} />
        <BodySmall>{text}</BodySmall>
    </Container>
{/snippet}

<Container gap={"lg"} direction={"vertical"}>
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
        <Container gap={"xs"}>
            <Avatar borderWidth={"extra-thick"} size={"huge"} url={avatarUrl}></Avatar>
            <Container gap={"xs"} crossAxisSelfAlignment={"end"} direction={"vertical"}>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <div class="icon">
                        <Calendar size={"1.25rem"} color={ColourVars.primary} />
                    </div>
                    <Container gap={"xs"}>
                        <Body width={"hug"} colour={"textSecondary"}>joined</Body>
                        <Body width={"hug"} fontWeight={"bold"}>{formatDate(profile.created)}</Body>
                    </Container>
                </Container>
                <Container gap={"sm"} crossAxisAlignment={"center"} width={"hug"}>
                    <Body width={"hug"} fontWeight={"bold"}>{status}</Body>
                    {#if online}
                        <div class="online"></div>
                    {/if}
                </Container>
            </Container>
        </Container>
        <Container direction={"vertical"}>
            <H2 width={"hug"}>{profile.displayName ?? `@${profile.username}`}</H2>
            <Container gap={"sm"} crossAxisAlignment={"center"}>
                <BodySmall width={"hug"} colour={"textSecondary"}>@{user.username}</BodySmall>
                <Badges
                    diamondStatus={user.diamondStatus}
                    uniquePerson={user.isUniquePerson}
                    streak={user.streak}
                    chitEarned={user.totalChitEarned} />
            </Container>
            {#if user.isUniquePerson || user.diamondStatus !== "inactive"}
                <Container padding={["sm", "zero"]} gap={"sm"}>
                    {#if user.diamondStatus === "active"}
                        {@render accountPill(DiamondOutline, "Diamond member", ColourVars.primary)}
                    {:else if user.diamondStatus === "lifetime"}
                        {@render accountPill(
                            DiamondOutline,
                            "Lifetime member",
                            ColourVars.gradient,
                        )}
                    {/if}
                    {#if user.isUniquePerson}
                        {@render accountPill(Check, "Verified account", ColourVars.secondary)}
                    {/if}
                </Container>
            {/if}
        </Container>
        <ReadMore>
            <Body fontWeight={"light"}>
                <Markdown inline={false} text={profile.bio} />
            </Body>
        </ReadMore>
    </Container>
    {#if !$disableChit && showChit}
        <Container
            onClick={me ? () => publish("userProfileChitRewards") : undefined}
            direction={"vertical"}
            padding={["zero", "zero", "xl", "zero"]}
            overflow={"visible"}>
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
        margin-top: -5rem;
    }

    /* :global(.container.user_background_image > .icon_button:first-child) {
        margin-inline-end: auto;
    } */

    .online {
        border-radius: var(--rad-circle);
        width: 0.5rem;
        height: 0.5rem;
        background-color: var(--success);
    }

    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
