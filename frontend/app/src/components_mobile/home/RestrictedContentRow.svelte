<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        textKey: string;
    }

    let { textKey }: Props = $props();
</script>

<Container
    supplementalClass={"restricted_content_row"}
    height={"hug"}
    crossAxisAlignment={"center"}
    padding={["sm", "zero"]}
    gap={"lg"}>
    <div class="lock">🔒</div>
    <BodySmall colour={"textTertiary"} italic={true}>
        <Translatable resourceKey={i18nKey(textKey)} />
    </BodySmall>
</Container>

<style lang="scss">
    .lock {
        display: flex;
        align-items: center;
        justify-content: center;
        width: toRem(48);
        height: toRem(48);
        border-radius: toRem(12);
        background-color: var(--background-0);
        font-size: toRem(20);
        flex-shrink: 0;
    }
</style>
