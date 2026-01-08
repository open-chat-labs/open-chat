<script lang="ts">
    import { Column, Sheet, Subtitle } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Pincode from "../pincode/Pincode.svelte";
    import Translatable from "../Translatable.svelte";
    import ForgotPinLabel from "./ForgotPinLabel.svelte";

    interface Props {
        onComplete: (pin: string) => void;
        onClose: () => void;
        onForgot: () => void;
    }

    let { onComplete, onClose, onForgot }: Props = $props();

    function onPinComplete(_: string[], value: string) {
        onComplete(value);
    }
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("pinNumber.enterPin")} />
        </Subtitle>
        <Column gap={"lg"}>
            <Pincode type="numeric" length={6} onComplete={onPinComplete} />
            <ForgotPinLabel {onForgot} />
        </Column>
    </Column>
</Sheet>
