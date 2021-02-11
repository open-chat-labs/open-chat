import React from "react";
import Identicon from "identicon.js";
import md5 from "md5";
import { Option } from "../domain/model/common";
import { UserId } from "../domain/model/users";
import UnknownUserAvatar from "../assets/icons/unknownUserAvatar.svg";

type Props = {
    userId: Option<UserId>
}

export default React.memo(DefaultAvatar);

function DefaultAvatar(props: Props) : JSX.Element {

    let icon : JSX.Element;

    if (props.userId) {
        const hash = md5(props.userId);

        const data = new Identicon(hash, { margin: 0, format: 'svg' }).toString();
        
        icon = <img id="myAvatar" className="avatar" src={"data:image/svg+xml;base64," + data} />;
    } else {
        icon = <UnknownUserAvatar className="avatar" />;
    }

    return (icon);
}
