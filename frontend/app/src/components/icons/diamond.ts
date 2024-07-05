export type DiamondColours = {
    dark: string;
    medium: string;
    light: string;
};

export const blueDiamondHue = 210;
export const goldDiamondHue = 42;

export function deriveColours(hue: number): DiamondColours {
    return {
        dark: `hsl(${hue}, 100%, 35%)`,
        medium: `hsl(${hue}, 100%, 65%)`,
        light: `hsl(${hue}, 100%, 80%)`,
    };
}
