<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import ModalContent from "../ModalContent.svelte";
    import type { OpenChat } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { now } from "../../stores/time";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let busy = false;

    $: user = client.user;
    $: avaliable = $user.nextDailyChitClaim < $now;

    function close() {
        dispatch("close");
    }

    function claim() {
        busy = true;

        client.claimDailyChit().finally(() => busy = false);
    }
</script>

<ModalContent closeIcon on:close>
    <div slot="header"><Translatable resourceKey={i18nKey("dailyChit.title")} /></div>
    <div slot="body">
        <p>CHIT STREAK: {$user.streak}</p>
        <p>CHIT BALANCE: {$user.chitBalance}</p>
        <p><Translatable resourceKey={i18nKey(avaliable ? "dailyChit.available" : "dailyChit.alreadyClaimed")} /></p>
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={close}>{$_("close")}</Button>
            <Button loading={busy} disabled={!avaliable} on:click={claim}>
                {$_("dailyChit.claim")}
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>
