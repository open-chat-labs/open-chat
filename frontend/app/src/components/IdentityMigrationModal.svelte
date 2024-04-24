<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";
    import ModalContent from "./ModalContent.svelte";
    import Progress from "./Progress.svelte";
    import { Poller, type OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    const POLL_INTERVAL = 2000;
    let poller = new Poller(getProgress, POLL_INTERVAL);

    onDestroy(() => poller.stop());

    $: user = client.user;
    $: percent =
        $user.principalUpdates !== undefined
            ? (100 * $user.principalUpdates[0]) / $user.principalUpdates[1]
            : 100;

    function getProgress(): Promise<void> {
        return client.getIdentityMigrationProgress().then((progress) => {
            user.update((user) => ({
                ...user,
                principalUpdates: progress,
            }));
        });
    }
</script>

<ModalContent>
    <div class="body" slot="body">
        <Translatable resourceKey={i18nKey("identityMigrationMessage")} />
        <div class="progress">
            <Progress {percent} />
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
