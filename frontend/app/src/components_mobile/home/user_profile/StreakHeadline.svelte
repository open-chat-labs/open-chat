<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, H1 } from "component-lib";
    import { chitStateStore } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
</script>

<Container supplementalClass={"streak_title"} gap={"xl"} direction={"vertical"}>
    <H1 width={{ size: "70%" }} fontWeight={"bold"} colour={"primary"}>
        <Translatable
            resourceKey={i18nKey("You are on a {streak} day streak!", {
                streak: $chitStateStore.streak,
            })}></Translatable>
    </H1>
</Container>

<style lang="scss">
    :global(.container.streak_title > h1) {
        background: var(--gradient-inverted);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
</style>
