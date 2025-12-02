<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import {
        Avatar,
        Body,
        BodySmall,
        Container,
        Option,
        Search,
        Sheet,
        Subtitle,
    } from "component-lib";
    import {
        communitiesStore,
        i18nKey,
        OpenChat,
        ROLE_OWNER,
        serverGroupChatsStore,
        type CommunitySummary,
        type GroupChatSummary,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";
    import NothingToSee from "../home/NothingToSee.svelte";

    const client = getContext<OpenChat>("client");

    type Match = {
        avatarUrl: string;
        name: string;
        id: string;
        isCommunity: boolean;
        collection: GroupChatSummary | CommunitySummary;
    };

    interface Props {
        onSelect: (collection: GroupChatSummary | CommunitySummary) => void;
    }

    let { onSelect }: Props = $props();
    let searchTerm = $state<string>();
    let placeholder = $derived(interpolate($_, i18nKey("Search for a community or group")));
    let results: Match[] = $state([]);

    onMount(() => onPerformSearch(""));

    function onPerformSearch(term?: string) {
        const termLower = term?.toLowerCase();

        const communities: Match[] = [...$communitiesStore.values()]
            .filter(
                (c) =>
                    c.membership.role === ROLE_OWNER &&
                    (termLower === undefined || c.name.toLowerCase().includes(termLower)),
            )
            .map((c) => ({
                avatarUrl: client.communityAvatarUrl(c.id.communityId, c.avatar),
                name: c.name,
                id: c.id.communityId,
                isCommunity: true,
                collection: c as CommunitySummary,
            }));

        const groups: Match[] = [...$serverGroupChatsStore.values()]
            .filter(
                (g) =>
                    g.membership.role === ROLE_OWNER &&
                    (termLower === undefined || g.name.toLowerCase().includes(termLower)),
            )
            .map((g) => ({
                avatarUrl: client.groupAvatarUrl(g),
                name: g.name,
                id: g.id.groupId,
                isCommunity: false,
                collection: g as GroupChatSummary,
            }));

        communities.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        groups.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        results = [...communities, ...groups];
    }
</script>

<Sheet>
    <Container
        height={{ kind: "fixed", size: "100%" }}
        supplementalClass={"token_selector"}
        padding={"lg"}
        gap={"xl"}
        direction={"vertical"}>
        <Container padding={["zero", "sm"]} gap={"md"} crossAxisAlignment={"center"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select installation location")}></Translatable>
            </Subtitle>
        </Container>

        <Search
            onClear={() => (searchTerm = undefined)}
            {placeholder}
            searching={false}
            value={searchTerm}
            onSearch={onPerformSearch} />

        <Container
            padding={["zero", "md"]}
            gap={"lg"}
            supplementalClass={"token_selector"}
            direction={"vertical"}>
            {#if results.length === 0}
                <NothingToSee
                    height={{ kind: "fixed", size: "6" }}
                    padding={"zero"}
                    title={"No matching locations"}
                    subtitle={searchTerm !== ""
                        ? "Try relaxing your search criteria"
                        : "You may not have permission to install this bot anywhere"} />
            {:else}
                {#each results as match (match.id)}
                    <Option
                        onClick={() => onSelect(match.collection)}
                        padding={["zero", "md", "zero", "zero"]}
                        value={match.collection}
                        selected={false}>
                        <Container gap={"md"}>
                            <Avatar url={match.avatarUrl} size={"md"}></Avatar>
                            <Container direction={"vertical"}>
                                <Body>{match.name}</Body>
                                <BodySmall colour={"textSecondary"}>
                                    {#if match.isCommunity}
                                        Community
                                    {:else}
                                        Group chat
                                    {/if}
                                </BodySmall>
                            </Container>
                        </Container>
                    </Option>
                {/each}
            {/if}
        </Container>
    </Container>
</Sheet>
