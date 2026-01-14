<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        BigButton,
        Body,
        BodySmall,
        Button,
        ColourVars,
        Container,
        defaultBackgroundGradient,
        H2,
        IconButton,
        StatusCard,
    } from "component-lib";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        defaultChatRules,
        publish,
        ROLE_NONE,
        ROLE_OWNER,
        selectedCommunityMembersStore,
        selectedCommunityRulesStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import NewChannel from "svelte-material-icons/FormatListGroupPlus.svelte";
    import Exit from "svelte-material-icons/Logout.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import Edit from "svelte-material-icons/SquareEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import AccessGateSummary from "../../AccessGateSummary.svelte";
    import { updateGroupState } from "../../createOrUpdateGroup/group.svelte";
    import Markdown from "../../Markdown.svelte";
    import BotsSummary from "../../membership/BotsSummary.svelte";
    import MembersSummary from "../../membership/MembersSummary.svelte";
    import Separator from "../../Separator.svelte";
    import Stats from "../../Stats.svelte";
    import { updateCommunityState } from "../createOrUpdate/community.svelte";
    import { CommunityState } from "./communityState.svelte";
    import PermissionsSummary from "./PermissionsSummary.svelte";
    import UserGroupSummary from "./UserGroupSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    let communityState = new CommunityState(client, community);
    let busy = $state(false);
    let ownerMember = $derived(
        [...$selectedCommunityMembersStore.values()].find((m) => m.role === ROLE_OWNER),
    );
    let owner = $derived(ownerMember ? $allUsersStore.get(ownerMember.userId) : undefined);
    let canCreateChannel = $derived(communityState.canCreateChannel());
    let accessibilityTitle = $derived(community.public ? "Public community" : "Private community");
    let accessibilityInfo = $derived(
        community.public
            ? "This is a public community. Anyone will be able to discover and join this community."
            : "This is a private community. Only people who are invited will be able to join this community.",
    );
    let canEdit = $derived(communityState.canEditCommunity());
    let rules = $derived($selectedCommunityRulesStore ?? defaultChatRules("community"));

    function newChannel(embedded: boolean) {
        if (canCreateChannel) {
            updateGroupState.initialise(client.createCandidateGroup("channel", embedded));
            publish("newChannel", embedded);
        }
    }

    function editCommunity() {
        if (canEdit) {
            updateCommunityState.initialise(community, rules);
            publish("updateCommunity");
        }
    }

    function leaveCommunity() {
        publish("leaveCommunity", {
            kind: "leave_community",
            communityId: community.id,
        });
    }
</script>

<Container
    closeMenuOnScroll
    background={ColourVars.background0}
    height={"fill"}
    direction={"vertical"}>
    <Container gap={"xl"} direction={"vertical"} padding={["lg", "md", "md", "md"]}>
        <!-- this is the group card -->
        <Container gap={"lg"} direction={"vertical"}>
            <Container
                supplementalClass={"group_details_header"}
                borderRadius={"md"}
                minHeight={"11rem"}
                mainAxisAlignment={"end"}
                padding={"sm"}
                gap={"sm"}
                background={communityState.bannerUrl() ?? defaultBackgroundGradient}>
                <IconButton onclick={() => publish("closeModalPage")} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        <ArrowLeft {color} />
                    {/snippet}
                </IconButton>
                {#if canCreateChannel}
                    <IconButton onclick={() => newChannel(false)} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <NewChannel {color} />
                        {/snippet}
                    </IconButton>
                {/if}
                {#if canEdit}
                    <IconButton onclick={editCommunity} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <Edit {color} />
                        {/snippet}
                    </IconButton>
                {/if}
            </Container>
            <Container
                supplementalClass={"name_and_description"}
                gap={"xl"}
                padding={["zero", "lg"]}
                direction="vertical">
                <Container crossAxisAlignment={"end"} gap={"md"}>
                    <Avatar
                        radius={"lg"}
                        borderWidth={"thick"}
                        size={"xxl"}
                        url={communityState.avatarUrl()}></Avatar>
                    <Container
                        direction={"vertical"}
                        mainAxisAlignment={"center"}
                        supplementalClass={"group_name"}>
                        <H2 fontWeight={"bold"} width={"hug"}>{community.name}</H2>
                        <Container gap={"xs"}>
                            <BodySmall colour={"textSecondary"} width={"hug"}>
                                <Translatable resourceKey={i18nKey("owned by")} />
                            </BodySmall>
                            <BodySmall colour={"primary"}>
                                @{owner?.username}
                            </BodySmall>
                        </Container>
                    </Container>
                </Container>

                {#if !$anonUserStore}
                    <Container gap={"sm"}>
                        <BigButton onClick={() => communityState.muteAllChannels()}>
                            {#snippet icon(color, size)}
                                <BellOff {color} {size} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Mute all channels")} />
                        </BigButton>
                        <BigButton onClick={() => communityState.share()}>
                            {#snippet icon(color, size)}
                                <Share {color} {size} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Share")} />
                        </BigButton>
                    </Container>
                {/if}
            </Container>

            <StatusCard mode="information" title={accessibilityTitle} body={accessibilityInfo}>
                {#snippet icon(color, size)}
                    <AccountGroup {color} {size} />
                {/snippet}
            </StatusCard>

            <Container padding={["zero", "lg"]} direction="vertical">
                <Body fontWeight={"light"}>
                    <Markdown inline={false} text={community.description} />
                </Body>
            </Container>
        </Container>

        <MembersSummary collection={community} />

        <BotsSummary collection={community} />

        <UserGroupSummary {communityState} />

        <PermissionsSummary permissions={community.permissions} isPublic={community.public} />

        <AccessGateSummary gateConfig={community.gateConfig} />

        {#if rules.enabled}
            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Body colour={"textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Community rules")}></Translatable>
                </Body>

                <Body><Markdown inline={false} text={rules.text} /></Body>
            </Container>
        {/if}

        <Separator />

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Community stats")}></Translatable>
            </BodySmall>
            <Stats showReported={false} stats={community.metrics} />
        </Container>

        {#if canCreateChannel}
            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Add new channel")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Add a new channel to this community")}
                        ></Translatable>
                    </Body>
                </Container>

                <Button onClick={() => newChannel(false)}>
                    {#snippet icon(color)}
                        <NewChannel {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Add channel")}></Translatable>
                </Button>
            </Container>

            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Add embedded channel")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Add an embedded channel to display third party content to this community.",
                            )}></Translatable>
                    </Body>
                </Container>

                <Button onClick={() => newChannel(true)}>
                    {#snippet icon(color)}
                        <Pound {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Add embedded channel")}></Translatable>
                </Button>
            </Container>

            {#if client.canDeleteCommunity(community.id)}
                <Separator />

                <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                    <Container direction={"vertical"} gap={"sm"}>
                        <Body fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Delete community")}></Translatable>
                        </Body>
                        <Body colour={"textSecondary"}>
                            <Translatable
                                resourceKey={i18nKey(
                                    "Keep in mind that by deleting a community all of its data is also removed, and this operation cannot be undone.",
                                )}></Translatable>
                        </Body>
                    </Container>

                    <Button
                        danger
                        loading={busy}
                        onClick={() => publish("deleteCommunityMobile", community)}>
                        {#snippet icon(color)}
                            <Delete {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Delete community")}></Translatable>
                    </Button>
                </Container>
            {:else if community.membership.role !== ROLE_NONE}
                <Separator />

                <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                    <Container direction={"vertical"} gap={"sm"}>
                        <Body fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Leave community")}></Translatable>
                        </Body>
                        <Body colour={"textSecondary"}>
                            <Translatable
                                resourceKey={i18nKey(
                                    "Keep in mind that you may have to pass access gates to re-join later. A community must have at least one owner.",
                                )}></Translatable>
                        </Body>
                    </Container>

                    <Button loading={busy} onClick={leaveCommunity}>
                        {#snippet icon(color)}
                            <Exit {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Leave community")}></Translatable>
                    </Button>
                </Container>
            {/if}
        {/if}
    </Container>
</Container>

<style lang="scss">
    :global(.container.name_and_description) {
        margin-top: -1.75rem;
    }

    :global(.container.group_details_header) {
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    :global(.container.group_details_header > .icon_button:first-child) {
        margin-inline-end: auto;
    }
</style>
