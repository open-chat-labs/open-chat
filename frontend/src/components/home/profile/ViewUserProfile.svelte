<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import { avatarUrl, formatLastOnlineDate } from "../../../domain/user/user.utils";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import { rollbar } from "../../../utils/logging";

    const api: ServiceContainer = getContext(apiKey);
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let alignTo: DOMRect | undefined = undefined;
    export let chatButton = true;

    let bio = "";
    let user: PartialUserSummary | undefined;
    let loaded = false;

    $: modal = alignTo === undefined || $mobileWidth;
    $: status = formatLastOnlineDate(Date.now(), user);

    onMount(async () => {
        try {
            const task1 = api.getUser(userId);
            const task2 = api.getBio(userId);
            user = await task1;
            bio = await task2;
            loaded = true;
        } catch (e: any) {
            rollbar.error("Failed to load user profile", e);
            onClose();
        }
    });

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

{#if loaded}
    <Overlay dismissible={true} fade={modal} on:close={onClose}>
        <ModalContent
            hideHeader={true}
            compactFooter={true}
            fixedWidth={false}
            large={modal}
            {alignTo}
            on:close>
            <div slot="body" class="body" class:modal>
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
                <ButtonGroup align={chatButton ? "fill" : "center"}>
                    {#if chatButton}
                        <Button on:click={handleOpenDirectChat} small={true}>Chat</Button>
                    {/if}
                    <Button on:click={onClose} small={true} secondary={true}>Close</Button>
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

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
</style>
