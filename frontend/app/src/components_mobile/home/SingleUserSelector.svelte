<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { Container, Option, Search, Select, Subtitle } from "component-lib";
    import { i18nKey, type UserOrUserGroup, type UserSummary } from "openchat-client";
    import { type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";
    import MentionPickerLogic from "./MentionPickerLogic.svelte";
    import User from "./User.svelte";

    interface Props {
        selectedReceiver?: UserOrUserGroup | undefined;
        placeholder?: string;
        mentionSelf?: boolean;
        onUserSelected?: (user: UserSummary) => void;
        subtext?: Snippet;
    }

    let {
        selectedReceiver = $bindable(undefined),
        placeholder = interpolate($_, i18nKey("tokenTransfer.chooseReceiver")),
        mentionSelf = false,
        onUserSelected,
        subtext,
    }: Props = $props();

    let searching = $state(false);
    let searchTerm = $state<string>();

    function selectReceiver(userOrGroup: UserOrUserGroup) {
        selectedReceiver = userOrGroup;
        searchTerm = undefined;
        if (userOrGroup.kind === "user") {
            onUserSelected?.(userOrGroup);
        }
    }
</script>

{#snippet match(user: UserOrUserGroup)}
    {#if user.kind === "user"}
        <User profile={false} {searchTerm} onClick={() => selectReceiver(user)} {user} />
    {/if}
{/snippet}

<Select {subtext} onSelect={selectReceiver} {placeholder} value={selectedReceiver}>
    {#snippet selectedValue(val)}
        {#if val.kind === "user"}
            @{val.username}
        {/if}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <MentionPickerLogic prefix={searchTerm} {mentionSelf} onMention={onSelect}>
            {#snippet children(userOrGroupKey, mention, filtered)}
                <Container
                    onClick={(e) => e?.stopPropagation()}
                    height={{ size: "100%" }}
                    supplementalClass={"language_options"}
                    padding={"lg"}
                    gap={"lg"}
                    direction={"vertical"}>
                    <Subtitle fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Select user")}></Translatable>
                    </Subtitle>

                    <Search
                        {searching}
                        id={"search_component"}
                        placeholder={$_("search")}
                        bind:value={searchTerm} />

                    <Container direction={"vertical"}>
                        {#each filtered as user (userOrGroupKey(user))}
                            {#if user}
                                <Option
                                    padding={["sm", "md", "sm", "sm"]}
                                    value={user}
                                    onClick={mention}
                                    selected={false}>
                                    {@render match(user)}
                                </Option>
                            {/if}
                        {/each}
                    </Container>
                </Container>
            {/snippet}
        </MentionPickerLogic>
    {/snippet}
</Select>
