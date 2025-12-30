<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";

    interface Props {
        isPublic: boolean;
    }

    let { isPublic }: Props = $props();
</script>

{#if !isPublic}
    <Container gap={"xs"} width={"hug"} supplementalClass="visibility-indicator">
        <Container gap={"xs"} crossAxisAlignment={"center"}>
            <LockOutline color={ColourVars.error} />
            <Translatable resourceKey={i18nKey(isPublic ? "access.public" : "access.private")} />
        </Container>
        //
    </Container>
{/if}

<style lang="scss">
    :global {
        .visibility-indicator {
            text-transform: lowercase;
        }
    }
</style>
