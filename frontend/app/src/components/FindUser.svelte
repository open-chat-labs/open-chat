<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type { UserSummary } from "openchat-client";
    import Loading from "./Loading.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount } from "svelte";
    import { toastStore } from "../stores/toast";
    import { iconSize } from "../stores/iconSize";
    import { i18nKey } from "../i18n/i18n";
    import { translatable } from "../actions/translatable";
    import MatchingUser from "./MatchingUser.svelte";
    import Translatable from "./Translatable.svelte";
    import { trimLeadingAtSymbol } from "../utils/user";
    import { Debouncer } from "../utils/debouncer";

    export let mode: "add" | "edit";
    export let enabled = true;
    export let userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
    export let placeholderKey: string = "searchForUsername";
    export let compact = false;
    export let autofocus = true;

    const dispatch = createEventDispatcher();
    let inp: HTMLInputElement;
    let searchTerm: string = "";
    let communityMembers: UserSummary[] = [];
    let users: UserSummary[] = [];
    let searching: boolean = false;
    let hovering = false;
    const debouncer = new Debouncer(searchUsers, 350);

    onMount(() => {
        // this focus seems to cause a problem with the animation of the right panel without
        // this setTimeout. Pretty horrible and who knows if 300 ms will be enough on other machines?
        if (autofocus) {
            window.setTimeout(() => inp.focus(), 300);
        }
    });

    /**
     * This is used both for starting a new direct chat and also for adding a member to a group chat
     */

    function onSelect(ev: CustomEvent<UserSummary>) {
        dispatch("selectUser", ev.detail);
        searchTerm = "";
        users = [];
        inp.focus();
    }

    function searchUsers(value: string) {
        if (value === "") {
            users = [];
            return;
        }
        searching = true;
        userLookup(value)
            .then((p) => {
                communityMembers = p[0];
                users = p[1];
            })
            .catch((_err) => toastStore.showFailureToast(i18nKey("userSearchFailed")))
            .finally(() => (searching = false));
    }

    function onInput() {
        debouncer.execute(trimLeadingAtSymbol(inp.value));
    }

    function clearFilter() {
        users = [];
        searchTerm = "";
    }
</script>

<div class="search-form" class:add={mode === "add"} class:edit={mode === "edit"}>
    <span class="icon"><Magnify size={$iconSize} color={"#ccc"} viewBox="-5 -3 24 24" /></span>
    <input
        bind:this={inp}
        bind:value={searchTerm}
        disabled={!enabled}
        type="text"
        on:input={onInput}
        use:translatable={{ key: i18nKey(placeholderKey) }}
        placeholder={$_(placeholderKey)} />
    {#if searching}
        <span class="loading" />
    {:else if searchTerm !== ""}
        <span on:click={clearFilter} class="icon close"><Close color={"#ccc"} /></span>
    {/if}
</div>
<div class="results">
    {#if searching}
        <Loading />
    {:else}
        {#if communityMembers?.length > 0}
            <div class="sub-heading">
                <Translatable resourceKey={i18nKey("communityMembers")} />
            </div>
            {#each communityMembers as user (user.userId)}
                <MatchingUser {searchTerm} {user} bind:hovering on:onSelect={onSelect} />
            {/each}
        {/if}
        {#if communityMembers?.length > 0 && users?.length > 0}
            <div class="sub-heading"><Translatable resourceKey={i18nKey("otherUsers")} /></div>
        {/if}
        {#each users as user (user.userId)}
            <MatchingUser {compact} {searchTerm} {user} bind:hovering on:onSelect={onSelect} />
        {/each}
    {/if}
</div>

<style lang="scss">
    .search-form {
        margin: 0 $sp4 $sp4 $sp4;
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        padding: $sp2 $sp4;
        border-radius: var(--rd);

        &.add {
            margin: 0;
        }

        // &.edit {
        //     margin: 0 0 $sp3 0;
        // }

        @include mobile() {
            margin: 0 $sp3;
            margin-bottom: $sp3;
        }
    }
    .icon {
        flex: 0 0 25px;
    }
    .close {
        cursor: pointer;
    }
    input {
        background-color: transparent;
        color: var(--txt);
        outline: none;
        flex: 1;
        padding: $sp3;
        margin: 0;
        border: none;
        width: 100%;
        @include font(book, normal, fs-100);

        &::placeholder {
            color: var(--placeholder);
        }
    }

    .results {
        position: relative;
        overflow: auto;
        flex: 1;
    }
</style>
