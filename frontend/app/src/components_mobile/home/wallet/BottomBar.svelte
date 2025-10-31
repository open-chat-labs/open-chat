<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BigButton, Container, type SizeMode } from "component-lib";
    import List from "svelte-material-icons/FormatListBulletedType.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import Translatable from "../../Translatable.svelte";

    function select() {
        console.log("Not sure what this does yet");
    }

    const width: SizeMode = { kind: "fixed", size: "6rem" };
</script>

<Container gap={"sm"}>
    <BigButton {width} mode={"active"} onClick={select}>
        {#snippet icon(color)}
            <List {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Overview")} />
    </BigButton>
    <BigButton {width} mode={"default"} onClick={select}>
        {#snippet icon(color)}
            <TrayArrowDown {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Receive")} />
    </BigButton>
    <BigButton {width} mode={"default"} onClick={select}>
        {#snippet icon(color)}
            <TrayArrowUp {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Send")} />
    </BigButton>
    <BigButton {width} mode={"default"} onClick={select}>
        {#snippet icon(color)}
            <SwapVertical {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Swap")} />
    </BigButton>
</Container>
