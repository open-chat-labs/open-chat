<script lang="ts">
    import { BodySmall, Container, H1 } from "component-lib";
    import { Confetti } from "svelte-confetti";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    let { para = i18nKey("upgrade.congratulations") } = $props();
</script>

<Container
    gap={"lg"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}
    direction={"vertical"}>
    <H1 align={"center"} fontWeight={"bold"}
        ><Translatable resourceKey={i18nKey("congratulations")} /></H1>
    <p class="tada">🎉</p>
    <BodySmall align={"center"} colour={"textSecondary"}
        ><Translatable resourceKey={para} /></BodySmall>
    <div class="tada">
        <div class="confetti">
            <Confetti />
        </div>
    </div>
</Container>

<style lang="scss">
    .tada {
        text-align: center;
        @include font-size(fs-220);
        position: relative;

        .confetti {
            position: absolute;
            pointer-events: none;
            top: 50%;
            left: 50%;
        }
    }
</style>
