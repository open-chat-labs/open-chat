import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Paperclip from "../../assets/icons/paperclip.svg";
import { DraftMessageContent } from "../../domain/model/messages";
import { dataToBlobUrl } from "../../utils/blobFunctions";
import Dimensions from "../../utils/Dimensions";

export interface Props {
    className: string,
    onFileSelected: (content: DraftMessageContent) => void
}

export default React.memo(AttachFile);

function AttachFile(props: Props) {
    return (
        <IconButton component="label" className={props.className}>
            <Paperclip />
            <input 
                hidden={true}
                type="file" 
                onChange={onMediaSelected} />
        </ IconButton>
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
            let content: DraftMessageContent;
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
                    blobUrl,
                    thumbnailData: extract.thumbnailData
                };
            } else {
                content = {
                    kind: "file", 
                    caption: null,
                    name: file.name,
                    mimeType: mimeType,
                    data: new Uint8Array(e.target.result)
                };
            }

            props.onFileSelected(content);
        }
        reader.readAsArrayBuffer(file);
    }        

    async function extractImageThumbnail(blobUrl: string) {
        return new Promise<MediaExtract>((resolve, _) => {
            const img = new Image;    
            img.onload = function() {
                const extract = extractThumbnail(img, new Dimensions(img.width, img.height));
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