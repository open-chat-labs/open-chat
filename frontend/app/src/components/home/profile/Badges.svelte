<script lang="ts">
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Streak from "./Streak.svelte";
    import Human from "../../icons/Human.svelte";

    export let diamondStatus: DiamondMembershipStatus["kind"] | undefined = undefined;
    export let streak: number = 0;
    export let uniquePerson: boolean = false;
</script>

<Diamond status={diamondStatus} />
<Human {uniquePerson} />
<Streak days={streak} />
