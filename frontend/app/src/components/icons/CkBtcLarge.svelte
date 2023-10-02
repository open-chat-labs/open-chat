<script lang="ts">
    export let logo: string;
    export let shadow = false;
    let spokes = new Array(16);

    $: console.log("Logo: ", logo);
</script>

<div class="purse">
    <div class:shadow class="coin">
        <div style={`background-image: url(${logo})`} class="front" />
        <div style={`background-image: url(${logo})`} class="back" />
        <div class="side">
            {#each spokes as _spoke}
                <div class="spoke" />
            {/each}
        </div>
    </div>
</div>

<style lang="scss">
    @include spinning_coin(7rem, true);
</style>
