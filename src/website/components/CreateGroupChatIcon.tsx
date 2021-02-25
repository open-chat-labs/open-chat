import React from "react";
import Avatar from "@material-ui/core/Avatar";
import CreateGroupChatIconSvg from "../assets/icons/createGroupChat.svg"
import { makeStyles, Theme } from "@material-ui/core";

export default CreateGroupChatIcon;

type Props = {
    color: string,
    backgroundColour: string
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    icon: {
        color: props => props.color,
        backgroundColor: props => props.backgroundColour
    }
}));

function CreateGroupChatIcon(props: Props) {
    const classes = useStyles(props);

    return (
        <Avatar className={classes.icon}>
            <CreateGroupChatIconSvg className={classes.svg} />
        </Avatar>
    );
}