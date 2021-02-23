import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Option } from "../domain/model/common";
import Identicon from "identicon.js";
import md5 from "md5";
import UnknownUserAvatar from "../assets/icons/unknownUserAvatar.svg";
import { UserId } from "../domain/model/users";
import getChunk, { GetChunkResponse } from "../services/data/getChunk";
import { dataToBlobUrl } from "../utils/blobFunctions";
import UserOnlineMarker from "./UserOnlineMarker";

type Props = {
    isUserOnline: boolean,
    userId: Option<UserId>,
    imageId: Option<string>,
    blobUrl: Option<string>
}

DefaultAvatar.defaultProps = {
    blobUrl: null
};

export default React.memo(DefaultAvatar);

function DefaultAvatar(props: Props) : JSX.Element {
    let icon: JSX.Element;
    const isLoading = useRef(false);
    const unmounted = useRef(false);
    const blobsToRevoke = useRef([] as string[]);
    const [src, setSrc] = useState(() => buildInitialSrc(props.userId));

    useEffect(() => {
        if (props.imageId && !props.blobUrl && !src?.startsWith("blob:") && !isLoading.current) {
            // Start loading the image from the IC and once loaded set the image src
            isLoading.current = true;
            getChunk(props.imageId, 0).then((res: GetChunkResponse) =>  {
                isLoading.current = false;
                if (res.kind !== "success") { 
                    return; 
                }
                if (!unmounted.current) {
                    const blobUrl = dataToBlobUrl(res.data, null);
                    blobsToRevoke.current.push(blobUrl);
                    setSrc(blobUrl);
                }
            });            
        }
    }, [props.imageId]);

    useLayoutEffect(() => {
        unmounted.current = true;
    }, []);

    useEffect(() => {
        return () => {
            for (const blobUrl of blobsToRevoke.current) {
                URL.revokeObjectURL(blobUrl);
            }
        }
    }, []);
 
    if (src) {
        icon = <img className="avatar" src={props.blobUrl ?? src} />;
    } else {
        icon = <UnknownUserAvatar className="avatar" />;
    }

    function buildInitialSrc(userId: Option<UserId>): Option<string> {
        if (!userId) {
            return null;
        }

        const identicon = new Identicon(
            md5(userId), 
            { margin: 0, format: 'svg' });

        return "data:image/svg+xml;base64," + identicon.toString();
    }

    return (
        <>
            <div className="icon-container">{icon}</div>
            {props.isUserOnline ? <UserOnlineMarker /> : null }
        </>
    );
}
