<script lang="ts">
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Streak from "./Streak.svelte";

    export let diamondStatus: DiamondMembershipStatus["kind"] | undefined = undefined;
    export let streak: number = 0;
</script>

<!-- <div class="badges"> -->
    <Diamond status={diamondStatus} />
    <Streak days={streak} />
<!-- </div> -->

<!-- <style lang="scss">
    .badges {
        display: flex;
        flex-direction: row;
        align-items: center;
    }
</style> -->
