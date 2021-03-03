import React, {useRef, useState} from "react";
import { useDispatch } from "react-redux";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Popper from "@material-ui/core/Popper";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
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
    buttonClassName: string
}

const useStyles = makeStyles((theme: Theme) => ({
    dollarButton: {
        marginRight: 10,
        width: 32,
        height: 32,
        color: "#111111"
    },
    popUp: {
        zIndex: 100
    },
    sendCyclesDialog: {
        backgroundColor: "white",
        padding: 6,
        minWidth: 352,
        borderRadius: 5,
        boxShadow: "0px 8px 16px 0px rgba(0,0,0,0.2)",
        border: "1px solid #d9d9d9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        "& input": {
            width: 200,
            marginLeft: 11
        }
    },
    cyclesBalance: {
        marginBottom: 40
    },
    cyclesContainer: {
        marginBottom: 4
    },
    poundsContainer: {
        marginTop: 4,
        marginBottom: 40
    },
    buttonContainer: {
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        "& button": {
            padding: "6px 20px",
            borderRadius: 5
        }
    },
    cyclesRecipient: {
        fontSize: 12
    },
    sendCyclesLinks: {
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 40,
        "& a": {
            fontSize: 12,
            textDecoration: "underline"
        }
    }
}));

function SendCycles(props: Props) {
    const dispatch = useDispatch();
    const [cycles, setCycles] = useState("");
    const [pounds, setPounds] = useState("");
    const [balance, setBalance] = useState("...");
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLElement>(null);
    const classes = useStyles();

    function sendCycles() {
        toggleDialog();

        const content: SendMessageContent = {
            kind: "cycles",
            amount: cycleFunctions.fromT(parseFloat(cycles)),
            caption: null
        };

        dispatch(sendMessage(props.chat!, content, null));
    }

    return (
        <>
            <IconButton className={props.buttonClassName + " " + classes.dollarButton} buttonRef={anchorRef} onClick={toggleDialog}>
                <Dollar />
            </IconButton>
            <Popper open={open} anchorEl={anchorRef.current} placement="top-start" className={classes.popUp}>
                <ClickAwayListener onClickAway={toggleDialog}>
                    <Paper>
                        <div className={classes.sendCyclesDialog}>
                            <div className={classes.cyclesBalance}>Current balance <strong>{balance}</strong></div>
                            <div className={classes.cyclesContainer}>
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
                            <div className={classes.poundsContainer}>
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
                            <div className={classes.buttonContainer}>
                                <button onClick={sendCycles} type="button">Send</button>
                            </div>
                            <div className={classes.cyclesRecipient}>to {props.recipient.username}</div>
                            <div className={classes.sendCyclesLinks}>
                                <a href="#">A58435DF2E8A0DD121D8CF9EE</a>
                                <a href="#">add funds</a>
                            </div>
                        </div>
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </>
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
        if (open) {
            setOpen(false);
            props.onHidePicker();
        } else {
            setOpen(true);
            fetchCurrentBalance();
            setCycles("");
            setPounds("");    
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

