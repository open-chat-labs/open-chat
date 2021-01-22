import React from "react";
import { useDispatch, useSelector } from "react-redux";
import sendMessage from "../actions/chats/sendMessage";
import Paperclip from "../assets/icons/paperclip.svg";
import { Chat } from "../model/chats";
import { SendMessageContent } from "../model/messages";

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
                onChange={onMediaSelected}/>
        </label>
    );

    function onMediaSelected(event: any) {
        let files = event.target.files;
        if (!files || !files[0]) {
            return;
        }
        const file: File = files[0];
        const reader = new FileReader();
        reader.onload = function(e: any) {
            const mimeType = file.type;
            let content: SendMessageContent;
            if (mimeType.startsWith("video/") || mimeType.startsWith("image/")) {
                content = {
                    kind: "media", 
                    caption: null,
                    mimeType: mimeType,
                    data: new Uint8Array(e.target.result)
                };
            } else {
                content = {
                    kind: "file", 
                    name: file.name,
                    mimeType: mimeType,
                    data: new Uint8Array(e.target.result)
                };
            }

            dispatch(sendMessage(props.chat!, content));
        }
        reader.readAsArrayBuffer(file);
    }        
 }

