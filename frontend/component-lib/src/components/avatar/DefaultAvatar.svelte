<script lang="ts">
    import { ColourVars } from "component-lib";

    interface Props {
        name?: string;
    }

    let { name = "unknown" }: Props = $props();

    // TODO add more combos
    const colourCombos = [
        [ColourVars.primaryMuted, ColourVars.primaryLight],
        [ColourVars.secondaryMuted, ColourVars.secondaryLight],
        [ColourVars.tertiaryMuted, ColourVars.tertiaryLight],
    ];
    const [circleColor, pathColor] = colourCombos[hashString(name)];

    // Return an index 0..5 for a name to match with one of the theme colours,
    // which we expect to be 6 in total.
    function hashString(str: string): number {
        let hash = 0;

        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // force 32-bit
        }

        return Math.abs(hash) % colourCombos.length;
    }
</script>

<svg class="avatar default" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g class={`group-avatar`} clip-path="url(#clip0_5613_21075)">
        <circle class="circle" fill={circleColor} cx="64" cy="64" r="64" />
        <path
            class="icon-path"
            fill={pathColor}
            d="M76 79V85H34V79C34 79 34 67 55 67C76 67 76 79 76 79ZM65.5 50.5C65.5 48.4233 64.8842 46.3932 63.7304 44.6665C62.5767 42.9398 60.9368 41.594 59.0182 40.7993C57.0996 40.0046 54.9884 39.7966 52.9516 40.2018C50.9147 40.6069 49.0438 41.6069 47.5754 43.0754C46.1069 44.5438 45.1069 46.4148 44.7018 48.4516C44.2966 50.4884 44.5045 52.5996 45.2993 54.5182C46.094 56.4368 47.4398 58.0767 49.1665 59.2304C50.8932 60.3842 52.9233 61 55 61C57.7848 61 60.4555 59.8938 62.4246 57.9246C64.3938 55.9555 65.5 53.2848 65.5 50.5ZM75.82 67C77.6642 68.4272 79.1733 70.2413 80.241 72.3145C81.3087 74.3878 81.9091 76.6698 82 79V85H94V79C94 79 94 68.11 75.82 67ZM73 40C70.9351 39.9885 68.9155 40.6059 67.21 41.77C69.0323 44.3162 70.0122 47.3689 70.0122 50.5C70.0122 53.6311 69.0323 56.6838 67.21 59.23C68.9155 60.3941 70.9351 61.0115 73 61C75.7848 61 78.4555 59.8938 80.4246 57.9246C82.3938 55.9555 83.5 53.2848 83.5 50.5C83.5 47.7152 82.3938 45.0445 80.4246 43.0754C78.4555 41.1063 75.7848 40 73 40Z" />
    </g>
    <defs>
        <clipPath id="clip0_5613_21075">
            <rect width="128" height="128" />
        </clipPath>
    </defs>
</svg>
