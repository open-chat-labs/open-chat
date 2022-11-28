<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { iconSize } from "../../../stores/iconSize";
    import type { OpenChat } from "openchat-client";
    import ChessBoard from "./ChessBoard.svelte";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();
</script>

<Overlay dismissible>
    <ModalContent>
        <span class="header" slot="header"> Your move </span>
        <form slot="body">
            <div class="body">
                <ChessBoard interactive={true} />
            </div>
        </form>
        <span class="footer" slot="footer" />
    </ModalContent>
</Overlay>

<style type="text/scss">
</style>
