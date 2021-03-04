import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import Identicon from "identicon.js";
import md5 from "md5";
import UnknownUserAvatar from "../assets/icons/unknownUserAvatar.svg";
import { Option } from "../domain/model/common";
import dataService, { DataSource, GetDataResponse } from "../services/data/CachingDataService";
import { UserId } from "../domain/model/users";
import { dataToBlobUrl } from "../utils/blobFunctions";
import CircularIcon from "./CircularIcon";

type Props = {
    size: "sm" | "md",
    isUserOnline: boolean,
    userId: Option<UserId>,
    imageId: Option<string>,
    blobUrl: Option<string>,
    parentBackgroundColor: string
}

UserAvatar.defaultProps = {
    blobUrl: null
};

export default React.memo(UserAvatar);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    avatar: {
        height: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        width: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm
    },
    icon: theme.customColors.icon,
    userOnlineMarker: {
        backgroundColor: theme.customColors.green.main,
        boxShadow: props => "0 0 0 2px " + props.parentBackgroundColor,
        height: props => props.size === "md" ? theme.avatarSize.md / 4 : theme.avatarSize.sm / 4,
        width: props => props.size === "md" ? theme.avatarSize.md / 4 : theme.avatarSize.sm / 4,
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
            dataService.getData(DataSource.Avatar, props.imageId)
                .then((res: GetDataResponse) => {
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
        icon = <Avatar className={classes.avatar} src={props.blobUrl ? props.blobUrl : src} />
        if (props.isUserOnline) {
            icon = (
                <Badge
                    classes={{ root: classes.avatar, badge: classes.userOnlineMarker }}
                    variant="dot"
                    overlap="circular"
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                    }}>
                    {icon}
                </Badge>
            );
        }
    } else {
        icon = <CircularIcon size={props.size} svg={<UnknownUserAvatar />} />;
    }

    function setInitialSrc(props: Props) : Option<string> {
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
