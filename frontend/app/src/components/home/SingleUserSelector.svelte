<script lang="ts">
    import MentionPicker from "./MentionPicker.svelte";
    import { _ } from "svelte-i18n";
    import {
        i18nKey,
        type OpenChat,
        type ResourceKey,
        type UserOrUserGroup,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import UserPill from "../UserPill.svelte";
    import ValidatingInput from "../bots/ValidatingInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        autofocus: boolean;
        selectedReceiver?: UserOrUserGroup | undefined;
        direction?: "up" | "down";
        placeholder?: string;
        border?: boolean;
        mentionSelf?: boolean;
        error?: ResourceKey[];
        invalid?: boolean;
        onUserSelected?: (user: UserSummary) => void;
        onUserRemoved?: () => void;
    }

    let {
        autofocus,
        selectedReceiver = $bindable(undefined),
        direction = "down",
        placeholder = "tokenTransfer.chooseReceiver",
        border = true,
        mentionSelf = false,
        error = [],
        invalid = false,
        onUserSelected,
        onUserRemoved,
    }: Props = $props();

    let showMentionPicker = $state(false);
    let textValue: string = $state("");
    let inputHeight: number = $state(0);

    function selectReceiver(userOrGroup: UserOrUserGroup) {
        selectedReceiver = userOrGroup;
        showMentionPicker = false;
        textValue = "";
        if (userOrGroup.kind === "user") {
            onUserSelected?.(userOrGroup);
        }
    }

    function removeReceiver(_: UserOrUserGroup) {
        selectedReceiver = undefined;
        showMentionPicker = true;
        textValue = "";
        onUserRemoved?.();
    }

    function blur() {
        // we need a short timeout here so that any click event is handled before the blur
        window.setTimeout(() => {
            if (selectedReceiver === undefined) {
                selectedReceiver = client.lookupUserForMention(textValue, false);
            }
            showMentionPicker = false;
        }, 200);
    }
</script>

<div class="selector">
    {#if showMentionPicker}
        <MentionPicker
            offset={inputHeight}
            {direction}
            {mentionSelf}
            onMention={selectReceiver}
            onClose={() => (showMentionPicker = false)}
            {border}
            usersOnly
            prefix={textValue.startsWith("@") ? textValue.substring(1) : textValue} />
    {/if}
    {#if selectedReceiver !== undefined}
        <UserPill onDeleteUser={removeReceiver} userOrGroup={selectedReceiver} />
    {:else}
        <div class="wrapper" bind:clientHeight={inputHeight}>
            <ValidatingInput
                onFocus={() => (showMentionPicker = true)}
                onBlur={blur}
                {invalid}
                {error}
                {autofocus}
                bind:value={textValue}
                maxlength={100}
                placeholder={i18nKey(placeholder)}>
            </ValidatingInput>
        </div>
    {/if}
</div>

<style lang="scss">
    .selector {
        position: relative;
        margin-bottom: $sp4;
    }
</style>
