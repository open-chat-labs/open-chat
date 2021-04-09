import React from "react";
import Avatar from "@material-ui/core/Avatar";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(CircularIcon);

type Props = {
    svg: JSX.Element,
    size: "sm" | "md"
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    icon: {
        color: theme.colors.icon.color,
        backgroundColor: theme.colors.icon.backgroundColor,
        height: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        width: props => props.size === "md" ? theme.avatarSize.md : theme.avatarSize.sm,
        "& .background": {
            fill: theme.colors.icon.backgroundColor
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
