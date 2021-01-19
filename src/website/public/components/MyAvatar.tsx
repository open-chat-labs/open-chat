import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import DefaultAvatar from "./DefaultAvatar";

export default MyAvatar;

function MyAvatar() {
    const usersState = useSelector((state: RootState) => state.usersState);
    return (
        <label className="avatar-button">
            <DefaultAvatar userId={usersState.me?.userId ?? null} />
            <input 
                className="hide" 
                type="file" 
                accept=".jpg, .jpeg, .png, .gif" 
                onChange={e => onAvatarFileSelected(e)} />
        </label>                
    );
}

function onAvatarFileSelected(event: any) {
    let files = event.target.files;
    if (!files || !files[0]) {
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e: any) {
        let avatarElem = document.getElementById("myAvatar");
        if (avatarElem != null) {
            let base64String = btoa(String.fromCharCode(...new Uint8Array(e.target.result)));
            avatarElem.setAttribute("src", "data:*/*;base64," + base64String);
        }
    }
    reader.readAsArrayBuffer(files[0]);
}
