<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        ColourVars,
        Container,
        defaultBackgroundGradient,
        H2,
        IconButton,
    } from "component-lib";
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import {
        defaultChatRules,
        favouritesStore,
        publish,
        selectedChatRulesStore,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Account from "svelte-material-icons/AccountBadgeOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Calendar from "svelte-material-icons/CalendarMonthOutline.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinusOutline.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlusOutline.svelte";
    import Share from "svelte-material-icons/ShareVariantOutline.svelte";
    import SquareEdit from "svelte-material-icons/SquareEditOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import { updateGroupState } from "../createOrUpdateGroup/group.svelte";
    import Markdown from "../Markdown.svelte";
    import Stats from "../Stats.svelte";

    const client = getContext<OpenChat>("client");

    window.publish = publish;

    interface Props {
        chat: MultiUserChat;
        memberCount: number;
    }

    let { chat, memberCount }: Props = $props();

    let canEdit = $derived(client.canEditGroupDetails(chat.id));
    let rules = $derived($selectedChatRulesStore ?? defaultChatRules(chat.level));
    let avatarUrl = $derived(client.groupAvatarUrl(chat, $selectedCommunitySummaryStore));

    function toggleFavourites() {
        if ($favouritesStore.has(chat.id)) {
            client.removeFromFavourites(chat.id);
        } else {
            client.addToFavourites(chat.id);
        }
    }

    function share() {
        console.log("share group");
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

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }

    function deleteGroup() {
        publish("deleteGroup", {
            kind: "delete",
            chatId: chat.id,
            level: "group",
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: chat.name }),
                response: i18nKey(chat.name),
            },
            after: () => publish("closeModalStack"),
        });
    }
</script>

<Container background={ColourVars.background0} height={{ kind: "fill" }} direction={"vertical"}>
    <Container gap={"xl"} direction={"vertical"} padding={["lg", "md", "md", "md"]}>
        <!-- this is the group card -->
        <Container direction={"vertical"}>
            <Container
                supplementalClass={"group_details_header"}
                borderRadius={"md"}
                minHeight={"10rem"}
                mainAxisAlignment={"end"}
                padding={"sm"}
                gap={"sm"}
                background={defaultBackgroundGradient}>
                <IconButton onclick={() => publish("closeModalPage")} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        <ArrowLeft {color} />
                    {/snippet}
                </IconButton>
                <IconButton onclick={toggleFavourites} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        {#if !$favouritesStore.has(chat.id)}
                            <HeartPlus {color} />
                        {:else}
                            <HeartMinus {color} />
                        {/if}
                    {/snippet}
                </IconButton>
                <IconButton onclick={share} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        <Share {color} />
                    {/snippet}
                </IconButton>
                {#if canEdit}
                    <IconButton onclick={editGroup} size={"md"} mode={"dark"}>
                        {#snippet icon(color)}
                            <SquareEdit {color} />
                        {/snippet}
                    </IconButton>
                {/if}
            </Container>
            <Container
                supplementalClass={"name_and_description"}
                gap={"xl"}
                padding={["zero", "lg"]}
                direction="vertical">
                <Container direction={"vertical"} crossAxisAlignment={"center"} gap={"lg"}>
                    <Avatar borderWidth={"thick"} customSize={"10rem"} url={avatarUrl}></Avatar>
                    <Container
                        mainAxisAlignment={"center"}
                        supplementalClass={"group_name"}
                        gap={"xl"}>
                        <H2 colour={"primary"} fontWeight={"bold"} width={{ kind: "hug" }}
                            >{chat.name}</H2>
                    </Container>
                </Container>
                <Body fontWeight={"light"}>
                    <Markdown inline={false} text={chat.description} />
                </Body>

                <Container gap={"sm"} direction={"vertical"}>
                    <Container gap={"sm"} crossAxisAlignment={"center"}>
                        <div class="icon">
                            <Calendar size={"1.25rem"} color={ColourVars.primary} />
                        </div>
                        <Container gap={"xs"}>
                            <Body width={{ kind: "hug" }} colour={"textSecondary"}>created</Body>
                            <Body width={{ kind: "hug" }} fontWeight={"bold"}
                                >{formatDate(BigInt(+new Date()))}</Body>
                        </Container>
                    </Container>
                    <Container gap={"sm"} crossAxisAlignment={"center"}>
                        <div class="icon">
                            <AccountMultiple size={"1.25rem"} color={ColourVars.primary} />
                        </div>
                        <Container gap={"xs"}>
                            <Body width={{ kind: "hug" }} colour={"textSecondary"}>group with</Body>
                            <Body width={{ kind: "hug" }} fontWeight={"bold"}
                                >{memberCount} member</Body>
                        </Container>
                    </Container>
                    <Container gap={"sm"} crossAxisAlignment={"center"}>
                        <div class="icon">
                            <Account size={"1.25rem"} color={ColourVars.primary} />
                        </div>
                        <Container gap={"xs"}>
                            <Body width={{ kind: "hug" }} fontWeight={"bold"}>2 members</Body>
                            <Body width={{ kind: "hug" }} colour={"textSecondary"}>online</Body>
                        </Container>
                    </Container>
                </Container>
            </Container>
        </Container>

        <div class="separator"></div>

        <Container gap={"lg"} direction={"vertical"} padding={["zero", "md"]}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Group stats")}></Translatable>
            </BodySmall>
            <Stats showReported={false} stats={chat.metrics} />
        </Container>

        {#if client.canDeleteGroup(chat.id)}
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

                <Button onClick={deleteGroup}>
                    {#snippet icon(color)}
                        <Delete {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Delete group")}></Translatable>
                </Button>
            </Container>
        {/if}
    </Container>
</Container>

<!-- <Container background={ColourVars.background0} height={{ kind: "fill" }} direction={"vertical"}>
    <GroupDetailsHeader level={chat.level} {canEdit} {onClose} onEditGroup={editGroup} />
    <GroupDetailsBody {chat} {memberCount} />
</Container> -->

<style lang="scss">
    :global(.container.name_and_description) {
        margin-top: -5.75rem;
    }

    :global(.container.group_details_header > .icon_button:first-child) {
        margin-inline-end: auto;
    }

    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    :global(.container.group_name > h2) {
        background: var(--gradient-inverted);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .separator {
        height: 6px;
        align-self: stretch;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        margin: 0 var(--sp-md);
    }
</style>
