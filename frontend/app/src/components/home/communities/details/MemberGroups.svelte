<script lang="ts">
    import SectionHeader from "../../../SectionHeader.svelte";
    import Loading from "../../../Loading.svelte";
    import Button from "../../../Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import SelectUsers from "../../SelectUsers.svelte";
    import type { UserSummary } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../../stores/iconSize";

    export let closeIcon: "close" | "back";

    const dispatch = createEventDispatcher();
    let usersToInvite: UserSummary[] = [];
    let busy = false;

    const userLookup = (searchTerm: string, maxResults?: number): Promise<UserSummary[]> => {
        console.log("Search term: ", searchTerm, maxResults);
        return Promise.resolve([]);
    };

    function cancelInviteUsers() {
        dispatch("cancelInviteUsers");
    }

    function inviteUsers() {
        dispatch("inviteUsers", usersToInvite);
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        usersToInvite = usersToInvite.filter((u) => u.userId !== ev.detail.userId);
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        usersToInvite = [...usersToInvite, ev.detail];
    }
</script>

<SectionHeader border={false} flush>
    <h4>{$_("communities.memberGroups")}</h4>
    <span title={$_("close")} class="close" on:click={cancelInviteUsers}>
        <HoverIcon>
            {#if closeIcon === "close"}
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

{#if !busy}
    <div class="find-user">
        <SelectUsers
            {userLookup}
            mode={"edit"}
            on:selectUser={selectUser}
            on:deleteUser={deleteUser}
            selectedUsers={usersToInvite} />
    </div>
{/if}

{#if busy}
    <Loading />
{/if}

<div class="cta">
    <Button
        disabled={busy || usersToInvite.length === 0}
        loading={busy}
        square
        on:click={inviteUsers}
        fill>{"Whatever"}</Button>
</div>

<style lang="scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
    .find-user {
        flex: 1;
        display: flex;
        flex-direction: column;

        @include size-above(xl) {
            padding: 0;
        }
    }
    .cta {
        flex: 0 0 toRem(60);
    }
</style>
