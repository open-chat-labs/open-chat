<script lang="ts">
    import MentionPicker from "./MentionPicker.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let autofocus: boolean;
    export let selectedReceiver: UserOrUserGroup | undefined = undefined;
    export let direction: "up" | "down" = "down";
    export let placeholder: string = "tokenTransfer.chooseReceiver";

    let showMentionPicker = false;
    let textValue: string = "";
    let inputHeight: number;

    function selectReceiver(ev: CustomEvent<UserOrUserGroup>) {
        selectedReceiver = ev.detail;
        showMentionPicker = false;
        textValue = "";
        if (ev.detail.kind === "user") {
            dispatch("userSelected", ev.detail);
        }
    }

    function removeReceiver() {
        selectedReceiver = undefined;
        showMentionPicker = true;
        textValue = "";
        dispatch("userRemoved");
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
            on:mention={selectReceiver}
            border
            usersOnly
            prefix={textValue.startsWith("@") ? textValue.substring(1) : textValue} />
    {/if}
    {#if selectedReceiver !== undefined}
        <UserPill on:deleteUser={removeReceiver} userOrGroup={selectedReceiver} />
    {:else}
        <div class="wrapper" bind:clientHeight={inputHeight}>
            <input
                on:focus={() => (showMentionPicker = true)}
                on:blur={blur}
                class:showing-picker={showMentionPicker}
                class="text-box"
                maxlength="100"
                {autofocus}
                bind:value={textValue}
                placeholder={$_(placeholder)} />
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

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>
