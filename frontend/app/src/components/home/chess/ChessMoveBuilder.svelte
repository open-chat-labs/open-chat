<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ChessBoard from "./ChessBoard.svelte";
    import { Game, initialGameState } from "./logic";

    export let open: boolean;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    $: replyingTo = client.currentChatReplyingTo;

    $: gameState =
        $replyingTo !== undefined &&
        $replyingTo.content.kind === "custom_content" &&
        $replyingTo.content.subtype === "chess_content"
            ? new Game($replyingTo.content.payload)
            : new Game();

    function moveSelected(ev: CustomEvent<Game>) {
        gameState = ev.detail;
    }

    function send() {
        const content = {
            kind: "custom_content",
            subtype: "chess_content",
            payload: JSON.stringify(gameState),
        };
        dispatch("sendChessMove", [content, undefined]);
        open = false;
        gameState = initialGameState;
    }

    function cancel() {
        open = false;
    }
</script>

<Overlay dismissible>
    <ModalContent>
        <span class="header" slot="header">{`${gameState.next} to move`}</span>
        <form slot="body">
            <div class="body">
                <ChessBoard {gameState} interactive={true} on:moveSelected={moveSelected} />
            </div>
        </form>
        <span class="footer" slot="footer">
            <ButtonGroup>
                <Button tiny={true} on:click={send}>{$_("send")}</Button>
                <Button tiny={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
</style>
