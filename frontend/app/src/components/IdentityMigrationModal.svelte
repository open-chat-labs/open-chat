<script lang="ts">
    import { getContext } from "svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import ModalContent from "./ModalContent.svelte";
    import Progress from "./Progress.svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: user = client.user;
    $: percent =
        $user.principalUpdates !== undefined
            ? (100 * $user.principalUpdates[0]) / $user.principalUpdates[1]
            : 100;
</script>

<ModalContent>
    <div class="body" slot="body">
        <Translatable resourceKey={i18nKey("identityMigrationMessage")} />
        <div class="progress">
            <Progress size={"30px"} {percent} />
        </div>
    </div>
</ModalContent>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
    }
</style>
