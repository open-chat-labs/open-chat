<script lang="ts">
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Streak from "./Streak.svelte";
    import Verified from "../../icons/Verified.svelte";
    import { disableChit } from "@src/stores/settings";

    export let diamondStatus: DiamondMembershipStatus["kind"] | undefined = undefined;
    export let streak: number = 0;
    export let uniquePerson: boolean = false;
</script>

<Diamond status={diamondStatus} />
<Verified size={"small"} verified={uniquePerson} />
{#if !$disableChit}
    <Streak days={streak} />
{/if}
