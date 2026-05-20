<div class="typing">
    <div>.</div>
    <div>.</div>
    <div>.</div>
</div>

<style lang="scss">
    .typing {
        padding-bottom: $sp2;
        margin-top: -$sp2;
        @include font(bold, normal, fs-120);
        line-height: 90%;
        color: inherit;
        display: inline-flex;

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
                }
                50% {
                    opacity: 0;
                }
                100% {
                    opacity: 1;
                }
            }
        }
    }
</style>
