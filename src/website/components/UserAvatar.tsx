import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, Badge, makeStyles, Theme } from "@material-ui/core";
import Identicon from "identicon.js";
import md5 from "md5";
import UnknownUserAvatar from "../assets/icons/unknownUserAvatar.svg";
import { Option } from "../domain/model/common";
import { UserId } from "../domain/model/users";
import getChunk, { GetChunkResponse } from "../services/data/getChunk";
import { dataToBlobUrl } from "../utils/blobFunctions";

type Props = {
    size: "sm" | "md",
    isUserOnline: boolean,
    userId: Option<UserId>,
    imageId: Option<string>,
    blobUrl: Option<string>
}

UserAvatar.defaultProps = {
    blobUrl: null
};

export default React.memo(UserAvatar);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    avatar: {
        height: props => props.size === "md" ? theme.avatars.md.size : theme.avatars.sm.size,
        width: props => props.size === "md" ? theme.avatars.md.size : theme.avatars.sm.size
    },
    userOnlineMarker: {
        backgroundColor: "#32cd32",
        color: "white",
        boxShadow: "0 0 0 2px #ededed",
        height: props => props.size === "md" ? theme.avatars.md.userOnlineMarkerSize : theme.avatars.sm.userOnlineMarkerSize,
        width: props => props.size === "md" ? theme.avatars.md.userOnlineMarkerSize : theme.avatars.sm.userOnlineMarkerSize,
        borderRadius: "50%"
    }
}));

function UserAvatar(props: Props) : JSX.Element {
    let icon: JSX.Element;
    const isLoading = useRef(false);
    const unmounted = useRef(false);
    const blobsToRevoke = useRef<string[]>([]);
    const [src, setSrc] = useState(() => setInitialSrc(props));
    const classes = useStyles(props);

    useEffect(() => {
        if (!props.userId) {
            if (src) {
                setSrc(null);
            }
            return;
        }

        if (!props.imageId) {
            setSrc(buildIdenticonUrl(props.userId));
        } else if (!props.blobUrl && !isLoading.current) {
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
    }, [props.userId, props.imageId]);
    
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
        icon = <Avatar className={classes.avatar} src={src} />
        if (props.isUserOnline) {
            icon = (
                <Badge
                    classes={{ root: classes.avatar, badge: classes.userOnlineMarker }}
                    variant="dot"
                    overlap="circle"
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                    }}>
                    {icon}
                </Badge>
            );
        }
    } else {
        icon = (
            <Avatar className={classes.avatar}>
                <UnknownUserAvatar />
            </Avatar>
        );
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

    return icon;
}
