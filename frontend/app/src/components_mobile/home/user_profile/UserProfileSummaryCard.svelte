<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import {
        Avatar,
        Body,
        BodySmall,
        ColourVars,
        Column,
        Container,
        defaultBackgroundGradient,
        H2,
        IconButton,
        Row,
        Sheet,
        Subtitle,
    } from "component-lib";
    import {
        currentUserIdStore,
        i18nKey,
        OpenChat,
        publish,
        percentageStorageUsedStore,
        storageInGBStore,
        type PublicProfile,
        type UserSummary,
    } from "openchat-client";
    import { getContext, onMount, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "@src/stores/toast";
    import Markdown from "../Markdown.svelte";
    import Badges from "../profile/Badges.svelte";
    import ChitSummary from "./ChitSummary.svelte";
    import Translatable from "../../Translatable.svelte";
    import Progress from "../../Progress.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import Lifetime from "svelte-material-icons/DiamondStone.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";

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
    let showAboutSheet = $state(false);

    onMount(async () => {
        try {
            lastOnline = await client.getLastOnlineDate(user.userId, Date.now());
        } catch (_) {}
    });

    // TODO last seen
    let [_status, online] = $derived(
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

    function onCopy() {
        navigator.clipboard.writeText(user.userId).then(() => {
            toastStore.showSuccessToast(i18nKey("userIdCopiedToClipboard"));
        });
    }
</script>

{#snippet accountPill(Icon: any, text: string, colour: string, onClick?: () => void)}
    <Container
        {onClick}
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

{#if showAboutSheet}
    <Sheet onDismiss={() => (showAboutSheet = false)}>
        <Column gap="xs" padding={["lg", "zero", "zero"]}>
            <Row padding={["zero", "xl"]}>
                <Subtitle fontWeight="bold">
                    <Translatable resourceKey={i18nKey("About user")} />
                </Subtitle>
            </Row>
            <Row maxHeight="70vh" overflow="auto" padding={["xl", "xl", "huge"]}>
                <Body fontWeight={"light"} colour="textSecondary">
                    <Markdown inline={false} text={profile.bio} />
                </Body>
            </Row>
        </Column>
    </Sheet>
{/if}

<Container gap={"xxl"} direction={"vertical"}>
    <!-- Cover image -->
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

    <!-- Profile avatar, online status, user name, badges and labels -->
    <Container
        supplementalClass="username_and_bio"
        gap="xl"
        padding={["zero", "lg"]}
        direction="vertical">
        <!-- Avatar and online status! -->
        <Container gap="xs" crossAxisAlignment="end">
            <Avatar borderWidth={"extra-thick"} size={"huge"} url={avatarUrl}></Avatar>
            <Container padding={["md", "zero"]}>
                <Row
                    gap={"xs"}
                    width="hug"
                    padding={["sm", "md"]}
                    borderRadius="circle"
                    backgroundColor={ColourVars.background1}
                    crossAxisSelfAlignment={"end"}>
                    <Body colour="textSecondary">
                        <Translatable resourceKey={i18nKey("Currently")} />
                    </Body>
                    <Row crossAxisAlignment="center" gap="sm">
                        {#if online}
                            <Body colour="success">
                                <Translatable resourceKey={i18nKey("online")} />
                            </Body>
                            <div class="online_status"></div>
                        {:else}
                            <Body colour="warning">
                                <Translatable resourceKey={i18nKey("offline")} />
                            </Body>
                        {/if}
                    </Row>
                </Row>
            </Container>
        </Container>

        <!-- Profile / user name and badges -->
        <Container direction={"vertical"} gap="md">
            <Column gap="xs" padding={["zero", "sm"]}>
                <H2 width={"hug"}>{profile.displayName ?? `@${profile.username}`}</H2>
                <Container gap={"sm"} crossAxisAlignment={"center"}>
                    <Body width={"hug"} colour={"textSecondary"}>@{user.username}</Body>
                    <Badges
                        diamondStatus={user.diamondStatus}
                        uniquePerson={user.isUniquePerson}
                        streak={user.streak}
                        chitEarned={user.totalChitEarned} />
                </Container>
            </Column>
            {#if user.isUniquePerson || user.diamondStatus !== "inactive"}
                <Container padding={["zero", "zero"]} gap={"sm"}>
                    {#if user.diamondStatus === "active"}
                        {@render accountPill(
                            DiamondOutline,
                            "Diamond member",
                            ColourVars.primary,
                            () => publish("upgrade"),
                        )}
                    {:else if user.diamondStatus === "lifetime"}
                        {@render accountPill(Lifetime, "Lifetime member", ColourVars.gradient)}
                    {/if}
                    {#if user.isUniquePerson}
                        {@render accountPill(Check, "Verified account", ColourVars.secondary)}
                    {/if}
                </Container>
            {/if}
        </Container>
    </Container>

    <!-- CHIT and basic info -->
    <Column gap="md">
        {#if !$disableChit && showChit}
            <Container onClick={me ? () => publish("userProfileChitRewards") : undefined}>
                <ChitSummary
                    {mode}
                    streak={user.streak}
                    earned={user.totalChitEarned}
                    balance={user.chitBalance} />
            </Container>
        {/if}

        <!-- Member since-->
        <Column backgroundColor={ColourVars.background1} borderRadius="md" padding={["lg", "xl"]}>
            <BodySmall colour="textSecondary" fontWeight="bold">
                <Translatable resourceKey={i18nKey("Member since")} />
            </BodySmall>
            <Body>{formatDate(profile.created)}</Body>
        </Column>

        <!-- About user -->
        {#if profile.bio && profile.bio.length > 0}
            <Column
                gap="sm"
                borderRadius="md"
                padding={["lg", "xl"]}
                backgroundColor={ColourVars.background1}
                supplementalClass="user_bio"
                onClick={() => (showAboutSheet = true)}>
                <Row mainAxisAlignment="spaceBetween">
                    <BodySmall colour="textSecondary" width="hug" fontWeight="bold">
                        <Translatable resourceKey={i18nKey("About user")} />
                    </BodySmall>
                    <BodySmall colour="primary" fontWeight="bold" width="hug">
                        <Translatable resourceKey={i18nKey("View more")} />
                    </BodySmall>
                </Row>
                <Body fontWeight={"light"}>
                    <Markdown inline={false} text={profile.bio} />
                </Body>
            </Column>
        {/if}

        {#if me}
            <!-- Account principal -->
            <Row
                onClick={onCopy}
                backgroundColor={ColourVars.background1}
                borderRadius="md"
                padding={["lg", "md", "lg", "xl"]}
                crossAxisAlignment="center">
                <Column>
                    <BodySmall colour="textSecondary" fontWeight="bold">
                        <Translatable resourceKey={i18nKey("User & canister id")} />
                    </BodySmall>
                    <Body>{user.userId}</Body>
                </Column>
                <IconButton size={"md"}>
                    {#snippet icon()}
                        <CopyIcon color={ColourVars.primary} size="2rem" />
                    {/snippet}
                </IconButton>
            </Row>

            <!-- Storage usage -->
            <Column
                gap="sm"
                borderRadius="md"
                padding={["lg", "xl"]}
                backgroundColor={ColourVars.background1}>
                <BodySmall colour="textSecondary" fontWeight="bold">
                    <Translatable resourceKey={i18nKey("Online account storage usage")} />
                </BodySmall>
                <Progress
                    colour={ColourVars.secondary}
                    size={"6px"}
                    percent={$percentageStorageUsedStore} />
                <Body>
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
            </Column>
        {/if}
    </Column>
</Container>

<style lang="scss">
    :global(.container.username_and_bio) {
        margin-top: -6.5rem;
    }

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

    .online_status {
        width: 0.5rem;
        height: 0.5rem;
        margin-top: 1px;
        border-radius: var(--rad-circle);
        background-color: var(--success);
    }

    :global(.user_bio .markdown-wrapper) {
        display: -webkit-box !important;
        overflow: hidden;
        line-clamp: 3;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
    }
</style>
