<script lang="ts">
    import { Column, Sheet, Title } from "component-lib";
    import type { Feature } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        feature: Feature;
        onClose: () => void;
    }

    let { feature, onClose }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <Column mainAxisAlignment={"center"} crossAxisAlignment={"center"} padding={"xxxl"}>
        <Title width={"hug"} fontWeight={"bold"}>
            {#if feature === "swap"}
                <Translatable resourceKey={i18nKey("restricted.swap")} />
            {:else}
                <Translatable resourceKey={i18nKey("restricted.generic")} />
            {/if}
        </Title>
    </Column>
</Sheet>
