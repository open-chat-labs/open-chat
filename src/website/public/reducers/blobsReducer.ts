import produce from "immer";
import * as setFunctions from "../utils/setFunctions";

import {
    GET_DATA_REQUESTED,
    GET_DATA_SUCCEEDED,
    GetDataRequestedEvent,
    GetDataSucceededEvent
} from "../actions/data/getData";

export type BlobsState = {
    blobs: any,
    blobsDownloading: []
}

type Event = GetDataRequestedEvent | GetDataSucceededEvent;

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
    }
}, { blobs: {} });
