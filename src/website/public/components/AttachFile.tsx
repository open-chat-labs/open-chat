import React from "react";
import { useDispatch, useSelector } from "react-redux";
import sendMessage from "../actions/chats/sendMessage";
import Paperclip from "../assets/icons/paperclip.svg";
import { Chat } from "../model/chats";

export interface Props {
    chat: Chat
}

export default React.memo(AttachFile);

function AttachFile(props: Props) {
    const dispatch = useDispatch();

    return (
        <label className="attach">
            <Paperclip />
            <input 
                className="hide" 
                type="file" 
                accept="image/*,video/mp4,video/webm,video/ogg" 
                onChange={onMediaSelected}/>
        </label>
    );

    function onMediaSelected(event: any) {
        let files = event.target.files;
        if (!files || !files[0]) {
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e: any) {
            dispatch(sendMessage(props.chat!, {
                kind: "media", 
                caption: null,
                // TODO: Could try sniffing file for mimetype
                // https://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload
                mimeType: files[0].type,
                blob: new Uint8Array(e.target.result)
            }));
        }
        reader.readAsArrayBuffer(files[0]);
    }        
 }

