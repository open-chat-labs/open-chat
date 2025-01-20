<script lang="ts">
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    interface Props {
        type: "group" | "community";
    }

    let { type }: Props = $props();
</script>

<section>
    <Legend label={i18nKey("proposal.maker.recipientOwner")} required />
    <TextArea
        rows={8}
        bind:outerHeight={summaryContainerHeight}
        bind:innerHeight={summaryHeight}
        disabled={busy}
        invalid={summary.length > 0 && !summaryValid}
        bind:value={summary}
        margin={false}
        scroll
        minlength={MIN_SUMMARY_LENGTH}
        maxlength={MAX_SUMMARY_LENGTH}
        placeholder={i18nKey("proposal.maker.enterSummary")} />
</section>
