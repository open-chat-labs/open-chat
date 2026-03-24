<svelte:options immutable />

<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { BodySmall, ColourVars, Row } from "component-lib";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
</script>

<!-- TODO RTL layout -->
<Row
    supplementalClass="reply_wrapper"
    gap="sm"
    padding="sm"
    crossAxisAlignment="center"
    mainAxisAlignment="center"
    borderColour={ColourVars.primaryMuted}>
    <BodySmall italic={true} colour={"primaryLight"} width="hug">
        <Translatable resourceKey={i18nKey("unresolvedReply")} />
    </BodySmall>
    <AlertCircleOutline size="1rem" color={ColourVars.primaryLight} />
</Row>
