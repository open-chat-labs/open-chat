import React from "react";
import { Avatar, makeStyles, Theme } from "@material-ui/core";
import GroupChatIcon from "../assets/icons/groupChatIcon.svg";

type Props = {
    size: "sm" | "md"
}

export default React.memo(DefaultGroupChatIcon);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    icon: {
        height: props => props.size === "md" ? theme.avatars.md.size : theme.avatars.sm.size,
        width: props => props.size === "md" ? theme.avatars.md.size : theme.avatars.sm.size,
    }
}));

function DefaultGroupChatIcon(props: Props) : JSX.Element {
    const classes = useStyles(props);

    return (
        <Avatar className={classes.icon}>
            <GroupChatIcon />
        </Avatar>
    );
}
