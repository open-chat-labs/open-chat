import React from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { RootState } from "../reducers";
import UserAvatar from "./UserAvatar";
import setProfileImage from "../actions/users/setProfileImage";

export default React.memo(MyAvatar);

type Props = {
    size: "sm" | "md",
    parentBackgroundColor: string
}

function MyAvatar(props: Props) {
    const dispatch = useDispatch();
    const userImage = useSelector((state: RootState) => {
        const me = state.usersState.me;
        return me ? {
            userId: me.userId,
            imageId: me.imageId,
            blobUrl: me.imageBlobUrl
        } : null;
    }, shallowEqual);

    const userExists = userImage !== null;

    function onAvatarFileSelected(event: any) {
        if (!userImage) {
            return;
        }
        let files = event.target.files;
        if (!files || !files[0]) {
            return;
        }
        const file: File = files[0];
        const reader = new FileReader();
        reader.onload = function(e: any) {
            // TODO: Check and scale image
            dispatch(setProfileImage(userImage.userId, new Uint8Array(e.target.result)));
        }
        reader.readAsArrayBuffer(file);
    }
    
    return (
        <label>
            <UserAvatar 
                isUserOnline={true}
                userId={userImage?.userId ?? null}
                imageId={userImage?.imageId ?? null}
                blobUrl={userImage?.blobUrl ?? null}
                size={props.size}
                parentBackgroundColor={props.parentBackgroundColor} />

            {userExists ? <input
                className="hide" 
                type="file" 
                accept=".jpg, .jpeg, .png, .gif" 
                onChange={onAvatarFileSelected} /> : null}            
        </label>                
    );
}

