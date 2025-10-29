<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import { i18nKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        info: string;
        children: Snippet;
        toggle?: () => void;
        disabled?: boolean;
    }

    let { info, children, toggle, disabled = false }: Props = $props();
</script>

<Container onClick={disabled ? undefined : toggle} gap={"sm"} direction={"vertical"}>
    {@render children()}
    <BodySmall colour={disabled ? "textTertiary" : "textSecondary"}>
        <Translatable resourceKey={i18nKey(info)}></Translatable>
    </BodySmall>
</Container>
