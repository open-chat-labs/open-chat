import React, { useState } from "react";
import { Option } from "../model/common";
import { CyclesContent as Cycles } from "../model/messages";
import * as cycleFunctions from "../utils/cycleFunctions";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles,
    sentByMe: boolean,
    theirUsername: Option<string>
}

function CyclesContent(props : Props): JSX.Element {
    const amount = props.content.amount;
    const cycles = cycleFunctions.toT(amount);
    const pounds = cycleFunctions.toCurrency(amount, "GBP").toFixed(2);

    return (
        <>
            <span>{cycles} T (£{pounds}) {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</span>
        </>
    );
}
