import React from "react";
import { Avatar, makeStyles, Theme } from "@material-ui/core";

export default React.memo(CircularIcon);

type Props = {
    svg: JSX.Element,
    size: "sm" | "md"
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    icon: {
        color: theme.customColors.icon.color,
        backgroundColor: theme.customColors.icon.backgroundColor,
        height: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        width: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        "& .background": {
            fill: theme.customColors.icon.backgroundColor
        }
    }
}));

function CircularIcon(props: Props) : JSX.Element {
    const classes = useStyles(props);

    return (
        <Avatar className={classes.icon}>
            {props.svg}
        </Avatar>
    );
}
