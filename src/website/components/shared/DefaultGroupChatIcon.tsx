import React from "react";
import GroupChatIconSvg from "../../icons/groupChatIcon.svg";
import CircularIcon from "./CircularIcon";

export default React.memo(DefaultGroupChatIcon);

type Props = {
    size: "sm" | "md"
}

function DefaultGroupChatIcon(props: Props) : JSX.Element {
    return <CircularIcon svg={<GroupChatIconSvg />} size={props.size} />;
}
