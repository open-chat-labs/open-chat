import React from "react";
import { useDispatch } from "react-redux";
import sendMessage from "../actions/chats/sendMessage";
import Paperclip from "../assets/icons/paperclip.svg";
import { Chat } from "../domain/model/chats";
import { SendMessageContent } from "../domain/model/messages";
import { dataToBlobUrl } from "../utils/blobFunctions";
import Dimensions from "../utils/Dimensions";

export interface Props {
    chat: Chat
}

export default React.memo(AttachFile);

function AttachFile(props: Props) {
    const dispatch = useDispatch();

    return (
        <label className="attach button">
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
        reader.onload = async function(e: any) {
            const mimeType = file.type;
            let content: SendMessageContent;
            if (mimeType.startsWith("video/") || mimeType.startsWith("image/")) {
                
                const blobUrl = dataToBlobUrl(e.target.result, mimeType);

                const dimensions = mimeType.startsWith("image/")
                    ? await getImageDimensions(blobUrl)
                    : await getVideoDimensions(blobUrl)

                content = {
                    kind: "media", 
                    caption: null,
                    mimeType: mimeType,
                    width: dimensions.width,
                    height: dimensions.height,
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

    async function getImageDimensions(blobUrl: string) {
        return new Promise<Dimensions>((resolve, _) => {
            const img = new Image;    
            img.onload = function() {
                resolve(new Dimensions(img.width, img.height));
            }
            img.src = blobUrl;
        });
    }

    async function getVideoDimensions(blobUrl: string) {
        return new Promise<Dimensions>((resolve, _) => {
            const video = document.createElement("video");
            video.addEventListener("loadedmetadata", function () {
                resolve(new Dimensions(this.videoWidth, this.videoHeight));
            });
            video.src = blobUrl;
        });
    }
}