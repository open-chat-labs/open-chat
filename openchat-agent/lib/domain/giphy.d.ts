export declare type SearchResponse = {
    data: GIFObject[];
    pagination: PaginationObject;
    meta: MetaObject;
};
export declare type PagedGIFObject = GIFObject & {
    groupKey: number;
    key: number;
};
export declare type GIFObject = {
    type: string;
    id: string;
    slug: string;
    url: string;
    embeded_url: string;
    title: string;
    images: ImagesObject;
};
export declare type ImagesObject = {
    fixed_height: MultiformatImage;
    fixed_width: MultiformatImage;
    downsized_large: ImageVariant;
    original: MultiformatImage;
};
export declare type NormalisedImage = ImageVariant & {
    type: "gif" | "mp4";
};
export declare type ImageVariant = {
    url: string;
    height: number;
    width: number;
};
export declare type MultiformatImage = ImageVariant & {
    mp4: string;
    webp: string;
};
export declare type PaginationObject = {
    offset: number;
    total_count: number;
    count: number;
};
export declare type MetaObject = {
    msg: string;
    status: number;
    response_id: string;
};
