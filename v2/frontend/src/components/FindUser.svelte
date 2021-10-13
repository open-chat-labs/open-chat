<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { AvatarSize } from "../domain/user/user";
    import type { UserSummary } from "../domain/user/user";
    import { avatarUrl, userStatus } from "../domain/user/user.utils";
    import Avatar from "./Avatar.svelte";
    import Loading from "./Loading.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount } from "svelte";
    import type { ServiceContainer } from "../services/serviceContainer";
    import { userStore } from "../stores/user";
    import { toastStore } from "../stores/toast";

    export let api: ServiceContainer;

    const dispatch = createEventDispatcher();
    let inp: HTMLInputElement;
    let timer: number | undefined = undefined;
    let searchTerm: string = "";
    let users: UserSummary[] = [];
    let searching: boolean = false;

    onMount(() => {
        // this focus seems to cause a problem with the animation of the right panel without
        // this setTimeout. Pretty horrible and who knows if 300 ms will be enough on other machines?
        setTimeout(() => inp.focus(), 300);
    });

    /**
     * This is used both for starting a new direct chat and also for adding a participant to a group chat
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
            searching = true;
            api.searchUsers(value)
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

<div class="search-form">
    <span class="icon"><Magnify color={"#ccc"} /></span>
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
            <div class="user" on:click={() => onSelect(user)}>
                <span class="avatar">
                    <Avatar
                        url={avatarUrl(user)}
                        status={userStatus(user)}
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
        margin-bottom: $sp3;
        align-items: center;
        position: relative;
        padding: $sp2 $sp4;
        border-radius: $sp5;
        border: 1px solid var(--chatSearch-bd);
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
    }

    .user {
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--participants-bd);
        background-color: var(--participants-bg);
        color: var(--participants-txt);
        padding: $sp3;
        margin-bottom: $sp3;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        cursor: pointer;

        &:hover {
            background-color: var(--participants-hv);
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
