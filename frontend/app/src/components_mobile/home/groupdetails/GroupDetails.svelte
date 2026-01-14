<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { activeVideoCall } from "@src/stores/video";
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
        ReadMore,
    } from "component-lib";
    import type { CommunityMap, CommunitySummary, MultiUserChat, OpenChat } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        communitiesStore,
        defaultChatRules,
        favouritesStore,
        isDiamondStore,
        publish,
        ROLE_OWNER,
        selectedChatMembersStore,
        selectedChatRulesStore,
        selectedChatSummaryStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import BellOff from "svelte-material-icons/BellOffOutline.svelte";
    import Bell from "svelte-material-icons/BellOutline.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinusOutline.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlusOutline.svelte";
    import Exit from "svelte-material-icons/Logout.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import Edit from "svelte-material-icons/SquareEditOutline.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateSummary from "../AccessGateSummary.svelte";
    import ImportToCommunity from "../communities/Import.svelte";
    import { updateGroupState } from "../createOrUpdateGroup/group.svelte";
    import Markdown from "../Markdown.svelte";
    import BotsSummary from "../membership/BotsSummary.svelte";
    import MembersSummary from "../membership/MembersSummary.svelte";
    import Separator from "../Separator.svelte";
    import Stats from "../Stats.svelte";
    import DisappearingMessagesSummary from "./DisappearingMessagesSummary.svelte";
    import PermissionsSummary from "./PermissionsSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat; // this is NOT reactive - why
        memberCount: number;
    }

    let { chat }: Props = $props();

    let muted = $derived($selectedChatSummaryStore?.membership.notificationsMuted);
    let importToCommunities: CommunityMap<CommunitySummary> | undefined = $state();
    let canImportToCommunity = $derived(!$anonUserStore && client.canImportToCommunity(chat.id));
    let canConvert = $derived(
        !$anonUserStore && chat.kind === "group_chat" && client.canConvertGroupToCommunity(chat.id),
    );
    let ownerMember = $derived(
        [...$selectedChatMembersStore.values()].find((m) => m.role === ROLE_OWNER),
    );
    let owner = $derived(ownerMember ? $allUsersStore.get(ownerMember.userId) : undefined);
    let videoCallInProgress = $derived(chat.videoCallInProgress !== undefined);
    let inCall = $derived(
        videoCallInProgress &&
            $activeVideoCall !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, chat.id),
    );
    let canEdit = $derived(!$anonUserStore && client.canEditGroupDetails(chat.id));
    let canStartVideoCalls = $derived(!$anonUserStore && client.canStartVideoCalls(chat.id));
    let rules = $derived($selectedChatRulesStore ?? defaultChatRules(chat.level));
    let avatarUrl = $derived(client.groupAvatarUrl(chat, $selectedCommunitySummaryStore));
    let busy = $state(false);
    let canSend = $derived(client.canSendMessage(chat.id, "any"));
    let combinedRulesText = $derived(
        canSend
            ? client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)
            : "",
    );

    function toggleFavourites() {
        if ($favouritesStore.has(chat.id)) {
            client.removeFromFavourites(chat.id);
        } else {
            client.addToFavourites(chat.id);
        }
    }

    function convertToCommunity() {
        if (!$isDiamondStore) {
            publish("upgrade");
        } else {
            if (chat.kind === "group_chat") {
                publish("convertGroupToCommunity", chat);
            }
        }
    }

    function importToCommunity() {
        if (chat.kind === "group_chat") {
            importToCommunities = $communitiesStore.filter((c) => c.membership.role === ROLE_OWNER);
            if (importToCommunities.size === 0) {
                toastStore.showFailureToast(i18nKey("communities.noOwned"));
                importToCommunities = undefined;
            }
        }
    }

    function toggleMuteNotifications() {
        publish("toggleMuteNotifications", {
            chatId: chat.id,
            mute: !$selectedChatSummaryStore?.membership.notificationsMuted,
            muteAtEveryone: undefined,
        });
    }

    function editGroup() {
        if (canEdit) {
            updateGroupState.initialise({
                id: chat.id,
                kind: "candidate_group_chat",
                name: chat.name,
                description: chat.description,
                historyVisible: chat.historyVisible,
                public: chat.public,
                frozen: chat.frozen,
                members: [],
                permissions: { ...chat.permissions },
                rules: { ...rules, newVersion: false },
                avatar: {
                    blobReference: chat.blobReference,
                    blobUrl: chat.blobUrl,
                    blobData: chat.blobData,
                },
                gateConfig: { ...chat.gateConfig },
                level: chat.level,
                membership: chat.membership,
                eventsTTL: chat.eventsTTL,
                messagesVisibleToNonMembers: chat.messagesVisibleToNonMembers,
                externalUrl: chat.kind === "channel" ? chat.externalUrl : undefined,
                verified: chat.kind === "group_chat" ? chat.verified : false,
            });
            publish("updateGroup");
        }
    }

    function shareGroup() {
        publish("inviteAndShare", { collection: chat, view: "share" });
    }

    function leaveGroup() {
        busy = true;
        publish("leaveGroup", {
            kind: "leave",
            chatId: chat.id,
            level: chat.level,
        });
    }

    function startVideoCall() {
        if (inCall) {
            publish("hangup");
        } else {
            publish("startVideoCall", {
                chatId: chat.id,
                callType: "default",
                join: videoCallInProgress,
            });
        }
    }
</script>

{#if importToCommunities !== undefined}
    <ImportToCommunity
        groupId={chat.id}
        onCancel={() => (importToCommunities = undefined)}
        ownedCommunities={importToCommunities} />
{/if}

<Container
    closeMenuOnScroll
    background={ColourVars.background0}
    height={"fill"}
    direction={"vertical"}>
    <Container gap={"xl"} direction={"vertical"} padding={["lg", "md", "md", "md"]}>
        <!-- this is the group card -->
        <Container direction={"vertical"}>
            <Container
                supplementalClass={"group_details_header"}
                borderRadius={"md"}
                minHeight={"7rem"}
                mainAxisAlignment={"end"}
                padding={"sm"}
                gap={"sm"}
                background={defaultBackgroundGradient}>
                <IconButton onclick={() => publish("closeModalPage")} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        <ArrowLeft {color} />
                    {/snippet}
                </IconButton>
                {#if canStartVideoCalls}
                    <IconButton onclick={startVideoCall} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <Video {color} />
                        {/snippet}
                    </IconButton>
                {/if}
                {#if canEdit}
                    <IconButton onclick={editGroup} size={"md"} mode={"dark"}>
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
                    <Avatar borderWidth={"thick"} size={"xxl"} url={avatarUrl}></Avatar>
                    <Container
                        direction={"vertical"}
                        mainAxisAlignment={"center"}
                        supplementalClass={"group_name"}>
                        <H2 fontWeight={"bold"} width={"hug"}>{chat.name}</H2>
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
                        <BigButton onClick={toggleFavourites}>
                            {#snippet icon(color, size)}
                                {#if !$favouritesStore.has(chat.id)}
                                    <HeartPlus {color} {size} />
                                {:else}
                                    <HeartMinus {color} {size} />
                                {/if}
                            {/snippet}
                            {#if $favouritesStore.has(chat.id)}
                                <Translatable resourceKey={i18nKey("Remove favourite")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("Add favourite")} />
                            {/if}
                        </BigButton>
                        <BigButton onClick={toggleMuteNotifications}>
                            {#snippet icon(color, size)}
                                {#if muted}
                                    <Bell {color} {size} />
                                {:else}
                                    <BellOff {color} {size} />
                                {/if}
                            {/snippet}
                            <Translatable
                                resourceKey={i18nKey(muted ? "Unmute chat" : "Mute chat")} />
                        </BigButton>
                        <BigButton onClick={shareGroup}>
                            {#snippet icon(color, size)}
                                <Share {color} {size} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Share chat")} />
                        </BigButton>
                    </Container>
                {/if}

                <ReadMore>
                    <Body fontWeight={"light"}>
                        <Markdown inline={false} text={chat.description} />
                    </Body>
                </ReadMore>
            </Container>
        </Container>

        <MembersSummary collection={chat} />

        <BotsSummary collection={chat} />

        <PermissionsSummary
            permissions={chat.permissions}
            isPublic={chat.public}
            isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
            isChannel={chat.kind === "channel"}
            embeddedContent={chat.kind === "channel" && chat.externalUrl !== undefined} />

        <AccessGateSummary gateConfig={chat.gateConfig} />

        <DisappearingMessagesSummary eventsTTL={chat.eventsTTL} />

        {#if combinedRulesText.length > 0}
            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Body colour={"textSecondary"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Group rules")}></Translatable>
                </Body>

                <Body><Markdown inline={false} text={combinedRulesText} /></Body>
            </Container>
        {/if}

        <Separator />

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Group stats")}></Translatable>
            </BodySmall>
            <Stats showReported={false} stats={chat.metrics} />
        </Container>

        {#if canConvert}
            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Convert to community")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "If your group is growing, and you would like to support multiple conversation streams, it might be time to convert to a community.",
                            )}></Translatable>
                    </Body>
                </Container>

                <Button loading={busy} onClick={convertToCommunity}>
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Convert to community")}></Translatable>
                </Button>
            </Container>
        {/if}

        {#if canImportToCommunity}
            <Separator />

            <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
                <Container direction={"vertical"} gap={"sm"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Import to community")}></Translatable>
                    </Body>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Convert this group into a channel and import it into an existing community.",
                            )}></Translatable>
                    </Body>
                </Container>

                <Button loading={busy} onClick={importToCommunity}>
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Import to community")}></Translatable>
                </Button>
            </Container>
        {/if}

        {#if !$anonUserStore && client.canDeleteGroup(chat.id)}
            <Separator />

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
        {:else if !$anonUserStore && client.canLeaveGroup(chat.id)}
            <Separator />

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
        {/if}
    </Container>
</Container>

<style lang="scss">
    :global(.container.name_and_description) {
        margin-top: -1.75rem;
    }

    :global(.container.group_details_header > .icon_button:first-child) {
        margin-inline-end: auto;
    }
</style>
