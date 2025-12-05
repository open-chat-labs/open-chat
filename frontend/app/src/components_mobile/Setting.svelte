<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import { i18nKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        info: string | string[];
        children: Snippet;
        toggle?: () => void;
        disabled?: boolean;
    }

    let { info, children, toggle, disabled = false }: Props = $props();
    let paras = $derived(Array.isArray(info) ? info : [info]);
</script>

<Container onClick={disabled ? undefined : toggle} gap={"sm"} direction={"vertical"}>
    {@render children()}
    {#each paras as para}
        <BodySmall width={"fill"} colour={disabled ? "textTertiary" : "textSecondary"}>
            <Translatable resourceKey={i18nKey(para)}></Translatable>
        </BodySmall>
    {/each}
</Container>
