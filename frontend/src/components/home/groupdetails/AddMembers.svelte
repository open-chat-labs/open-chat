<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import SelectUsers from "../SelectUsers.svelte";
    import type { UserSummary } from "../../../domain/user/user";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";

    export let closeIcon: "close" | "back";
    export let busy = false;

    const dispatch = createEventDispatcher();
    let usersToAdd: UserSummary[] = [];

    function cancelAddMember() {
        dispatch("cancelAddMembers");
    }

    function saveMembers() {
        dispatch("saveMembers", usersToAdd);
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        usersToAdd = usersToAdd.filter((u) => u.userId !== ev.detail.userId);
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        usersToAdd = [...usersToAdd, ev.detail];
    }
</script>

<SectionHeader flush={true}>
    <h4>{$_("addMembers")}</h4>
    <span title={$_("close")} class="close" on:click={cancelAddMember}>
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
            mode={"edit"}
            on:selectUser={selectUser}
            on:deleteUser={deleteUser}
            selectedUsers={usersToAdd} />
    </div>
{/if}

{#if busy}
    <Loading />
{/if}

<div class="cta">
    <Button
        disabled={busy || usersToAdd.length === 0}
        loading={busy}
        on:click={saveMembers}
        fill={true}>{$_("addMembers")}</Button>
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
    .find-user {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: $sp3;

        @include size-above(xl) {
            padding: $sp3 0 0 0;
        }
    }
    .cta {
        height: 57px;
    }
</style>
