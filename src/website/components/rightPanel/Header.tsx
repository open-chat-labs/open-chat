import React from "react";
import Grid from "@material-ui/core/Grid";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import makeStyles from "@material-ui/styles/makeStyles";
import CloseButton from "../shared/CloseButton";
import BackButton from "../shared/BackButton";
import { Option } from "../../domain/model/common";

export default React.memo(Header);

type Props = {
    title: string,
    rightIcon: Option<JSX.Element>,
    back: boolean,
    onCloseButtonClick: () => void
}

Header.defaultProps = {
    rightIcon: null,
    back: false
}

const useStyles = makeStyles((theme: Theme) => ({
    title: {
        color: theme.colors.header.primaryTextColor,
        padding: "0 16px"
    },
    closeButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6)
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
                            ? <BackButton onClick={props.onCloseButtonClick} className={classes.closeButton} />
                            : <CloseButton onClick={props.onCloseButtonClick} className={classes.closeButton} />}
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
