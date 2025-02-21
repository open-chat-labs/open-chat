<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import {
        i18nKey,
        type ChatIdentifier,
        type CommunityIdentifier,
        type ExternalBotLike,
    } from "openchat-client";
    import ShowApiKey from "./ShowApiKey.svelte";

    interface Props {
        botExecutionContext: CommunityIdentifier | ChatIdentifier;
        bot: ExternalBotLike;
        apiKey: string;
        onClose: () => void;
    }

    let { onClose, ...rest }: Props = $props();
</script>

<Overlay dismissible>
    <ModalContent hideFooter closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("bots.manage.generated")}></Translatable>
        </div>
        <div class="body" slot="body">
            <ShowApiKey {...rest} />
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
