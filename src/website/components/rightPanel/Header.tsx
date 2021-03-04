import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import CloseButton from "../CloseButton";
import BackButton from "../BackButton";
import { Option } from "../../domain/model/common";

export default React.memo(Header);

type Props = {
    title: string,
    rightIcon: Option<JSX.Element>,
    back: boolean,
    onCancelButtonClick: () => void
}

Header.defaultProps = {
    rightIcon: null,
    back: false
}

const useStyles = makeStyles((theme: Theme) => ({
    title: {
        padding: "0 16px"
    }
}));

function Header(props: Props) {
    const classes = useStyles();

    const rightElement = props.rightIcon
        ? <Grid item>{props.rightIcon}</Grid>
        : null

    return (
        <Grid component="header" container justifyContent="space-between" alignItems="center">
            <Grid item>
                <Grid container alignItems="center">
                    <Grid item>
                        {props.back 
                            ? <BackButton onClick={props.onCancelButtonClick} /> 
                            : <CloseButton onClick={props.onCancelButtonClick} />}                        
                    </Grid>
                    <Grid item>
                        <Typography variant="h6" className={classes.title}>{props.title}</Typography>
                    </Grid>
                </Grid>
            </Grid>
            {rightElement}
        </Grid>
    );
}
