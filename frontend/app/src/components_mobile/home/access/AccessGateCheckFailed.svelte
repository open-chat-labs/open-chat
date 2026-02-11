<script lang="ts">
    import { ColourVars, Column, CommonButton, Row, StatusCard } from "component-lib";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    /**
     * TODO - ideally we would tell them which access gate was failed. And the response from the back end *does*
     * tell us the gate check fail reason, but it seems to be giving us the wrong reason at the moment. e.g.
     * When I select a token balance gate from an "any" composite gate, it reports back that it failed because
     * I'm not diamond.
     */
</script>

<Column gap={"xl"} padding={"xl"}>
    <StatusCard
        mode={"warning"}
        background={ColourVars.background2}
        title={"Access gate check failed"}>
        {#snippet body()}
            <Translatable
                resourceKey={i18nKey(
                    "We have been unable to verify that you meet the required access gates to join this chat. Please double check and try again.",
                )} />
        {/snippet}
    </StatusCard>

    <Row mainAxisAlignment={"end"}>
        <CommonButton width={"hug"} mode={"active"} onClick={onClose} size={"small_text"}>
            <Translatable resourceKey={i18nKey("close")} />
        </CommonButton>
    </Row>
</Column>
