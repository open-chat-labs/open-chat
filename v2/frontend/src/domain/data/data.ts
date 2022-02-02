export interface BlobReference {
    blobId: bigint;
    canisterId: string;
}

export interface DataContent {
    blobReference?: BlobReference;
    blobData?: Uint8Array;
    blobUrl?: string;
}

export type UploadDataResponse = StorageStatus & {
    success: boolean;
};

export type StorageStatus = {
    byteLimit: bigint;
    bytesUsed: bigint;
};
