import React, {useRef, useState} from "react";
import { useDispatch } from "react-redux";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Popper from "@material-ui/core/Popper";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
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
    paper: {
        textAlign: "center",
        paddingTop: 16,
        paddingRight: 6,
        paddingBottom: 4,
        paddingLeft: 6,
        minWidth: 353,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
    },
    sendCyclesLinks: {
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        marginTop: 30,
        "& a": {
            fontSize: 12,
            textDecoration: "underline"
        }
    },
    button: {
        backgroundColor: theme.customColors.mainPanelBackgroundColor,
        "&:hover": {
            backgroundColor: theme.customColors.mainPanelBackgroundColor,
        }
    },
    cyclesInput: {
        marginTop: 40,
        marginBottom: 6,
        width: 200
    },
    poundsInput: {
        marginTop: 6,
        marginBottom: 30,
        width: 200
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

    const popperModifiers = [
        {
          name: 'offset',
          options: {
                offset: [-90, 18],
            },
        },
    ];
 
    return (
        <>
            <IconButton className={props.buttonClassName + " " + classes.dollarButton} buttonRef={anchorRef} onClick={toggleDialog}>
                <Dollar />
            </IconButton>
            <Popper open={open} anchorEl={anchorRef.current} placement="top-start" modifiers={popperModifiers} className={classes.popUp}>
                <ClickAwayListener onClickAway={toggleDialog}>
                    <Paper elevation={2} className={classes.paper}>
                        <Typography component="div" variant="body1">
                            Current balance <strong>{balance}</strong>
                        </Typography> 
                        <TextField
                            id="cyclesInput" 
                            label="Enter cycles"
                            InputProps={{ endAdornment: <InputAdornment position="end">T</InputAdornment> }}
                            type="number"
                            value={cycles}
                            className={classes.cyclesInput}   
                            onChange={e => onCyclesChanged(e.target.value)}                         
                        />                        
                        <UpDownArrow />
                        <TextField
                            id="poundsInput" 
                            label="Enter GBP"
                            InputProps={{ endAdornment: <InputAdornment position="end">GBP</InputAdornment> }}
                            type="number"
                            value={pounds}
                            className={classes.poundsInput}   
                            onChange={e => onPoundsChanged(e.target.value)} 
                        />                        
                        <Button variant="contained" className={classes.button} onClick={_ => sendCycles()}>Send Cycles</Button>
                        <Typography variant="caption">
                            to {props.recipient.username}
                        </Typography> 
                        <div className={classes.sendCyclesLinks}>
                            <a href="#">A58435DF2E8A0DD121D8CF9EE</a>
                            <a href="#">add funds</a>
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
            }
        });
    }
}

