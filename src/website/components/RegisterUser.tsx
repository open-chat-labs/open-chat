import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import Paper from "@material-ui/core/Paper";
import React from "react";
import PersonIcon from '@material-ui/icons/Person';
import Typography from "@material-ui/core/Typography";
import registerUser, { RegisterUserOutcomeEvent, REGISTER_USER_FAILED_USERNAME_EXISTS, REGISTER_USER_FAILED_USER_EXISTS, REGISTER_USER_LIMIT_REACHED, REGISTER_USER_SUCCEEDED } from "../actions/users/registerUser";
import NameInput from "./shared/NameInput";

const useStyles = makeStyles((theme: Theme) => ({
    paper: {
        color: theme.colors.loginRegister.textColor,
        backgroundColor: theme.colors.loginRegister.backgroundColor,
        textAlign: "center",
        padding: 20
    },
    icon: {
        width: 80,
        height: 80,
        alignSelf: "center"
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
    errorText: {
        minHeight: 20,
        maxWidth: 400,
        marginTop: 20,
        color: "red",
        alignSelf: "center"
    },
    errorContainer: {
        display: "flex",
        justifyContent: "center"
    }
}));

export default function RegisterUser() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const [errorText, setErrorText] = React.useState("");

    function handleSubmit(text: string) {
        if (text && text.length > 2) {
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
                    case REGISTER_USER_LIMIT_REACHED:
                        setErrorText(`The number of users of this demo version of OpenChat has been limited to ${outcome.payload} and this limit has been reached. Check back soon for the full release!`);
                        break;
                }
            });
        }
    }

    return (    
        <Paper className={classes.paper}>
            <PersonIcon className={classes.icon} />
            <h1>Register user</h1>
            <NameInput
                onSubmit={handleSubmit}
                placeholderText="Enter username"
                minLength={3}
                maxLength={25}
                className={classes.nameInput}
                />
            <div className={classes.errorContainer}>
                <Typography
                    component="div"
                    variant="body1"
                    className={classes.errorText}>
                    {errorText}
                </Typography>
            </div>
        </Paper>
);
}