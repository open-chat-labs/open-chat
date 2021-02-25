import React from "react";
import { Grid, makeStyles, Theme, Typography } from "@material-ui/core";

export default React.memo(Header);

type Props = {
    leftIcon: JSX.Element,
    title: string,
    rightIcon: JSX.Element
}

const useStyles = makeStyles((theme: Theme) => ({
    header: theme.header,
    title: {
        marginLeft: 24,
        whiteSpace: "nowrap"
    }
}));

function Header(props: Props) {
    const classes = useStyles();

    return (
        <>
            <Grid container justify="space-between" className={classes.header} alignItems="center">
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
