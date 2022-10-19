<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { AvatarSize } from "openchat-client";
    import type { UserSummary } from "openchat-client";
    import Avatar from "./Avatar.svelte";
    import Loading from "./Loading.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { toastStore } from "../stores/toast";
    import { iconSize } from "../stores/iconSize";
    import { now } from "../stores/time";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let mode: "add" | "edit";

    const dispatch = createEventDispatcher();
    let inp: HTMLInputElement;
    let timer: number | undefined = undefined;
    let searchTerm: string = "";
    let users: UserSummary[] = [];
    let searching: boolean = false;
    let hovering = false;

    $: userStore = client.userStore;

    onMount(() => {
        // this focus seems to cause a problem with the animation of the right panel without
        // this setTimeout. Pretty horrible and who knows if 300 ms will be enough on other machines?
        setTimeout(() => inp.focus(), 300);
    });

    /**
     * This is used both for starting a new direct chat and also for adding a member to a group chat
     */

    function onSelect(user: UserSummary) {
        dispatch("selectUser", user);
        userStore.add(user);
        searchTerm = "";
        users = [];
        inp.focus();
    }

    function debounce(value: string) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            if (value === "") {
                users = [];
                return;
            }
            searching = true;
            client.api
                .searchUsers(value)
                .then((u) => (users = u))
                .catch((_err) => toastStore.showFailureToast("userSearchFailed"))
                .finally(() => (searching = false));
        }, 350);
    }

    function onInput() {
        debounce(inp.value);
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
        type="text"
        on:input={onInput}
        placeholder={$_("searchForUsername")} />
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
        {#each users as user, _i (user.userId)}
            <div
                class="user"
                on:click={() => onSelect(user)}
                on:mouseenter={() => (hovering = true)}
                on:mouseleave={() => (hovering = false)}>
                <span class="avatar">
                    <Avatar
                        statusBorder={hovering ? "var(--members-hv)" : "var(--members-bg)"}
                        url={client.userAvatarUrl(user)}
                        status={client.userStatus($now, user)}
                        size={AvatarSize.Small} />
                </span>
                <h4 class="details">
                    {user.username}
                </h4>
            </div>
        {/each}
    {/if}
</div>

<style type="text/scss">
    .search-form {
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        border: 1px solid var(--chatSearch-bd);

        &.add {
            margin: 0 0 $sp3 0;
        }

        &.edit {
            margin: 0 0 $sp3 0;
        }
    }
    .icon {
        flex: 0 0 25px;
    }
    .close {
        cursor: pointer;
    }
    input {
        background-color: var(--chatSearch-bg);
        color: var(--chatSearch-txt);
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

    .user {
        display: flex;
        justify-content: center;
        align-items: center;
        border: var(--members-bd);
        border-bottom: var(--members-bdb);
        background-color: var(--members-bg);
        color: var(--members-txt);
        padding: $sp3;
        margin: 0 0 $sp3 0;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        cursor: pointer;

        &:hover {
            background-color: var(--members-hv);
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
    }

    .results {
        position: relative;
        overflow: auto;
        flex: 1;
    }
</style>
