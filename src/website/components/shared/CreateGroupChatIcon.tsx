import React from "react";
import CreateGroupChatIconSvg from "../../icons/createGroupChat.svg"
import CircularIcon from "./CircularIcon";

export default CreateGroupChatIcon;

type Props = {
    size: "sm" | "md"
}

function CreateGroupChatIcon(props: Props) {
    return <CircularIcon svg={<CreateGroupChatIconSvg />} size={props.size} />
}