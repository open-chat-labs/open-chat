import * as CSS from 'csstype';
import { CSSProperties } from "react";
import Dimensions from "../utils/Dimensions";

export function scaleMediaContent(width: number, height: number) : Dimensions {
    let dimensions = new Dimensions(width, height);
    return dimensions.scaleToFit(new Dimensions(500, 500));
}

export function styleMediaMessage(width: number, height: number) : CSSProperties {
    let dimensions = scaleMediaContent(width, height);
    const style: CSS.Properties = {
        width: dimensions.width + 'px',
        height: dimensions.height + 'px',
    };

    return style;
}
