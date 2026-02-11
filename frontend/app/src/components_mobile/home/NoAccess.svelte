<script lang="ts">
    import { Body, Column, CommonButton, H2, Row, Sheet } from "component-lib";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <H2 colour={"primary"}>
            <Translatable resourceKey={i18nKey("noAccess")} />
        </H2>

        <Body colour={"textSecondary"}>
            <Markdown text={$_("noAccessText")} />
        </Body>

        <Row mainAxisAlignment={"end"}>
            <CommonButton mode={"active"} size={"medium"} onClick={onClose}>
                <Translatable resourceKey={i18nKey("close")} />
            </CommonButton>
        </Row>
    </Column>
</Sheet>
