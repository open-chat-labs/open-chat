import React, { useState } from "react";
import { useDispatch } from "react-redux";
import sendMessage from "../actions/chats/sendMessage";
import getCurrentUser from "../actions/users/getCurrentUser";
import Dollar from "../assets/icons/dollar.svg";
import { formatCycles } from "../formatters/cycles";
import { Chat } from "../model/chats";
import { SendMessageContent } from "../model/messages";
import { MyProfile, UserSummary } from "../model/users";
import * as cycleFunctions from "../utils/cycleFunctions";

const PLACEHOLDER_TEXT = "Enter amount...";

export default React.memo(SendCycles);

type Props = {
    chat: Chat,
    myProfile: MyProfile,
    recipient: UserSummary,
    onHidePicker: () => void,
}

function SendCycles(props: Props) {
    const dispatch = useDispatch();
    const [text, setText] = useState("");
    const clearInput = () => setText("");

    // Go fetch the current user - specifically we are interested in the latest account balance    
    React.useEffect(() => {
        dispatch(getCurrentUser());
    }, []);

    function sendCycles() {
        toggleDialog();

        const content: SendMessageContent = {
            kind: "cycles",
            amount: cycleFunctions.fromT(parseFloat(text)),
            caption: null
        };

        dispatch(sendMessage(props.chat!, content));
        clearInput();
    }

    return (
        <div className="send-cycles-container">
            <div id="sendCyclesDialog" className="send-cycles-dialog hide-on-click-outside hide">
                <div>
                    <h2>Send cycles to {props.recipient.username}</h2>
                    <p>Current balance: {formatCycles(props.myProfile.accountBalance)}</p>
                    <div>
                        <input 
                            id="cyclesInput" 
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder={PLACEHOLDER_TEXT} 
                            type="number"
                            max="100"
                            min="0.0001"
                            required 
                            /> T cycles
                        </div>
                    <div className="button-container">
                        <button onClick={sendCycles} type="button">Send</button>
                    </div>
                </div>
            </div>
            <div className="dollar button hide-on-click-ignore" onClick={toggleDialog}>
                <Dollar />
            </div>
        </div>
    );

    function toggleDialog() {
        const elemClassList = document.getElementById("sendCyclesDialog")!.classList;
        elemClassList.toggle("hide");
        if (elemClassList.contains("hide")) {
            props.onHidePicker();
        } else {
            focusOnCyclesInput();
        }
    }

    function focusOnCyclesInput() {
        document.getElementById("cyclesInput")?.focus();
    }
}

