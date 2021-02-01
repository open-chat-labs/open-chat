import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import DefaultAvatar from "./DefaultAvatar";

export default React.memo(MyAvatar);

function MyAvatar() {
    const userId = useSelector((state: RootState) => state.usersState.me?.userId ?? null);
    return (
        <label className="avatar-button">
            <DefaultAvatar userId={userId} />
            <input 
                className="hide" 
                type="file" 
                accept=".jpg, .jpeg, .png, .gif" 
                onChange={onAvatarFileSelected} />
        </label>                
    );
}

function onAvatarFileSelected(event: any) {
    let files = event.target.files;
    if (!files || !files[0]) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e: any) {
        const avatarElem = document.getElementById("myAvatar");
        if (avatarElem != null) {
            const base64String = "data:*/*;base64," + btoa(String.fromCharCode(...e.target.result));
            avatarElem.setAttribute("src", base64String);
        }
    }
    reader.readAsArrayBuffer(files[0]);
}
