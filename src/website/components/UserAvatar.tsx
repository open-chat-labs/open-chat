import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Option } from "../domain/model/common";
import Identicon from "identicon.js";
import md5 from "md5";
import UnknownUserAvatar from "../assets/icons/unknownUserAvatar.svg";
import dataService, { GetDataResponse } from "../services/data/service";
import { UserId } from "../domain/model/users";
import { dataToBlobUrl } from "../utils/blobFunctions";
import UserOnlineMarker from "./UserOnlineMarker";

type Props = {
    isUserOnline: boolean,
    userId: Option<UserId>,
    imageId: Option<string>,
    blobUrl: Option<string>
}

UserAvatar.defaultProps = {
    blobUrl: null
};

export default React.memo(UserAvatar);

function UserAvatar(props: Props) : JSX.Element {
    let icon: JSX.Element;
    const isLoading = useRef(false);
    const unmounted = useRef(false);
    const blobsToRevoke = useRef<string[]>([]);
    const [src, setSrc] = useState(() => setInitialSrc(props));

    useEffect(() => {
        if (props.imageId && !props.blobUrl && !isLoading.current) {
            // Start loading the image from the IC and once loaded set the image src
            isLoading.current = true;
            dataService.getData(props.imageId).then((res: GetDataResponse) => {
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
        } else if (!props.imageId && props.userId) {
            // If the user removes their profile image show the identicon
            setSrc(buildIdenticonUrl(props.userId));
        }
    }, [props.imageId]);
    
    useLayoutEffect(() => {
        return () => {
            unmounted.current = true
        };
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

    function setInitialSrc(props: Props): Option<string> {
        return props.userId && !props.imageId 
            ? buildIdenticonUrl(props.userId) 
            : null;
    }

    function buildIdenticonUrl(userId: UserId) {
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
