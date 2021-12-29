<script lang="ts">
    import type { Participant } from "domain/chat/chat";
    import { userStore } from "stores/user";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";

    export let participants: Participant[];
    export let prefix: string | undefined;

    let index = 0;

    $: filtered = participants.filter(
        (p) =>
            prefix === undefined || $userStore[p.userId]?.username?.toLowerCase().startsWith(prefix)
    );

    const dispatch = createEventDispatcher();

    // todo - this should use the virtual list
    // todo - the styling here is going to be very similar to a context menu. Is there something more generic to be extracted?
    function mention(userId: string) {
        dispatch("mention", userId);
    }

    function onKeyDown(ev: KeyboardEvent): void {
        console.log("Key: ", ev.key);
        switch (ev.key) {
            case "ArrowDown":
                index = (index + 1) % filtered.length;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "ArrowUp":
                index = index === 0 ? filtered.length - 1 : index - 1;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Escape":
                dispatch("close");
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Enter":
                const user = filtered[index];
                if (user) {
                    mention(user.userId);
                }
                ev.preventDefault();
                ev.stopPropagation();
                break;
        }
    }
</script>

<div class="mention-picker">
    {#each filtered as participant, i (participant.userId)}
        <div
            class:current={i === index}
            class="mention"
            on:click={() => mention(participant.userId)}>
            {`@${$userStore[participant.userId]?.username ?? $_("unknown")}`}
        </div>
    {/each}
</div>

<svelte:body on:keydown={onKeyDown} />

<style type="text/scss">
    .mention-picker {
        position: absolute;
        bottom: 50px;
        background-color: var(--entry-bg);
    }

    .mention {
        cursor: pointer;
        padding: $sp4;
        border-bottom: 1px solid var(--menu-bd);
        min-width: 200px;
        color: var(--menu-txt);
        @include font(book, normal, fs-90);

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--menu-hv);
        }

        &.current {
            background-color: red;
        }
    }
</style>
