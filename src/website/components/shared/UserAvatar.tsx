import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import Identicon from "identicon.js";
import md5 from "md5";
import UnknownUserAvatar from "../../icons/unknownUserAvatar.svg";
import { Option } from "../../domain/model/common";
import dataService, { DataSource, GetDataResponse } from "../../services/data/CachingDataService";
import { UserId } from "../../domain/model/users";
import { dataToBlobUrl } from "../../utils/blobFunctions";
import CircularIcon from "./CircularIcon";
import useTheme from "@material-ui/core/styles/useTheme";

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
        height: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        width: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm
    },
    userOnlineMarker: {
        backgroundColor: theme.colors.green.main,
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
    const userOnlineMarkerRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();

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

    // Set the boxShadow of the userOnlineMarker based on the first non-transparent parent's backgroundColor, then
    // listen for changes to that backgroundColor and update the boxShadow on each change
    useLayoutEffect(() => {
        const userOnlineMarker = userOnlineMarkerRef.current;
        if (!userOnlineMarker) {
            return;
        }

        const dot = userOnlineMarker.getElementsByClassName("MuiBadge-dot")[0] as HTMLElement;
        const backgroundColorElem = getFirstNonTransparentParent(userOnlineMarker);

        const setBoxShadowColor = function() {
            const latestBackgroundColor = window.getComputedStyle(backgroundColorElem).backgroundColor;
            dot.style.boxShadow = "0 0 0 2px " + latestBackgroundColor;
        };

        setBoxShadowColor();

        // Listen for style / class changes or for hover started / stopped
        const observer = new MutationObserver(setBoxShadowColor);
        observer.observe(backgroundColorElem, { attributes: true });
        backgroundColorElem.addEventListener("mouseenter", setBoxShadowColor);
        backgroundColorElem.addEventListener("mouseleave", setBoxShadowColor);

        return () => {
            // Dispose of all the listeners
            observer.disconnect();
            backgroundColorElem.removeEventListener("mouseenter", setBoxShadowColor);
            backgroundColorElem.removeEventListener("mouseleave", setBoxShadowColor);
        }
    }, [src, props.isUserOnline, theme]);

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
                    ref={userOnlineMarkerRef}
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

    function getFirstNonTransparentParent(elem: HTMLElement) : HTMLElement {
        let currentElem: Option<HTMLElement> = elem;
        do {
            const backgroundColor = window.getComputedStyle(currentElem).backgroundColor;
            if (!backgroundColor.startsWith("rgba")) {
                return currentElem;
            }
            const alpha = parseInt(backgroundColor.split("(")[1].split(")")[0].split(",")[3]);
            // If alpha is 0 then this element is transparent
            if (alpha > 0) {
                return currentElem;
            }
            currentElem = currentElem.parentElement;
        }
        while (currentElem)

        // This should never happen
        throw new Error();
    }

    return icon;
}
