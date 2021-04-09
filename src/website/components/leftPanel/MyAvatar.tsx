import React from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import UserAvatar from "../shared/UserAvatar";
import setProfileImage from "../../actions/users/setProfileImage";

export default React.memo(MyAvatar);

type Props = {
    size: "sm" | "md"
}

const useStyles = makeStyles((theme: Theme) => ({
    myAvatar: {
        cursor: "pointer"
    }
}));

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
    const classes = useStyles();

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
        <label className={classes.myAvatar}>
            <UserAvatar 
                isUserOnline={true}
                userId={userImage?.userId ?? null}
                imageId={userImage?.imageId ?? null}
                blobUrl={userImage?.blobUrl ?? null}
                size={props.size} />

            {userExists ? <input
                hidden={true}
                type="file" 
                accept=".jpg, .jpeg, .png, .gif" 
                onChange={onAvatarFileSelected} /> : null}            
        </label>                
    );
}

