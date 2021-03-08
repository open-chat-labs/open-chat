import React, {forwardRef, Ref, useEffect, useImperativeHandle, useState} from "react";
import { useDispatch } from "react-redux";
import Typography from "@material-ui/core/Typography";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import TextField from '@material-ui/core/TextField';
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../domain/model/common";
import sendMessage from "../actions/chats/sendMessage";
import getCurrentUser, { GetCurrentUserOutcome } from "../actions/users/getCurrentUser";
import { formatCycles } from "../formatters/cycles";
import { Chat } from "../domain/model/chats";
import { SendMessageContent } from "../domain/model/messages";
import { UserSummary } from "../domain/model/users";
import * as cycleFunctions from "../utils/cycleFunctions";
import Link from "@material-ui/core/Link";

type Props = {
    chat: Chat,
    recipient: UserSummary,
    onSend: () => void
}

const useStyles = makeStyles((theme: Theme) => ({
    box: {
        textAlign: "center",
        padding: "10px 16px 6px 16px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: theme.colors.footer.backgroundColor,
    },
    inputContainer: {
        display: "flex",
        marginTop: 10,
        alignItems: "center"
    },
    input: {
        width: 170,
        backgroundColor: theme.colors.textBox.backgroundColor,
	},
    cyclesInput: {
        marginRight: 10,
    },
    poundsInput: {
        marginLeft: 10,
    },
    balanceContainer: {
        display: "flex",
        marginTop: 4,      
        marginBottom: 8,      
        "& a": {
            marginLeft: 30
        }
    }
}));

export interface ISendCyclesRef {
    sendCycles: (caption: Option<string>) => boolean
}

const SendCycles = forwardRef((props: Props, ref: Ref<ISendCyclesRef>) => {
    const dispatch = useDispatch();
    const [cycles, setCycles] = useState("");
    const [pounds, setPounds] = useState("");
    const [balance, setBalance] = useState("...");
    const classes = useStyles();

    useEffect(() => {
        fetchCurrentBalance();
    }, []);    

    useImperativeHandle(ref, () => ({ sendCycles }));    

    function sendCycles(caption: Option<string>) {
        // if (invalid) return false

        const content: SendMessageContent = {
            kind: "cycles",
            amount: cycleFunctions.fromT(parseFloat(cycles)),
            caption: caption
        };

        dispatch(sendMessage(props.chat!, content, null));

        props.onSend();

        return true;
    }            

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

    function fetchCurrentBalance() {
        const getCurrentUserAsync: () => Promise<GetCurrentUserOutcome> = () => dispatch(getCurrentUser()) as any;
        getCurrentUserAsync().then((outcome) => {
            if (outcome.type === "GET_CURRENT_USER_SUCCEEDED") {
                setBalance(formatCycles(outcome.payload.accountBalance));            
            }
        });
    }

    return (
        <div className={classes.box}>
            <Typography component="div" variant="h6">
                Send cycles to {props.recipient.username}
            </Typography> 
            <div className={classes.balanceContainer}>
                <Typography component="div" variant="caption">
                    Current balance <strong>{balance}</strong>
                </Typography> 
                <Link href="#" variant="caption" underline="always">add funds</Link>
            </div>
            <div className={classes.inputContainer}>
                <TextField
                    id="cyclesInput" 
                    label="Cycles (T)"
                    type="number"
                    value={cycles}
                    className={classes.cyclesInput + " " + classes.input}   
                    onChange={e => onCyclesChanged(e.target.value)}                         
                />   
                <SyncAltIcon />                     
                <TextField
                    id="poundsInput" 
                    label="GBP"
                    type="number"
                    value={pounds}
                    className={classes.poundsInput + " " + classes.input}   
                    onChange={e => onPoundsChanged(e.target.value)} 
                />                        
            </div>
        </div>
    );
});

export default React.memo(SendCycles);
