<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PublicProfile } from "../../../domain/user/user";
    import CellphoneCheck from "../../customIcons/CellphoneCheck.svelte";
    import DatabaseCheck from "../../customIcons/DatabaseCheck.svelte";
    import Star3Points from "../../customIcons/Star3Points.svelte";
    import Star4Points from "../../customIcons/Star4Points.svelte";
    import Star5Points from "../../customIcons/Star5Points.svelte";
    import Star6Points from "../../customIcons/Star6Points.svelte";
    import Star8Points from "../../customIcons/Star8Points.svelte";
    import Star10Points from "../../customIcons/Star10Points.svelte";
    import { ONE_DAY } from "../../../utils/date";
    import { now } from "../../../stores/time";

    export let profile: PublicProfile;

    $: userDuration = profile !== undefined ? BigInt($now) - profile.created : 0;
</script>

<div class="badges" on:click>
    {#if userDuration > ONE_DAY * 365}
        <div class="badge" title={$_("badge_title_1year")}>
            <Star10Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {:else if userDuration > ONE_DAY * 183}
        <div class="badge" title={$_("badge_title_6month")}>
            <Star8Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {:else if userDuration > ONE_DAY * 91}
        <div class="badge" title={$_("badge_title_3month")}>
            <Star6Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {:else if userDuration > ONE_DAY * 30}
        <div class="badge" title={$_("badge_title_1month")}>
            <Star5Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {:else if userDuration > ONE_DAY * 7}
        <div class="badge" title={$_("badge_title_1week")}>
            <Star4Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {:else}
        <div class="badge" title={$_("badge_title_new")}>
            <Star3Points size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {/if}
    {#if profile.isPremium}
        <div class="badge" title={$_("badge_title_storage")}>
            <DatabaseCheck size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {/if}
    {#if profile.phoneIsVerified}
        <div class="badge" title={$_("badge_title_phone")}>
            <CellphoneCheck size={"1.5em"} color={"var(--icon-txt)"} />
        </div>
    {/if}
</div>

<style type="text/scss">
    .badges {
        display: flex;
        margin: $sp2 0;
        gap: $sp2;
        cursor: pointer;
    }
    .badge {
        height: 1.5em;
    }
</style>
