<script lang="ts">
    import {
        isPrincipalValid,
        isSubAccountValid,
        type NervousSystemDetails,
        type Treasury,
        type TransferSnsFunds,
    } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Legend from "../../Legend.svelte";
    import Radio from "../../Radio.svelte";
    import Input from "../../Input.svelte";

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

<div>
    <section>
        <Legend label={i18nKey("proposal.maker.treasury")} required />
        <Radio
            id="chat_treasury"
            group="treasury"
            value={symbol}
            label={i18nKey(symbol)}
            disabled={busy}
            checked={treasury === "SNS"}
            on:change={() => (treasury = "SNS")} />
        <Radio
            id="icp_treasury"
            group="treasury"
            value="ICP"
            label={i18nKey("ICP")}
            disabled={busy}
            checked={treasury === "ICP"}
            on:change={() => (treasury = "ICP")} />
    </section>
    <section>
        <Legend label={i18nKey("proposal.maker.recipientOwner")} required />
        <Input
            disabled={busy}
            invalid={recipientOwner.length > 0 && !recipientOwnerValid}
            maxlength={63}
            bind:value={recipientOwner}
            placeholder={i18nKey("proposal.maker.enterRecipientOwner")} />
    </section>
    <section>
        <Legend
            label={i18nKey("proposal.maker.recipientSubaccount")}
            rules={i18nKey("proposal.maker.recipientSubaccountRules")} />
        <Input
            disabled={busy}
            invalid={!recipientSubaccountValid}
            maxlength={64}
            bind:value={recipientSubaccount}
            placeholder={i18nKey("proposal.maker.enterRecipientSubaccount")} />
    </section>
    <section>
        <Legend
            label={i18nKey("proposal.maker.amount")}
            rules={i18nKey("proposal.maker.amountRules", { token })}
            required />
        <Input
            disabled={busy}
            invalid={amountText.length > 0 && !amountValid}
            minlength={1}
            maxlength={20}
            bind:value={amountText}
            placeholder={i18nKey("proposal.maker.enterAmount", {
                token,
            })} />
    </section>
</div>
