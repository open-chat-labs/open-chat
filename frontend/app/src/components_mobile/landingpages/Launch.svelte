<script lang="ts">
    import { Button } from "component-lib";
    import { identityStateStore, routeForScope, type OpenChat } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        rootPath?: any;
        text?: string;
        login?: boolean;
    }

    let {
        rootPath = routeForScope(client.getDefaultScope()),
        text = "Launch app",
        login = false,
    }: Props = $props();

    let url = $derived($identityStateStore.kind === "logged_in" ? rootPath : "/communities");
    let busy = $derived(
        $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "loading_user",
    );
</script>

<Button
    onClick={() => {
        if (login) {
            client.login();
        } else {
            page(url);
        }
    }}
    loading={busy}>
    {text}
</Button>
