import React from "react";
import { Typography } from "@material-ui/core";

export default React.memo(ParticipantsTyping);

type Props = {
    usernames: string[]
}

function ParticipantsTyping(props: Props) {
    if (!props.usernames.length) {
        return null;
    }

    let text: string;
    if (props.usernames.length === 1) {
        text = `${props.usernames[0]} is typing...`;
    } else {
        text = props.usernames[0];
        for (const username in props.usernames) {
            text += `, ${username}`;
        }
        text += ` and ${props.usernames[props.usernames.length - 1]} are typing...`;
    }

    return (
        <Typography variant="caption">{text}</Typography>
    );
}
