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
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import type { GroupChatSummary, ParticipantRole } from "../../../domain/chat/chat";
    import { toastStore } from "../../../stores/toast";
    import { rollbar } from "../../../utils/logging";

    export let api: ServiceContainer;
    export let chat: GroupChatSummary;
    export let closeIcon: "close" | "back";

    const dispatch = createEventDispatcher();
    let busy = false;
    let usersToAdd: UserSummary[] = [];

    function cancelAddParticipant() {
        dispatch("cancelAddParticipants");
    }

    function rollback() {
        chat.participants = chat.participants.filter((p) => {
            !usersToAdd.map((u) => u.userId).includes(p.userId);
        });
    }

    function complete() {
        busy = true;
        chat.participants = [
            ...usersToAdd.map((u) => ({
                userId: u.userId,
                role: "standard" as ParticipantRole,
            })),
            ...chat.participants,
        ];
        api.addParticipants(
            chat.chatId,
            usersToAdd.map((u) => u.userId)
        )
            .then((resp) => {
                if (resp.kind === "add_participants_success") {
                    cancelAddParticipant();
                    usersToAdd = [];
                } else {
                    // todo - we are not very gracefully handling a number of partial and complete failure
                    // conditions here. Prefer to wait to see what participants and blocked users end up
                    // looking like before handling that better.
                    toastStore.showFailureToast("addParticipantsFailed");
                    rollbar.warn("AddParticipantsFailed", resp);
                    rollback();
                }
            })
            .catch((err) => {
                rollbar.error("AddParticipantsFailed", err);
                toastStore.showFailureToast("addParticipantsFailed");
                rollback();
            })
            .finally(() => (busy = false));
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        usersToAdd = usersToAdd.filter((u) => u.userId !== ev.detail.userId);
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        usersToAdd = [...usersToAdd, ev.detail];
    }
</script>

<SectionHeader>
    <h4>{$_("addParticipants")}</h4>
    <span title={$_("close")} class="close" on:click={cancelAddParticipant}>
        <HoverIcon>
            {#if closeIcon === "close"}
                <Close size={"1.2em"} color={"#aaa"} />
            {:else}
                <ArrowLeft size={"1.2em"} color={"#aaa"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

{#if !busy}
    <div class="find-user">
        <SelectUsers
            {api}
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
        on:click={complete}
        fill={true}>{$_("addParticipants")}</Button>
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
        margin: 0 $sp3;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
</style>
