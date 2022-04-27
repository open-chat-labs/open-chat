import type { StoredMediaContent } from "../chat/chat";

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
    content: StoredMediaContent | undefined;
};

export type StorageStatus = {
    byteLimit: number;
    bytesUsed: number;
};
