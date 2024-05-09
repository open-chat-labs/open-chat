<script lang="ts">
    import { getContext } from "svelte";
    import CommonNavElements from "./CommonNavElements.svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    $: anonUser = client.anonUser;
</script>

<div class="bottom-nav" class:anonUser={$anonUser}>
    <CommonNavElements
        menuAlignment={"end"}
        menuPosition={"top"}
        menuGutter={0}
        orientation={"horizontal"}
        on:profile />
</div>

<style lang="scss">
    :global(.bottom-nav .avatar.small) {
        width: toRem(40);
        height: toRem(40);
    }

    .bottom-nav {
        display: flex;
        justify-content: space-evenly;
        align-items: center;
        border-top: var(--bw) solid var(--bd);

        @include safezone() {
            height: calc(toRem(60) + var(--safe-area-inset-bottom));
            flex: 0 0 calc(toRem(60) + var(--safe-area-inset-bottom));
            padding-bottom: var(--safe-area-inset-bottom);

            &.anonUser {
                height: toRem(60);
                flex: 0 0 toRem(60);
                padding-bottom: 0;
            }
        }
    }
</style>
