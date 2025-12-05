<script lang="ts">
    import { ColourVars, Container, Subtitle } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");
</script>

<Container
    padding={"xl"}
    mainAxisAlignment={"center"}
    crossAxisAlignment={"center"}
    background={ColourVars.gradientInverted}
    onClick={() => client.updateIdentityState({ kind: "logging_in" })}
    supplementalClass={"anon-footer"}>
    <Subtitle width={"hug"}>
        <Markdown text={$_("createAccountOrSignIn")} />
    </Subtitle>
</Container>

<style lang="scss">
    :global(.container.anon-footer) {
        position: absolute;
        bottom: 0;
        bottom: var(--safe-inset);
        @include z-index("anon-banner");
    }
</style>
