import Dimensions from "../../utils/Dimensions";

const MIN_MEDIA_WIDTH: number = 330;
const MAX_MEDIA_DIMENSION: number = 494;

export function scaleMediaContent(width: number, height: number, applyMinWidth: boolean = false) : Dimensions {
    if (applyMinWidth && width < MIN_MEDIA_WIDTH) {
        return new Dimensions(
            MIN_MEDIA_WIDTH,
            Math.floor(MIN_MEDIA_WIDTH / (width / height)));
    }

    let dimensions = new Dimensions(width, height);
    return dimensions.scaleToFit(new Dimensions(MAX_MEDIA_DIMENSION, MAX_MEDIA_DIMENSION));
}
