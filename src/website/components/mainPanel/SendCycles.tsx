import React, {forwardRef, Ref, useEffect, useImperativeHandle, useState} from "react";
import { useDispatch } from "react-redux";
import Typography from "@material-ui/core/Typography";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import TextField from '@material-ui/core/TextField';
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import getCurrentUser, { GetCurrentUserOutcome } from "../../actions/users/getCurrentUser";
import { formatCycles } from "../../formatters/cycles";
import { UserSummary } from "../../domain/model/users";
import * as cycleFunctions from "../../utils/cycleFunctions";

type Props = {
    recipient: UserSummary
}

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        padding: "10px 10px 0 10px"
    },
    box: {
        padding: 10,
        display: "inline-block",
        backgroundColor: theme.colors.textBox.backgroundColor,
        borderRadius: 6
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
        justifyContent: "space-between",
        marginTop: 4,      
        marginBottom: 8,      
        "& a": {
            marginLeft: 30
        }
    }
}));

export interface ISendCyclesRef {
    getCycles: () => bigint
}

const SendCycles = forwardRef((props: Props, ref: Ref<ISendCyclesRef>) => {
    const dispatch = useDispatch();
    const [cycles, setCycles] = useState("");
    const [dollars, setDollars] = useState("");
    const [balance, setBalance] = useState("...");
    const classes = useStyles();

    useEffect(() => {
        fetchCurrentBalance();
    }, []);    

    useImperativeHandle(ref, () => ({ getCycles }));    

    function getCycles(): bigint {
        return cycleFunctions.fromT(parseFloat(cycles));
    }            

    function onCyclesChanged(text: string) {
        setCycles(text);

        const dollars = text.length > 0 
            ? cycleFunctions.round(
                cycleFunctions.toCurrency(
                    cycleFunctions.fromT(
                        parseFloat(text)), "USD")).toString()
            : "";

        setDollars(dollars);
    }
    
    function onDollarsChanged(text: string) {
        setDollars(text);

        const cycles = text.length > 0 
            ? cycleFunctions.round(
                cycleFunctions.toT(
                    cycleFunctions.fromCurrency(
                        parseFloat(text), "USD"))).toString()
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
        <div className={classes.container}>
            <div className={classes.box}>
                <Typography component="div" variant="h6">
                    Send cycles to {props.recipient.username}
                </Typography> 
                <div className={classes.balanceContainer}>
                    <Typography component="div" variant="caption">
                        Current balance <strong>{balance}</strong>
                    </Typography> 
                    {/* <Link href="#" variant="caption" underline="always">add funds</Link> */}
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
                        label="USD"
                        type="number"
                        value={dollars}
                        className={classes.poundsInput + " " + classes.input}   
                        onChange={e => onDollarsChanged(e.target.value)} 
                    />                        
                </div>
            </div>
        </div>
    );
});

export default React.memo(SendCycles);
