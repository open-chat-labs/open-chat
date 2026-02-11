<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { Avatar, Body, BodySmall, Column, Option, Row, Search, Select } from "component-lib";
    import {
        communitiesStore,
        i18nKey,
        OpenChat,
        serverGroupChatsStore,
        type BotInstallationLocation,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import NothingToSee from "../home/NothingToSee.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    type Match = {
        avatarUrl: string;
        name: string;
        id: string;
        isCommunity: boolean;
    };

    interface Props {
        location?: BotInstallationLocation;
    }

    let { location = $bindable() }: Props = $props();
    let searchTerm: string = $state("");
    let placeholder = i18nKey("Search for a community or group");
    let selected = $state<Match>();
    let searchTermLower = $derived(searchTerm.toLocaleLowerCase());
    location; // usual hack

    let options = $derived.by(() => {
        const communities: Match[] = [...$communitiesStore.values()].map((c) => ({
            avatarUrl: client.communityAvatarUrl(c.id.communityId, c.avatar),
            name: c.name,
            id: c.id.communityId,
            isCommunity: true,
        }));

        const groups: Match[] = [...$serverGroupChatsStore.values()].map((g) => ({
            avatarUrl: client.groupAvatarUrl(g),
            name: g.name,
            id: g.id.groupId,
            isCommunity: false,
        }));

        communities.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        groups.sort((a: Match, b: Match) => a.name.localeCompare(b.name));
        return [...communities, ...groups];
    });

    let matches = $derived(
        options.filter(
            (o) => searchTermLower === "" || o.name.toLocaleLowerCase().includes(searchTermLower),
        ),
    );

    function reset() {
        selected = undefined;
        searchTerm = "";
    }

    function select(match: Match | undefined) {
        selected = match;
        if (match !== undefined) {
            if (match.isCommunity) {
                location = { kind: "community", communityId: match.id };
            } else {
                location = { kind: "group_chat", groupId: match.id };
            }
        }
    }
</script>

<Select
    placeholder={interpolate($_, i18nKey("bots.builder.testContext"))}
    onSelect={select}
    value={selected}>
    {#snippet selectedValue(match)}
        {match.name}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Column gap={"xl"} padding={"xl"}>
            <Column padding={["zero", "sm"]} gap={"md"} crossAxisAlignment={"center"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("bots.builder.testContext")}></Translatable>
                </Body>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("bots.builder.testContextExplanation")}
                    ></Translatable>
                </BodySmall>
            </Column>

            <Search
                placeholder={interpolate($_, placeholder)}
                searching={false}
                bind:value={searchTerm}
                onClear={reset} />

            <Column padding={["zero", "md"]} gap={"lg"}>
                {#if matches.length === 0}
                    <NothingToSee
                        height={{ size: "6" }}
                        padding={"zero"}
                        title={"No matching locations"}
                        subtitle={searchTerm !== ""
                            ? "Try relaxing your search criteria"
                            : "You may not be a member of any groups or communities"} />
                {:else}
                    {#each matches as match (match.id)}
                        <Option
                            onClick={() => onSelect(match)}
                            padding={["zero", "md", "zero", "zero"]}
                            value={match}
                            selected={false}>
                            <Row gap={"md"}>
                                <Avatar url={match.avatarUrl} size={"md"}></Avatar>
                                <Column>
                                    <Body>{match.name}</Body>
                                    <BodySmall colour={"textSecondary"}>
                                        {#if match.isCommunity}
                                            Test in community
                                        {:else}
                                            Test in chat
                                        {/if}
                                    </BodySmall>
                                </Column>
                            </Row>
                        </Option>
                    {/each}
                {/if}
            </Column>
        </Column>
    {/snippet}
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey("bots.builder.testContextInfo")} />
    {/snippet}
</Select>
