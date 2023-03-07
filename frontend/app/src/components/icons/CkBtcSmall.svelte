<script lang="ts">
    export let shadow = false;
    let spokes = new Array(16);
</script>

<div class="purse">
    <div class:shadow class="coin">
        <div class="front" />
        <div class="back" />
        <div class="side">
            {#each spokes as _spoke}
                <div class="spoke" />
            {/each}
        </div>
    </div>
</div>

<style type="text/scss">
    @include spinning_coin(url("../assets/ckbtc_nobackground.svg"), 4rem);
</style>
