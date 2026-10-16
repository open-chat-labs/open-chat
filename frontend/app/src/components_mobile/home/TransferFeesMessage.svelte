<script lang="ts">
    import { BodySmall, ColourVars, Container } from "component-lib";
    import { i18nKey, OpenChat } from "@client";
    import { getContext } from "svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        symbol: string;
        tokenDecimals: number;
        transferFees: bigint;
        networkFee?: bigint;
        networkFeeIsEstimate?: boolean;
    }

    let {
        transferFees,
        tokenDecimals,
        symbol,
        networkFee,
        networkFeeIsEstimate = true,
    }: Props = $props();
</script>

<Container crossAxisAlignment="center" gap="sm">
    <Info size="1rem" color={ColourVars.validationWarning} />
    <Container direction={"vertical"}>
        <BodySmall colour={"validationWarning"}>
            <Translatable
                resourceKey={i18nKey("tokenTransfer.fee", {
                    fee: client.formatTokens(transferFees, tokenDecimals),
                    token: symbol,
                })} />
        </BodySmall>
        {#if networkFee !== undefined}
            <BodySmall colour={"validationWarning"}>
                <Translatable
                    resourceKey={i18nKey("cryptoAccount.networkFee", {
                        amount: `${networkFeeIsEstimate ? "~" : ""}${client.formatTokens(networkFee, tokenDecimals)}`,
                        token: symbol,
                    })} />
            </BodySmall>
        {/if}
    </Container>
</Container>
