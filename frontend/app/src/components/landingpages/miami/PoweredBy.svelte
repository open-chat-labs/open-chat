<div class="logos">
    <div class="bitcoin" />
    <div class="plus">+</div>
    <div class="dfinity" />
    <div class="text">
        <div class="faucet">Bitcoin faucet powered by</div>
        <div class="ic">internet computer</div>
    </div>
</div>

<style type="text/scss">
    .logos {
        display: flex;
        align-items: center;
        gap: $sp3;

        .bitcoin {
            width: 28px;
            height: 28px;
            background-image: url("../assets/bitcoin_token.png");
            background-repeat: no-repeat;
            background-size: contain;
        }
        .dfinity {
            width: 51px;
            height: 24px;
            background-image: url("../assets/dfinity_logo.svg");
            background-repeat: no-repeat;
            background-size: contain;
        }
        .faucet {
            @include font(medium, normal, fs-50, 14);
        }
        .ic {
            text-transform: uppercase;
            @include font(bold, normal, fs-80, 14);
        }
    }
</style>
