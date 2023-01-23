export type SearchResponse = {
    data: GIFObject[];
    pagination: PaginationObject;
    meta: MetaObject;
};

export type PagedGIFObject = GIFObject & {
    groupKey: number;
    key: number;
};

export type GIFObject = {
    type: string;
    id: string;
    slug: string;
    url: string;
    embeded_url: string;
    title: string;
    images: ImagesObject;
};

export type ImagesObject = {
    fixed_height: MultiformatImage;
    fixed_width: MultiformatImage;
    downsized_large: ImageVariant;
    downsized: ImageVariant;
    original: MultiformatImage;
};

export type NormalisedImage = ImageVariant & { type: "gif" | "mp4" };

export type ImageVariant = {
    url: string;
    height: number;
    width: number;
};

export type MultiformatImage = ImageVariant & {
    mp4: string;
    webp: string;
};

export type PaginationObject = {
    offset: number;
    total_count: number;
    count: number;
};

export type MetaObject = {
    msg: string;
    status: number;
    response_id: string;
};
