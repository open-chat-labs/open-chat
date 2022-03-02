<script lang="ts">
    import { onDestroy } from "svelte";

    import { Poller } from "../fsm/poller";

    const VERSION_INTERVAL = 5000;

    let poller = new Poller(checkVersion, VERSION_INTERVAL);

    onDestroy(() => poller.stop());

    function checkVersion(): Promise<void> {
        // @ts-ignore
        console.log("checking fe version against deployed version", window.OPENCHAT_VERSION);
        return Promise.resolve();
    }
</script>

<h1>hello</h1>

<style type="text/scss">
</style>
