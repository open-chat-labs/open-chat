<script lang="ts">
    export let num: string;
    export let text: string;
</script>

<div class="card">
    <div class="num">{num}</div>
    <div class="step">{text}</div>
</div>

<style type="text/scss">
    .card {
        $ckbtc: #ad93ff;

        padding: $sp4 0;
        flex: 1;
        display: flex;
        gap: $sp5;
        color: var(--txt);
        border-bottom: 1px solid var(--bd);

        .num {
            color: $ckbtc;
            @include font(bold, normal, fs-120);
            flex: 0 0 30px;
        }

        .step {
            @include font(medium, normal, fs-120, 28);
        }
    }
</style>
