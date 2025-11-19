<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        BigButton,
        Body,
        BodySmall,
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
        publish,
        ROLE_OWNER,
        selectedCommunityMembersStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import NewChannel from "svelte-material-icons/FormatListGroupPlus.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import Edit from "svelte-material-icons/SquareEditOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import Markdown from "../../Markdown.svelte";
    import BotsSummary from "../../membership/BotsSummary.svelte";
    import MembersSummary from "../../membership/MembersSummary.svelte";
    import { CommunityState } from "./communityState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    let communityState = new CommunityState(client, community);

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
    // let canEdit = $derived(client.canEditGroupDetails(chat.id));
    // let rules = $derived($selectedChatRulesStore ?? defaultChatRules(chat.level));
    // let avatarUrl = $derived(client.groupAvatarUrl(chat, $selectedCommunitySummaryStore));
    // let busy = $state(false);
    // let canSend = $derived(client.canSendMessage(chat.id, "any"));
    // let combinedRulesText = $derived(
    //     canSend
    //         ? client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)
    //         : "",
    // );
    //
    function newChannel() {}
    function editCommunity() {}
</script>

<Container
    closeMenuOnScroll
    background={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container gap={"xl"} direction={"vertical"} padding={["lg", "md", "md", "md"]}>
        <!-- this is the group card -->
        <Container direction={"vertical"}>
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
                    <IconButton onclick={newChannel} size={"md"} mode={"dark"}>
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
                        <H2 fontWeight={"bold"} width={{ kind: "hug" }}>{community.name}</H2>
                        <Container gap={"xs"}>
                            <BodySmall colour={"textSecondary"} width={{ kind: "hug" }}>
                                <Translatable resourceKey={i18nKey("owned by")} />
                            </BodySmall>
                            <BodySmall colour={"primary"}>
                                @{owner?.username}
                            </BodySmall>
                        </Container>
                    </Container>
                </Container>

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

                <StatusCard mode="information" title={accessibilityTitle} body={accessibilityInfo}>
                    {#snippet icon(color, size)}
                        <AccountGroup {color} {size} />
                    {/snippet}
                </StatusCard>

                <Body fontWeight={"light"}>
                    <Markdown inline={false} text={community.description} />
                </Body>
            </Container>
        </Container>

        <div class="separator"></div>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <MembersSummary collection={community} />
        </Container>

        <div class="separator"></div>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BotsSummary collection={community} />
        </Container>

        <!-- <div class="separator"></div>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <PermissionsSummary
                permissions={chat.permissions}
                isPublic={chat.public}
                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                isChannel={chat.kind === "channel"}
                embeddedContent={chat.kind === "channel" && chat.externalUrl !== undefined} />
        </Container>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <AccessGateSummary gateConfig={chat.gateConfig} />
        </Container>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <DisappearingMessagesSummary eventsTTL={chat.eventsTTL} />
        </Container>

        {#if combinedRulesText.length > 0}
            <div class="separator"></div>

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Body colour={"textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Group rules")}></Translatable>
                </Body>

                <Body><Markdown inline={false} text={combinedRulesText} /></Body>
            </Container>
        {/if}

        <div class="separator"></div>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Group stats")}></Translatable>
            </BodySmall>
            <Stats showReported={false} stats={chat.metrics} />
        </Container>
 -->
        <!-- {#if client.canDeleteGroup(chat.id)}
            <div class="separator"></div>
            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Delete group")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Keep in mind that by deleting a group all of its data is also removed, and this operation cannot be undone.",
                            )}></Translatable>
                    </Body>
                </Container>

                <Button danger loading={busy} onClick={() => publish("deleteChat", chat)}>
                    {#snippet icon(color)}
                        <Delete {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Delete group")}></Translatable>
                </Button>
            </Container>
        {:else if client.canLeaveGroup(chat.id)}
            <div class="separator"></div>
            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Leave group")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Keep in mind that you may have to pass access gates to re-join later. A group must have at least one owner.",
                            )}></Translatable>
                    </Body>
                </Container>

                <Button loading={busy} onClick={leaveGroup}>
                    {#snippet icon(color)}
                        <Exit {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Leave group")}></Translatable>
                </Button>
            </Container>
        {/if} -->
    </Container>
</Container>

<style lang="scss">
    :global(.container.name_and_description) {
        margin-top: -1.75rem;
    }

    :global(.container.group_details_header > .icon_button:first-child) {
        margin-inline-end: auto;
    }

    .separator {
        height: 6px;
        align-self: stretch;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        margin: 0 var(--sp-md);
    }
</style>
