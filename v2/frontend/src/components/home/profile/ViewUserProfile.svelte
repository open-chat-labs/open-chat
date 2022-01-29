<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import Button from "../../Button.svelte";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import { avatarUrl, userStatus } from "../../../domain/user/user.utils";
    import { rtlStore } from "../../../stores/rtl";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import Overlay from "../../Overlay.svelte";

    const dispatch = createEventDispatcher();

    export let userId: string;
    export let api: ServiceContainer;
    export let anchor: HTMLElement | undefined = undefined;
    export let chatButton = true;

    let style = "visibility: hidden;";
    let bio = "";
    let user: PartialUserSummary | undefined;
    let loaded = false;
    let divElement: HTMLElement;

    $: modal = anchor === undefined;
    $: status = buildStatusAsText(user);

    // TODO:
    // 1. Use Modal component
    // 2. Work out how to build status text in a re-useable way
    // * 3. Open from participant list
    // * 4. In non-modal scenario ensure the popup doesn't go below the bottom by calculating the popup height first
    // 5. Ensure each theme looks right

    onMount(async () => {
        try {
            const task1 = api.getUser(userId);
            const task2 = api.getBio(userId);

            user = await task1;
            bio = await task2;

            loaded = true;

            // TODO: Should use a MutationObserver instead
            setTimeout(() => {
                calculatePosition();
            }, 1);
        } catch (e) {
            console.log(e);
            onClose();
        }
    });

    function calculatePosition() {
        if (anchor !== undefined) {
            let ra = anchor.getBoundingClientRect();
            let rd = divElement.getBoundingClientRect();

            let top = Math.min(ra.top - 8, window.innerHeight - rd.height);

            style = `visibility: visible; top: ${top}px; `;

            if ($rtlStore) {
                style += `right: ${window.innerWidth - ra.left + 8}px;`;
            } else {
                style += `left: ${ra.right + 8}px;`;
            }
        }
    }

    function handleOpenDirectChat() {
        dispatch("openDirectChat");
    }

    function onClose() {
        dispatch("close");
    }

    function buildStatusAsText(user: PartialUserSummary | undefined): string {
        const status = userStatus(Date.now(), user);
        switch (status) {
            case UserStatus.Offline:
                return "Offline";
            case UserStatus.Online:
                return "Online";
            default:
                return "";
        }
    }
</script>

<svelte:window on:resize={onClose} />

{#if loaded}
    <Overlay dismissible={true} fade={modal} on:close={onClose} active={true}>
        <div bind:this={divElement} class="user" {style} class:modal on:click|stopPropagation>
            <Avatar url={avatarUrl(user)} size={AvatarSize.ExtraLarge} />
            {#if user?.username !== undefined}
                <h2>{user.username}</h2>
            {/if}
            {#if status.length > 0}
                <p>{status}</p>
            {/if}
            {#if bio.length > 0}
                <p class="bio"><Markdown text={bio} /></p>
            {/if}
            <div class="buttons">
                {#if chatButton}
                    <Button on:click={handleOpenDirectChat} small={true}>Chat</Button>
                    <div class="spacer" />
                {/if}
                <Button on:click={onClose} small={true} secondary={true}>Close</Button>
            </div>
        </div>
    </Overlay>
{/if}

<style type="text/scss">
    .user {
        background-color: var(--menu-bg);
        border: 1px solid var(--menu-bd);
        box-shadow: var(--menu-sh);

        display: flex;
        flex-direction: column;
        align-items: center;
        position: absolute;
        @include font-size(fs-90);
        width: max-content;
        max-width: 280px;
        padding: $sp4;
        border-radius: $sp3;
        word-wrap: break-word;

        .buttons {
            margin-top: $sp4;
            display: flex;
            justify-content: space-evenly;
            width: 100%;
        }

        &.modal {
            min-width: 300px;
            max-width: 576px;
            max-height: 90%;
            border-radius: 0;

            .bio {
                max-height: none;
            }

            .buttons {
                justify-content: flex-end;
            }
        }

        &.right {
            left: auto;
            right: -4px;

            &:after {
                right: 18px;
                left: auto;
            }
        }

        h2 {
            margin-top: $sp3;
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include nice-scrollbar();
            margin-top: $sp4;
        }

        .spacer {
            width: $sp4;
            height: $sp4;
        }
    }
</style>
