
export default class Dimensions {
    private _width: number = 0;
    private _height: number = 0;

    constructor(width: number, height: number) {
        this._width = width;
        this._height = height;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    public scaleToFit(maxDimensions: Dimensions) : Dimensions {
        const aspectRatio = this.width / this.height;
        const maxAspectRatio = maxDimensions.width / maxDimensions.height;

        if (this.width <= maxDimensions.width && this.height <= maxDimensions.height) {
            return new Dimensions(this.width, this.height);
        }

        if (aspectRatio > maxAspectRatio) {
            return new Dimensions(
                maxDimensions.width, 
                Math.floor(maxDimensions.width / aspectRatio));
        } else {
            return new Dimensions(
                Math.floor(maxDimensions.height * aspectRatio), 
                maxDimensions.height);
        }
    }
}