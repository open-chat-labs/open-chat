import React, { useState } from "react";
import { useDispatch } from "react-redux";
import sendMessage from "../actions/chats/sendMessage";
import getCurrentUser, { GetCurrentUserOutcome } from "../actions/users/getCurrentUser";
import Dollar from "../assets/icons/dollar.svg";
import UpDownArrow from "../assets/icons/upDownArrow.svg";
import { formatCycles } from "../formatters/cycles";
import { Chat } from "../domain/model/chats";
import { SendMessageContent } from "../domain/model/messages";
import { UserSummary } from "../domain/model/users";
import * as cycleFunctions from "../utils/cycleFunctions";

export default React.memo(SendCycles);

type Props = {
    chat: Chat,
    recipient: UserSummary,
    onHidePicker: () => void,
}

function SendCycles(props: Props) {
    const dispatch = useDispatch();
    const [cycles, setCycles] = useState("");
    const [pounds, setPounds] = useState("");
    const [balance, setBalance] = useState("...");

    function sendCycles() {
        toggleDialog();

        const content: SendMessageContent = {
            kind: "cycles",
            amount: cycleFunctions.fromT(parseFloat(cycles)),
            caption: null
        };

        dispatch(sendMessage(props.chat!, content));
    }

    return (
        <div className="send-cycles-container">
            <div id="sendCyclesDialog" className="send-cycles-dialog hide-on-click-outside hide">
                <div>
                    <div className="cycles-balance">Current balance <strong>{balance}</strong></div>
                    <div className="cycles-container">
                        <input 
                            id="cyclesInput" 
                            value={cycles}
                            onChange={e => onCyclesChanged(e.target.value)}
                            placeholder="Enter cycles..." 
                            type="number"
                            max="100"
                            min="0.0001"
                            required 
                            /> T
                    </div>
                    <UpDownArrow />
                    <div className="pounds-container">
                        <input 
                            id="poundsInput" 
                            value={pounds}
                            onChange={e => onPoundsChanged(e.target.value)}
                            placeholder="Enter GBP..." 
                            type="number"
                            max="100"
                            min="0.0001"
                            required 
                            /> £
                    </div>
                    <div className="button-container">
                        <button onClick={sendCycles} type="button">Send</button>
                    </div>
                    <div className="cycles-recipient">to {props.recipient.username}</div>
                    <div className="send-cycles-links">
                        <a href="#">A58435DF2E8A0DD121D8CF9EE</a>
                        <a href="#">add funds</a>
                    </div>
                </div>
            </div>
            <div className="dollar button hide-on-click-ignore" onClick={toggleDialog}>
                <Dollar />
            </div>
        </div>
    );

    function onCyclesChanged(text: string) {
        setCycles(text);

        const pounds = text.length > 0 
            ? cycleFunctions.round(
                cycleFunctions.toCurrency(
                    cycleFunctions.fromT(
                        parseFloat(text)), "GBP")).toString()
            : "";

        setPounds(pounds);
    }
    
    function onPoundsChanged(text: string) {
        setPounds(text);

        const cycles = text.length > 0 
            ? cycleFunctions.round(
                cycleFunctions.toT(
                    cycleFunctions.fromCurrency(
                        parseFloat(text), "GBP"))).toString()
            : "";

        setCycles(cycles);
    }

    function toggleDialog() {
        const elemClassList = document.getElementById("sendCyclesDialog")!.classList;
        
        if (elemClassList.contains("hide")) {
            fetchCurrentBalance();
            setCycles("");
            setPounds("");    
        }

        elemClassList.toggle("hide");

        if (elemClassList.contains("hide")) {
            props.onHidePicker();
        }
    }

    function fetchCurrentBalance() {
        const getCurrentUserAsync: () => Promise<GetCurrentUserOutcome> = () => dispatch(getCurrentUser()) as any;
        getCurrentUserAsync().then((outcome) => {
            if (outcome.type === "GET_CURRENT_USER_SUCCEEDED") {
                setBalance(formatCycles(outcome.payload.accountBalance));            
                document.getElementById("cyclesInput")?.focus();
            }
        });
    }
}

