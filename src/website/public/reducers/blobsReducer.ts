import produce from "immer";
import * as setFunctions from "../utils/setFunctions";

import {
    GET_DATA_REQUESTED,
    GET_DATA_SUCCEEDED,
    GetDataRequestedEvent,
    GetDataSucceededEvent
} from "../actions/data/getData";

import {
    PUT_DATA_REQUESTED,
    PUT_DATA_FAILED,
    PutDataRequestedEvent,
    PutDataFailedEvent
} from "../actions/data/putData";

export type BlobsState = {
    blobs: any,
    blobsDownloading: string[]
}

const initialState: BlobsState = {
    blobs: {},
    blobsDownloading: []
};

type Event =
    GetDataRequestedEvent | 
    GetDataSucceededEvent |
    PutDataRequestedEvent |
    PutDataFailedEvent ;

export default produce((state: BlobsState, event: Event) => {
    switch (event.type) {
        case GET_DATA_REQUESTED: {
            const { key } = event.payload;
            setFunctions.add(state.blobsDownloading, key);
            break;
        }

        case GET_DATA_SUCCEEDED: {
            const { key, data } = event.payload;
            state.blobs[key] = data;
            setFunctions.remove(state.blobsDownloading, key);
            break;
        }

        case PUT_DATA_REQUESTED: {
            const { key, data } = event.payload;
            // Assume Put will succeed and remove blob if it fails
            state.blobs[key] = data;
            break;
        }

        case PUT_DATA_FAILED: {
            const { key } = event.payload;
            delete state.blobs[key];
            break;
        }
    }
}, initialState);
