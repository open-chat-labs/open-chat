<script lang="ts">
    import MentionPicker from "./MentionPicker.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, PartialUserSummary, UserSummary } from "openchat-client";
    import { getContext } from "svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");

    export let autofocus: boolean;
    export let selectedReceiver: PartialUserSummary | undefined = undefined;

    let showMentionPicker = false;
    let textValue: string = "";
    let inputHeight: number;

    $: {
        if (textValue !== "") {
            showMentionPicker = true;
        } else {
            showMentionPicker = false;
        }
    }

    function selectReceiver(ev: CustomEvent<UserSummary>) {
        selectedReceiver = ev.detail;
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
                selectedReceiver = client.lookupUserForMention(textValue, false);
            }
            showMentionPicker = false;
        }, 100);
    }
</script>

<div class="selector">
    {#if showMentionPicker}
        <MentionPicker
            offset={inputHeight}
            direction={"down"}
            on:close={() => (showMentionPicker = false)}
            on:mention={selectReceiver}
            border
            prefix={textValue} />
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
