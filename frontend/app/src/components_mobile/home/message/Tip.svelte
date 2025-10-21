<script lang="ts">
    import { Caption, ColourVars, Container } from "component-lib";
    import { cryptoLookup } from "openchat-client";
    interface Props {
        tip: [string, Record<string, bigint>];
        canTip: boolean;
        onClick: (ledger: string) => void;
    }

    // TODO - come back and deal with tooltips

    let { onClick, tip, canTip }: Props = $props();
    let [ledger, userTips] = $derived(tip);
    let userTipsList = $derived(Object.entries(userTips));
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    // let totalAmount = $derived(userTipsList.reduce((n, [_, amount]) => n + amount, BigInt(0)));
</script>

<Container
    onClick={canTip ? () => onClick(ledger) : undefined}
    borderRadius={"lg"}
    width={{ kind: "hug" }}
    padding={["zero", "xs"]}
    background={ColourVars.background2}
    crossAxisAlignment={"center"}
    gap={"xs"}
    borderWidth={"thin"}
    borderColour={ColourVars.background0}>
    <img alt={tokenDetails.symbol} class="tip-icon" src={tokenDetails.logo} />
    <Caption>
        {userTipsList.length > 999 ? "999+" : userTipsList.length}
    </Caption>
</Container>

<style lang="scss">
    .tip-icon {
        background-size: contain;
        height: 24px;
        width: 24px;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
    }
</style>
