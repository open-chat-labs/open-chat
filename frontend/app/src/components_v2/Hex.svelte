<svg
    preserveAspectRatio="none"
    class="hex"
    viewBox="0 0 1800 1000"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:bx="https://boxy-svg.com">
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 274.543 562.458)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 405.959 369.63)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 173.465 320.655)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 308.097 123.569)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 541.336 175.05)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 -58.373 268.253)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 73.043 75.425)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 -159.451 26.45)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 -24.819 -170.636)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 208.42 -119.154)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 443.696 -71.865)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 575.112 -264.693)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 342.617 -313.667)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 477.25 -510.754)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 710.488 -459.272)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 841.854 -658.71)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 973.27 -851.54)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 740.775 -900.514)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 875.408 -1097.6)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 1108.646 -1046.118)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 110.488 -365.36)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 241.904 -558.189)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 9.41 -607.163)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 144.042 -804.25)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 377.28 -752.768)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 609.275 -704.163)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 509.021 -949.798)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 40.466 516.327)" />
    <path d="m100 900 100 50v100l-100 50-100-50V950Z" transform="rotate(-45 141.343 762.056)" />
</svg>

<style lang="scss">
    .hex {
        position: absolute;
        bottom: 0;
        left: 30%;
        z-index: -1;

        path {
            stroke: rgba(255, 255, 255, 0.01);
            fill: rgba(255, 255, 255, 0.01);
        }
    }

    @for $i from 1 through 29 {
        .hex path:nth-child(#{$i}) {
            animation: ripple 3s ($i * 0.2s) ease-in-out 5 alternate;
        }
    }

    @keyframes ripple {
        100% {
            stroke: rgba(255, 255, 255, 0.2);
            fill: rgba(255, 255, 255, 0.1);
        }
    }
</style>
