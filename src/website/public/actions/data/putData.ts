import { Dispatch } from "react";

import dataService from "../../services/data/service";

export const PUT_DATA_REQUESTED = "PUT_DATA_REQUESTED";
export const PUT_DATA_SUCCEEDED = "PUT_DATA_SUCCEEDED";
export const PUT_DATA_FAILED = "PUT_DATA_FAILED";

export default function(key: string, data: Uint8Array) {
    return async (dispatch: Dispatch<any>) => {
        const requestEvent: PutDataRequestedEvent = {
            type: PUT_DATA_REQUESTED,
            payload: {
                key,
                data
            }
        };

        dispatch(requestEvent);

        const success = await dataService.putData(key, data);

        let outcomeEvent;
        if (success) {
            outcomeEvent = {
                type: PUT_DATA_SUCCEEDED,
                payload: {
                    key,
                    data
                }
            } as PutDataSucceededEvent;
        } else {
            outcomeEvent = {
                type: PUT_DATA_FAILED,
                payload: {
                    key,
                    data
                }
            } as PutDataFailedEvent;
        }

        dispatch(outcomeEvent);

        return outcomeEvent;
    }
}

export type PutDataOutcome = PutDataSucceededEvent | PutDataFailedEvent;

export type PutDataRequestedEvent = {
    type: typeof PUT_DATA_REQUESTED,
    payload: {
        key: string,
        data: Uint8Array
    }
}

export type PutDataSucceededEvent = {
    type: typeof PUT_DATA_SUCCEEDED,
    payload: {
        key: string,
        data: Uint8Array
    }
}

export type PutDataFailedEvent = {
    type: typeof PUT_DATA_FAILED,
    payload: {
        key: string,
        data: Uint8Array
    }
}
