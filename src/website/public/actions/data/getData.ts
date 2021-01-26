import { Dispatch } from "react";

import dataService from "../../services/data/service";

export const GET_DATA_REQUESTED = "GET_DATA_REQUESTED";
export const GET_DATA_SUCCEEDED = "GET_DATA_SUCCEEDED";
export const GET_DATA_FAILED = "GET_DATA_FAILED";

export default function(key: string, totalBytes: number, chunkSize: number, cacheResult: boolean) {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: GetDataRequestedEvent = {
            type: GET_DATA_REQUESTED,
            payload: {
                key,
                totalBytes,
                chunkSize,
                cacheResult
            }
        };

        dispatch(requestEvent);

        const response = await dataService.getData(key, totalBytes, chunkSize);

        let outcomeEvent;
        if (response.kind === "success") {
            outcomeEvent = {
                type: GET_DATA_SUCCEEDED,
                payload: {
                    key,
                    totalBytes,
                    chunkSize,
                    data: response.data,
                    cacheResult
                }
            } as GetDataSucceededEvent;
        } else {
            outcomeEvent = {
                type: GET_DATA_FAILED
            } as GetDataFailedEvent;
        }

        dispatch(outcomeEvent);

        return outcomeEvent;
    }
}

export type GetDataOutcome = GetDataSucceededEvent | GetDataFailedEvent;

export type GetDataRequestedEvent = {
    type: typeof GET_DATA_REQUESTED,
    payload: {
        key: string,
        totalBytes: number,
        chunkSize: number,
        cacheResult: boolean
    }
}

export type GetDataSucceededEvent = {
    type: typeof GET_DATA_SUCCEEDED,
    payload: {
        key: string,
        totalBytes: number,
        chunkSize: number,
        data: Uint8Array,
        cacheResult: boolean
    }
}

export type GetDataFailedEvent = {
    type: typeof GET_DATA_FAILED,
    payload: {
        key: string,
        totalBytes: number,
        chunkSize: number
    }
}
