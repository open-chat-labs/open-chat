import React from "react";
import { formatCycles } from "../formatters/cycles";
import { Option } from "../domain/model/common";
import { CyclesContent as Cycles } from "../domain/model/messages";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles,
    sentByMe: boolean,
    theirUsername: Option<string>
}

function CyclesContent(props : Props): JSX.Element {
    return (
        <span>{formatCycles(props.content.amount)} {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</span>
    );
}
