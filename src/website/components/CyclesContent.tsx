import React from "react";
import { CyclesContent as Cycles } from "../model/messages";
import * as cycleFunctions from "../utils/cycleFunctions";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles
}

function CyclesContent(props : Props): JSX.Element {

    return (
        <>
            <div>{cycleFunctions.toT(props.content.amount)} T (£{cycleFunctions.toCurrency(props.content.amount, "GBP").toFixed(2)}) has been credited to your account!</div>
        </>
    );
}
