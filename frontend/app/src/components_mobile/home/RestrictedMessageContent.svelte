<script lang="ts">
    import { BodySmall, Column } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
</script>

<Column padding={["xs", "sm"]}>
    <BodySmall fontWeight={"light"} colour={"textTertiary"} italic={true}>
        <Translatable resourceKey={i18nKey("appStore.messageNotAvailable")} />
    </BodySmall>
</Column>
