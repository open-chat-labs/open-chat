<script lang="ts">
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Streak from "./Streak.svelte";
    import Verified from "../../icons/Verified.svelte";
    import { disableChit } from "@src/stores/settings";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
    }

    let { diamondStatus = undefined, streak = 0, uniquePerson = false }: Props = $props();
</script>

<Diamond status={diamondStatus} />
<Verified size={"small"} verified={uniquePerson} />
{#if !$disableChit}
    <Streak days={streak} />
{/if}
