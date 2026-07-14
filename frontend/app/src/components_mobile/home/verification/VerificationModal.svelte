<script lang="ts">
    import { ColourVars, Column, Row, Sheet, Subtitle } from "component-lib";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import VerificationFlow from "./VerificationFlow.svelte";

    interface Props {
        onClose: () => void;
        onSuccess: () => void;
    }

    let { onClose, onSuccess }: Props = $props();
</script>

<Sheet>
    <Column gap={"xl"} padding={"xl"}>
        <Row crossAxisAlignment={"center"} gap={"sm"}>
            <AccountCheck size={"1.5rem"} color={ColourVars.textPrimary} />
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("human.verification.title")} />
            </Subtitle>
        </Row>
        <VerificationFlow onCancel={onClose} {onSuccess} />
    </Column>
</Sheet>
