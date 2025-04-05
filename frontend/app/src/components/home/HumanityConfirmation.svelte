<script lang="ts">
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";
    import { _ } from "svelte-i18n";
    import Checkbox from "../Checkbox.svelte";
    import AlertBox from "../AlertBox.svelte";

    interface Props {
        confirmed: boolean;
    }

    let { confirmed = $bindable() }: Props = $props();
</script>

<AlertBox icon={false}>
    <Checkbox
        id="history-visible"
        label={i18nKey("access.doYouHaveUniquePersonCredential")}
        align={"start"}
        bind:checked={confirmed}>
        <p class="question">
            <Markdown text={interpolate($_, i18nKey("access.doYouHaveUniquePersonCredential"))} />
        </p>
        <p class="answer">
            <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
        </p>

        <p class="answer">
            <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")} />
        </p>
    </Checkbox>
</AlertBox>

<style lang="scss">
    .question,
    .answer {
        margin-bottom: $sp4;
    }

    .question {
        @include font(book, normal, fs-90);
    }

    .answer {
        color: var(--txt-light);
        @include font(book, normal, fs-90);
    }
</style>
