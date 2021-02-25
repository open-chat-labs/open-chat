import { Dispatch } from "react";
import { v1 as uuidv1 } from "uuid";
import { UserId } from "../../domain/model/users";
import dataService, { DataSource } from "../../services/data/CachingDataService";
import usersService from "../../services/userMgmt/service";
import { SetProfileImageResponse } from "../../services/userMgmt/setProfileImage";
import { dataToBlobUrl } from "../../utils/blobFunctions";

export const SET_PROFILE_IMAGE_REQUESTED = "SET_PROFILE_IMAGE_REQUESTED";
export const SET_PROFILE_IMAGE_SUCCEEDED = "SET_PROFILE_IMAGE_SUCCEEDED";
export const SET_PROFILE_IMAGE_FAILED = "SET_PROFILE_IMAGE_FAILED";
export const SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED = "SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED";

export default function(userId: UserId, data: Uint8Array) {
    return async (dispatch: Dispatch<any>) => {
        const imageId = uuidv1().toString();

        // Start uploading the image data
        let putDataTask = dataService.putData(DataSource.Avatar, imageId, data, true);

        const blobUrl = dataToBlobUrl(data, null);

        // Dispatch the set profile image requested event - this will set the imageBlobUrl on "my profile" which will render the avatar image
        const requestEvent: SetProfileImageRequestedEvent = {
            type: SET_PROFILE_IMAGE_REQUESTED,
            payload: {
                userId,
                imageId,
                blobUrl
            }
        };

        dispatch(requestEvent);

        // Wait for the media data to finish uploading
        const succeeded = await putDataTask;
        if (!succeeded) {                
            const outcomeEvent: SetProfileImageDataUploadFailedEvent = { 
                type: SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED,
                payload: {
                    userId,
                    imageId,
                } 
            };
            dispatch(outcomeEvent);
            return;
        }

        // Set the imageId against the user profile on the IC
        const response = await usersService.setProfileImage(imageId);

        let outcomeEvent: SetProfileImageOutcome;
        if (response === SetProfileImageResponse.Success) {
            outcomeEvent = {
                type: SET_PROFILE_IMAGE_SUCCEEDED,
                payload: {
                    userId,
                    imageId,
                    blobUrl
                }
            };
        } else {
            outcomeEvent = {
                type: SET_PROFILE_IMAGE_FAILED,
                payload: {
                    userId,
                    imageId,
                }
            };
        }

        dispatch(outcomeEvent);

        return outcomeEvent;
    }
}

export type SetProfileImageOutcome = SetProfileImageSucceededEvent | SetProfileImageFailedEvent;

export type SetProfileImageRequestedEvent = {
    type: typeof SET_PROFILE_IMAGE_REQUESTED,
    payload: {
        userId: UserId,
        imageId: string,
        blobUrl: string
    }
}

export type SetProfileImageSucceededEvent = {
    type: typeof SET_PROFILE_IMAGE_SUCCEEDED,
    payload: {
        userId: UserId,
        imageId: string,
        blobUrl: string
    }
}

export type SetProfileImageFailedEvent = {
    type: typeof SET_PROFILE_IMAGE_FAILED,
    payload: {
        userId: UserId,
        imageId: string
    }
}

export type SetProfileImageDataUploadFailedEvent = {
    type: typeof SET_PROFILE_IMAGE_DATA_UPLOAD_FAILED,
    payload: {
        userId: UserId,
        imageId: string
    }
}
