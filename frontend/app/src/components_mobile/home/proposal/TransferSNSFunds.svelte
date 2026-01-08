<script lang="ts">
    import { Column, Input, Radio } from "component-lib";
    import {
        isPrincipalValid,
        isSubAccountValid,
        type NervousSystemDetails,
        type TransferSnsFunds,
        type Treasury,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Legend from "../../Legend.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        nervousSystem: NervousSystemDetails;
        valid: boolean;
    }

    let { nervousSystem, valid = $bindable() }: Props = $props();

    let treasury: Treasury = $state("SNS");
    let busy = $state(false);
    let recipientOwner = $state("");
    let recipientSubaccount = $state("");
    let amountText = $state("");
    let tokenDetails = $derived(nervousSystem.token);
    let transferFee = $derived(tokenDetails.transferFee);
    let amount = $derived(Number(amountText) * Number(Math.pow(10, tokenDetails.decimals)));
    let amountValid = $derived(amount >= transferFee);
    let symbol = $derived(tokenDetails.symbol);
    let recipientOwnerValid = $derived(isPrincipalValid(recipientOwner));
    let recipientSubaccountValid = $derived(
        recipientSubaccount.length === 0 || isSubAccountValid(recipientSubaccount),
    );
    let token = $derived(treasury === "SNS" ? symbol : "ICP");
    let isValid = $derived(amountValid && recipientOwnerValid && recipientSubaccountValid);

    $effect(() => {
        if (valid !== isValid) {
            valid = isValid;
        }
    });

    export function convertAction(): TransferSnsFunds {
        return {
            kind: "transfer_sns_funds",
            recipient: {
                owner: recipientOwner,
                subaccount:
                    recipientSubaccount.length > 0
                        ? recipientSubaccount.padStart(64, "0")
                        : undefined,
            },
            amount: BigInt(Math.floor(amount)),
            treasury,
        };
    }
</script>

<Column gap={"xl"}>
    <Column>
        <Legend
            padding={["zero", "zero", "xs", "zero"]}
            label={i18nKey("proposal.maker.treasury")}
            required />
        <Column gap={"sm"}>
            <Radio
                id="chat_treasury"
                group="treasury"
                value={symbol}
                disabled={busy}
                checked={treasury === "SNS"}
                onChange={() => (treasury = "SNS")}>
                <Translatable resourceKey={i18nKey(symbol)} />
            </Radio>
            <Radio
                id="icp_treasury"
                group="treasury"
                value="ICP"
                disabled={busy}
                checked={treasury === "ICP"}
                onChange={() => (treasury = "ICP")}>
                <Translatable resourceKey={i18nKey("ICP")} />
            </Radio>
        </Column>
    </Column>
    <Column>
        <Legend label={i18nKey("proposal.maker.recipientOwner")} required />
        <Input
            disabled={busy}
            error={recipientOwner.length > 0 && !recipientOwnerValid}
            maxlength={63}
            bind:value={recipientOwner}
            placeholder={interpolate($_, i18nKey("proposal.maker.enterRecipientOwner"))} />
    </Column>
    <Column>
        <Legend
            label={i18nKey("proposal.maker.recipientSubaccount")}
            rules={i18nKey("proposal.maker.recipientSubaccountRules")} />
        <Input
            disabled={busy}
            error={!recipientSubaccountValid}
            maxlength={64}
            bind:value={recipientSubaccount}
            placeholder={interpolate($_, i18nKey("proposal.maker.enterRecipientSubaccount"))} />
    </Column>
    <Column>
        <Legend
            label={i18nKey("proposal.maker.amount")}
            rules={i18nKey("proposal.maker.amountRules", { token })}
            required />
        <Input
            disabled={busy}
            error={amountText.length > 0 && !amountValid}
            minlength={1}
            maxlength={20}
            bind:value={amountText}
            placeholder={interpolate(
                $_,
                i18nKey("proposal.maker.enterAmount", {
                    token,
                }),
            )} />
    </Column>
</Column>
