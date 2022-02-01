<script lang="ts">
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Button from "../../Button.svelte";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import { avatarUrl, formatLastOnlineDate } from "../../../domain/user/user.utils";
    import { rtlStore } from "../../../stores/rtl";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { ScreenWidth, screenWidth } from "../../../stores/screenDimensions";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";

    const api: ServiceContainer = getContext(apiKey);
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let anchor: HTMLElement | undefined = undefined;
    export let chatButton = true;

    let bio = "";
    let user: PartialUserSummary | undefined;
    let loaded = false;
    let divElement: HTMLElement;

    $: mobile = $screenWidth === ScreenWidth.ExtraSmall;
    $: modal = anchor === undefined || mobile;
    $: status = formatLastOnlineDate(Date.now(), user);
    $: style = modal ? "visibility: visible;" : "visibility: hidden;";

    onMount(async () => {
        try {
            const task1 = api.getUser(userId);
            const task2 = api.getBio(userId);
            user = await task1;
            bio = await task2;
            loaded = true;

            if (!modal) {
                await tick();
                calculatePosition();
            }
        } catch (e) {
            console.log(e);
            onClose();
        }
    });

    function calculatePosition() {
        if (anchor !== undefined) {
            let modalDiv = divElement.parentElement?.parentElement!;
            let rd = modalDiv.getBoundingClientRect();
            let ra = anchor.getBoundingClientRect();
            let top = Math.min(ra.top - 8, window.innerHeight - rd.height);

            style = `position: absolute; visibility: visible; top: ${top}px; `;

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

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
    }
</script>

<svelte:window on:resize={onWindowResize} />

<Overlay dismissible={true} fade={modal} on:close={onClose} active={loaded}>
    <ModalContent
        hideHeader={true}
        compactFooter={true}
        fixedWidth={false}
        large={modal}
        {style}
        on:close>
        <div slot="body" bind:this={divElement} class="body" class:modal>
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
        </div>
        <div slot="footer" class="footer">
            {#if chatButton}
                <Button on:click={handleOpenDirectChat} small={true}>Chat</Button>
                <div class="spacer" />
            {/if}
            <Button on:click={onClose} small={true} secondary={true}>Close</Button>
        </div>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        @include font-size(fs-90);
        word-wrap: break-word;
        min-width: 200px;
        max-width: 280px;

        h2 {
            margin-top: $sp3;
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include nice-scrollbar();
            margin-top: $sp4;
        }

        &.modal {
            max-width: 400px;

            .bio {
                max-height: none;
            }
        }
    }

    .footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;

        .spacer {
            width: $sp3;
            height: $sp3;
        }
    }
</style>
