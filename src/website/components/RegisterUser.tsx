import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
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
        color: theme.colors.loginRegister.textColor,
        backgroundColor: theme.colors.loginRegister.backgroundColor,
        textAlign: "center",
        padding: 20
    },
    icon: {
        width: 80,
        height: 80
    },
    button: {
        color: theme.colors.loginRegister.buttonTextColor,
        backgroundColor: theme.colors.loginRegister.buttonBackgroundColor,
        "&:hover": {
            backgroundColor: theme.colors.loginRegister.buttonBackgroundColor
        }
    },
    nameInput: {
        margin: "auto",
        maxWidth: 400,
        marginTop: 30
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    errorText: {
        height: 20,
        marginTop: 20,
        color: "red"
    }
}));

export default function RegisterUser() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const [loading, setLoading] = React.useState(false);
    const [errorText, setErrorText] = React.useState("");

    function handleSubmit(text: string) {
        if (text && text.length > 2) {
            setLoading(true);
            setErrorText("");
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
                        setErrorText("A user already exists with this username - please try another username");
                        break;
                }
                setLoading(false);
            });
        }
    }

    return (    
        <>    
            <Paper className={classes.paper}>
                <PersonIcon className={classes.icon} />
                <Typography variant="h2">Register user</Typography>
                <NameInput
                    onSubmit={handleSubmit}
                    placeholderText="Enter username"
                    minLength={3}
                    maxLength={25}
                    className={classes.nameInput}
                    disabled={loading} />
                <Typography
                    component="div"
                    variant="body1"
                    className={classes.errorText}>
                    {errorText}
                </Typography>
            </Paper>
            <Backdrop className={classes.backdrop} open={loading}>
                <CircularProgress color="inherit" />
            </Backdrop>        
        </>
    );
}