<script lang="ts">
    import MentionPicker from "./MentionPicker.svelte";
    import { _ } from "svelte-i18n";
    import type { Member, OpenChat, PartialUserSummary } from "openchat-client";
    import { getContext } from "svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");
    export let blockedUsers: Set<string>;
    export let members: Member[];
    export let autofocus: boolean;
    export let selectedReceiver: PartialUserSummary | undefined = undefined;

    let showMentionPicker = false;
    let textValue: string = "";
    let mentionPicker: MentionPicker;
    let inputHeight: number;

    $: userStore = client.userStore;
    $: {
        if (textValue !== "") {
            showMentionPicker = true;
        } else {
            showMentionPicker = false;
        }
    }

    function selectReceiver(ev: CustomEvent<string>) {
        selectedReceiver = $userStore[ev.detail];
        showMentionPicker = false;
        textValue = "";
    }

    function removeReceiver() {
        selectedReceiver = undefined;
        textValue = "";
    }

    function blur() {
        // we need a short timeout here so that any click event is handled before the blur
        window.setTimeout(() => {
            if (selectedReceiver === undefined) {
                selectedReceiver = mentionPicker?.userFromUsername(textValue);
            }
            showMentionPicker = false;
        }, 100);
    }
</script>

<div class="selector">
    {#if showMentionPicker}
        <MentionPicker
            bind:this={mentionPicker}
            {blockedUsers}
            offset={inputHeight}
            direction={"down"}
            on:close={() => (showMentionPicker = false)}
            on:mention={selectReceiver}
            border
            prefix={textValue}
            {members} />
    {/if}
    {#if selectedReceiver !== undefined}
        <UserPill on:deleteUser={removeReceiver} user={selectedReceiver} />
    {:else}
        <div class="wrapper" bind:clientHeight={inputHeight}>
            <input
                on:blur={blur}
                class:showing-picker={showMentionPicker}
                class="text-box"
                maxlength="100"
                {autofocus}
                bind:value={textValue}
                placeholder={$_("tokenTransfer.chooseReceiver")} />
        </div>
    {/if}
</div>

<style lang="scss">
    .selector {
        position: relative;
        margin-bottom: $sp4;
    }

    .text-box {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;

        @include input();

        &.showing-picker {
            border-radius: $sp2 $sp2 0 0;
            border-bottom: none;
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>
