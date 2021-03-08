import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(Header);

type Props = {
    leftIcon: JSX.Element,
    title: string,
    rightIcon: JSX.Element
}

const useStyles = makeStyles((theme: Theme) => ({
    title: {
        color: theme.colors.header.primaryTextColor,
        marginLeft: 24,
        whiteSpace: "nowrap"
    }
}));

function Header(props: Props) {
    const classes = useStyles();

    return (
        <>
            <Grid component="header" container justifyContent="space-between" alignItems="center">
                <Grid item>
                    <Grid container alignItems="center">
                        <Grid item>
                            {props.leftIcon}
                        </Grid>
                        <Grid item className={classes.title}>
                            <Typography variant="h6">{props.title}</Typography>
                        </Grid>
                    </Grid>
                </Grid>
                <Grid item>
                    {props.rightIcon}
                </Grid>
            </Grid>
        </>
    );
}
