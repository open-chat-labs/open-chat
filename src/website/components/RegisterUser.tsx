import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import Paper from "@material-ui/core/Paper";
import React from "react";
import PersonIcon from '@material-ui/icons/Person';
import Typography from "@material-ui/core/Typography";
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import NameInput from "./NameInput";
import registerUser, { RegisterUserOutcomeEvent, REGISTER_USER_FAILED_USERNAME_EXISTS, REGISTER_USER_FAILED_USER_EXISTS, REGISTER_USER_SUCCEEDED } from "../actions/users/registerUser";

const useStyles = makeStyles((theme: Theme) => ({
    paper: {
        textAlign: "center",
        padding: 20
    },
    icon: {
        width: 80,
        height: 80
    },
    button: {
        backgroundColor: theme.customColors.mainPanelBackgroundColor,
        "&:hover": {
            backgroundColor: alpha(theme.customColors.mainPanelBackgroundColor, 0.1),
        }
    },
    nameInput: {
        margin: "auto",
        maxWidth: 400
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    errorText: {
        color: "red"
    }
}));

export default function RegisterUser() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const [open, setOpen] = React.useState(false);
    const [errorText, setErrorText] = React.useState("");

    function handleSubmit(text: string) {
        if (text && text.length > 2) {
            setOpen(true);
            const registerUserAsync: () => Promise<RegisterUserOutcomeEvent> = () => dispatch(registerUser(text)) as any;
            registerUserAsync().then((outcome) => {
                switch (outcome.type) {
                    case REGISTER_USER_SUCCEEDED:
                        setErrorText("");
                        break;
                    case REGISTER_USER_FAILED_USER_EXISTS:
                        setErrorText("You already have a name");
                        break;
                    case REGISTER_USER_FAILED_USERNAME_EXISTS:
                        setErrorText("A user already exists with this name - please try another name");
                        break;
                }
                setOpen(false);
            });
        }
    }

    return (    
        <>    
            <Paper className={classes.paper}>
                <PersonIcon className={classes.icon} />
                <Typography variant="h2">Register user</Typography>
                <p>Please choose a username:</p>
                <NameInput onSubmit={handleSubmit} defaultPlaceholderText="Enter username" minLength={3} maxLength={25} className={classes.nameInput} />
                {errorText.length > 0 ? <Typography variant="body1" className={classes.errorText}>{errorText}</Typography> : null}
            </Paper>
            <Backdrop className={classes.backdrop} open={open}>
                <CircularProgress color="inherit" />
            </Backdrop>        
        </>
    );
}