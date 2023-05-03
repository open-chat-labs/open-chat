<script lang="ts">
    export let num: number;
    export let text: string;
</script>

<div class="card">
    <div class="num">{num}</div>
    <div class="step">{text}</div>
</div>

<style type="text/scss">
    .card {
        $ckbtc: #4e27c7;
        padding: $sp4;
        flex: 0 0 250px;
        height: 180px;
        display: inline-block;
        color: var(--txt);
        background-color: var(--input-bg);
        border-radius: $sp2;
        border-top: 2px solid $ckbtc;

        .num {
            width: 30px;
            height: 30px;
            text-align: center;
            display: grid;
            align-content: center;
            background-color: $ckbtc;
            border-radius: 50%;
            padding: $sp2;
            margin-bottom: $sp4;
        }

        .step {
            @include font(bold, normal, fs-120, 22);
        }
    }
</style>
