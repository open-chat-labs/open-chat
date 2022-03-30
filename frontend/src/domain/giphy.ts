export type SearchResponse = {
    data: GIFObject[];
    pagination: PaginationObject;
    meta: MetaObject;
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
    fixed_height: ImageVariant;
    fixed_width: ImageVariant;
};

export type ImageVariant = {
    url: string;
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
