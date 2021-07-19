<div class="typing">
    <div>.</div>
    <div>.</div>
    <div>.</div>
</div>

<style type="text/scss">
    .typing {
        @include font(bold, normal, fs-140);
        color: #fff;
        display: flex;

        > div {
            animation: pulse 1s infinite;

            &:nth-child(1) {
                animation-delay: 100ms;
            }

            &:nth-child(2) {
                animation-delay: 200ms;
            }

            @keyframes pulse {
                0% {
                    opacity: 1;
                    transform: scale(1);
                }
                50% {
                    opacity: 0;
                    transform: scale(1.2);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        }
    }
</style>
