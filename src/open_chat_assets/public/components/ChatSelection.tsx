import React from "react";
import { useDispatch } from "react-redux";

import selectChat from "../actions/chats/selectChat";

type Props = {
    name: string,
    index: number
}

export default function(props: Props) {
    const dispatch = useDispatch();

    return (
        <li onClick={() => dispatch(selectChat(props.index))}>
            <span>{props.name}</span>
        </li>
    );
}
