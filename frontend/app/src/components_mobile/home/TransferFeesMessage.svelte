<script lang="ts">
    import { Caption, ColourVars, Container } from "component-lib";
    import { i18nKey, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        symbol: string;
        tokenDecimals: number;
        transferFees: bigint;
    }

    let { transferFees, tokenDecimals, symbol }: Props = $props();
</script>

<Container crossAxisAlignment={"end"} gap={"xs"}>
    <Info viewBox={"0 2 24 24"} size={"1rem"} color={ColourVars.warning} />
    <Caption colour={"warning"}>
        <Translatable
            resourceKey={i18nKey("tokenTransfer.fee", {
                fee: client.formatTokens(transferFees, tokenDecimals),
                token: symbol,
            })} />
    </Caption>
</Container>
