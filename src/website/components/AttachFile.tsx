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

                const extract = mimeType.startsWith("image/")
                    ? await extractImageThumbnail(blobUrl)
                    : await extractVideoThumbnail(blobUrl)

                content = {
                    kind: "media", 
                    caption: null,
                    mimeType: mimeType,
                    width: extract.dimensions.width,
                    height: extract.dimensions.height,
                    data: new Uint8Array(e.target.result),
                    thumbnailData: extract.thumbnailData
                };
            } else {
                content = {
                    kind: "file", 
                    name: file.name,
                    mimeType: mimeType,
                    data: new Uint8Array(e.target.result)
                };
            }

            dispatch(sendMessage(props.chat!, content, null));
        }
        reader.readAsArrayBuffer(file);
    }        

    async function extractImageThumbnail(blobUrl: string) {
        return new Promise<MediaExtract>((resolve, _) => {
            const img = new Image;    
            img.onload = function() {
                const extract = extractThumbnail(img, new Dimensions(img.width, img.height));
                URL.revokeObjectURL(blobUrl);
                resolve(extract);
            }
            img.src = blobUrl;
        });
    }

    async function extractVideoThumbnail(blobUrl: string) {
        return new Promise<MediaExtract>((resolve, _) => {
            const video = document.createElement("video");
            video.addEventListener("loadedmetadata", function () {
                video.addEventListener("seeked", function () {
                    const extract = extractThumbnail(video, new Dimensions(this.videoWidth, this.videoHeight));
                    URL.revokeObjectURL(blobUrl);
                    resolve(extract);
                });
                video.currentTime = 1;
            });
            video.src = blobUrl;
        });
    }

    function extractThumbnail(original: HTMLImageElement | HTMLVideoElement, dimensions: Dimensions): MediaExtract {
        const thumbnailDimensions = dimensions.scaleToFit(new Dimensions(20, 20));
        const canvas = document.createElement("canvas");
        canvas.width = thumbnailDimensions.width;
        canvas.height = thumbnailDimensions.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(original, 0, 0, canvas.width, canvas.height);
        return{
            dimensions: dimensions,
            thumbnailData: canvas.toDataURL()
        };
    }

    type MediaExtract = {
        dimensions: Dimensions,
        thumbnailData: string
    }
}