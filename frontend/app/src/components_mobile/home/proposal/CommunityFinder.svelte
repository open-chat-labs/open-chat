<script lang="ts">
    import { Avatar, Column, Option, Row, Search, Select, Subtitle } from "component-lib";
    import { OpenChat, type CommunityMatch } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { communitySearchState } from "../../../stores/search.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 15;

    interface Props {
        onSelect: (community: CommunityMatch | undefined) => void;
        selected?: CommunityMatch;
    }

    let { onSelect, selected }: Props = $props();

    function search(term?: string) {
        if (term === undefined || term === "") {
            reset(true);
            return;
        }
        communitySearchState.term = term;
        communitySearchState.reset();

        client
            .exploreCommunities(
                communitySearchState.term === "" ? undefined : communitySearchState.term,
                communitySearchState.index,
                PAGE_SIZE,
                0,
                [],
            )
            .then((results) => {
                console.log("results", results);
                if (results.kind === "success") {
                    communitySearchState.results = results.matches;
                    communitySearchState.total = results.total;
                }
            });
    }

    function reset(clearSelected: boolean) {
        communitySearchState.results = [];
        communitySearchState.term = "";
        if (clearSelected) {
            select(undefined);
        }
    }

    function select(match: CommunityMatch | undefined) {
        selected = match;
        communitySearchState.results = [];
        onSelect(match);
    }
</script>

<Select
    onSelect={select}
    onOpen={() => search(communitySearchState.term)}
    placeholder={interpolate($_, i18nKey("verified.choose", undefined, "community", true))}
    value={selected}>
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey("verified.choose", undefined, "community", true)}
        ></Translatable>
    {/snippet}
    {#snippet selectedValue(val)}
        {val.name}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Column
            onClick={(e) => e?.stopPropagation()}
            height={{ size: "100%" }}
            supplementalClass={"community_options"}
            padding={"lg"}
            gap={"lg"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("verified.choose", undefined, "community", true)}
                ></Translatable>
            </Subtitle>

            <Search
                onSearch={search}
                onClear={() => (communitySearchState.term = "")}
                searching={false}
                placeholder={interpolate($_, i18nKey("communities.search"))}
                value={communitySearchState.term} />

            <Column supplementalClass={"binding_options"}>
                {#each communitySearchState.results as community (community.id.communityId)}
                    <Option
                        padding={["xs", "lg", "xs", "xs"]}
                        value={community}
                        onClick={onSelect}
                        selected={selected?.id.communityId === community.id.communityId}>
                        <Row padding={["zero", "zero"]} gap={"md"} crossAxisAlignment={"center"}>
                            <Avatar
                                url={client.communityAvatarUrl(
                                    community.id.communityId,
                                    community.avatar,
                                )}
                                size={"lg"} />
                            <Subtitle fontWeight={"bold"}>
                                {community.name}
                            </Subtitle>
                        </Row>
                    </Option>
                {/each}
            </Column>
        </Column>
    {/snippet}
</Select>

<style lang="scss">
    :global(.container.community_options) {
        flex: auto !important;
    }
</style>
