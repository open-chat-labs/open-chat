<script lang="ts">
    import { Avatar, Column, Option, Row, Search, Select, Subtitle } from "component-lib";
    import { chatIdentifiersEqual, OpenChat, type GroupMatch } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { groupSearchState } from "../../../stores/search.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 15;

    interface Props {
        onSelect: (group: GroupMatch | undefined) => void;
        selected?: GroupMatch;
    }

    let { onSelect, selected }: Props = $props();

    function search(term?: string) {
        if (term === undefined || term === "") {
            reset(true);
            return;
        }
        groupSearchState.term = term;
        groupSearchState.reset();

        client.searchGroups(groupSearchState.term, PAGE_SIZE).then((results) => {
            if (results.kind === "success") {
                groupSearchState.results = results.matches;
                groupSearchState.total = results.total;
            }
        });
    }

    function reset(clearSelected: boolean) {
        groupSearchState.results = [];
        groupSearchState.term = "";
        if (clearSelected) {
            select(undefined);
        }
    }

    function select(match: GroupMatch | undefined) {
        selected = match;
        groupSearchState.results = [];
        onSelect(match);
    }
</script>

<Select
    onSelect={select}
    onOpen={() => search(groupSearchState.term)}
    placeholder={interpolate($_, i18nKey("verified.choose", undefined, "group", true))}
    value={selected}>
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey("verified.choose", undefined, "group", true)}
        ></Translatable>
    {/snippet}
    {#snippet selectedValue(val)}
        {val.name}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Column
            onClick={(e) => e?.stopPropagation()}
            height={{ size: "100%" }}
            supplementalClass={"group_options"}
            padding={"lg"}
            gap={"lg"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("verified.choose", undefined, "group", true)}
                ></Translatable>
            </Subtitle>

            <Search
                onSearch={search}
                onClear={() => (groupSearchState.term = "")}
                searching={false}
                placeholder={interpolate($_, i18nKey("search"))}
                value={groupSearchState.term} />

            <Column supplementalClass={"binding_options"}>
                {#each groupSearchState.results as group (group.chatId.groupId)}
                    <Option
                        padding={["xs", "lg", "xs", "xs"]}
                        value={group}
                        onClick={onSelect}
                        selected={chatIdentifiersEqual(selected?.chatId, group.chatId)}>
                        <Row padding={["zero", "zero"]} gap={"md"} crossAxisAlignment={"center"}>
                            <Avatar
                                url={client.groupAvatarUrl({
                                    ...group,
                                    id: group.chatId,
                                })}
                                size={"lg"} />
                            <Subtitle fontWeight={"bold"}>
                                {group.name}
                            </Subtitle>
                        </Row>
                    </Option>
                {/each}
            </Column>
        </Column>
    {/snippet}
</Select>

<style lang="scss">
    :global(.container.group_options) {
        flex: auto !important;
    }
</style>
