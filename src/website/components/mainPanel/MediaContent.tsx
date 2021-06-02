import React, { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import dataService, { DataSource } from "../../services/data/CachingDataService";
import { dataToBlobUrl } from "../../utils/blobFunctions";
import { MediaContent as Media } from "../../domain/model/messages";
import Image from "../shared/Image";
import Video from "../shared/Video";

export interface Props {
    content: Media,
    className: string,
    ownsBlob: boolean
}

export default React.memo(MediaContent);

function MediaContent(props: Props): JSX.Element {
    const content = props.content;
    const ownedBlobUrl = props.ownsBlob ? content.blobUrl : null;
    const unmounted = useRef(false);
    const loaded = useRef(false);
    const src = useRef(ownedBlobUrl ?? content.thumbnailData);

    // https://reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
    const [_, forceUpdate] = useReducer(x => x + 1, 0);

    useLayoutEffect(() => {
        return () => {
            unmounted.current = true
        };
    }, []);

    useEffect(() => {
        async function fetchMedia() {
            const response = await dataService.getData(
                DataSource.MediaMessage, 
                content.id, 
                content.size, 
                content.chunkSize);

            if (response.kind !== "success") {
                console.log(response);
                return;
            }
            
            if (!unmounted.current) {
                src.current = dataToBlobUrl(response.data, content.mimeType);
                loaded.current = true;
                forceUpdate();
            }
        }

        if (!ownedBlobUrl && !props.content.blobDeleted) {
            fetchMedia();
        }

        return () => {
            // Dispose of blob
            if (loaded.current) {
                setTimeout(() => {
                    URL.revokeObjectURL(src.current);
                }, 100);                
            }
        }
    }, []);

    let contentElement;
    if (content.mimeType.startsWith("image/") || (!loaded.current && !ownedBlobUrl)) {
        contentElement = <Image key={props.content.id} src={src.current} className={props.className} />;
    } else if (content.mimeType.startsWith("video/")) {
        contentElement = <Video key={props.content.id} src={src.current} className={props.className} />;
    }

    return (
        <>
            {contentElement}
        </>
    );
}
