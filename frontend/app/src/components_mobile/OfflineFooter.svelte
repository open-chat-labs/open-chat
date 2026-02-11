<script lang="ts">
    import { ColourVars, Row, Title } from "component-lib";
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
</script>

<Row
    padding={["md", "lg"]}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    supplementalClass={"offline_footer"}
    backgroundColor={ColourVars.warning}>
    <CloudOffOutline size={"1.5em"} color={"currentColor"} />
    <Title width={"hug"} uppercase>
        <Translatable resourceKey={i18nKey("offlineMessage")} />
    </Title>
</Row>

<style lang="scss">
    :global(.container.offline_footer) {
        position: absolute;
        bottom: 0;
        cursor: pointer;
        @include z-index("anon-banner");
    }
</style>
