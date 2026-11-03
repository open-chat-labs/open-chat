<script lang="ts">
    import { BodySmall, Column } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
</script>

<!-- A message of a type this version doesn't know, because the backend was released first -->
<Column padding={["xs", "sm"]}>
    <BodySmall fontWeight={"light"} colour={"textOnDisabledSurface"} italic={true}>
        <Translatable resourceKey={i18nKey("messageUnsupported")} />
    </BodySmall>
</Column>
