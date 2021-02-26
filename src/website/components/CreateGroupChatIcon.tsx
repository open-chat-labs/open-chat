import React from "react";
import CreateGroupChatIconSvg from "../assets/icons/createGroupChat.svg"
import CircleIcon from "./CircleIcon";

export default CreateGroupChatIcon;

type Props = {
    size: "sm" | "md"
}

function CreateGroupChatIcon(props: Props) {
    return <CircleIcon svg={<CreateGroupChatIconSvg />} size={props.size} />
}