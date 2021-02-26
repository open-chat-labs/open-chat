import React from "react";
import GroupChatIconSvg from "../assets/icons/groupChatIcon.svg";
import CircleIcon from "./CircleIcon";

export default React.memo(DefaultGroupChatIcon);

type Props = {
    size: "sm" | "md"
}

function DefaultGroupChatIcon(props: Props) : JSX.Element {
    return <CircleIcon svg={<GroupChatIconSvg />} size={props.size} />;
}
