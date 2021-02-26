import React from "react";
import { Grid, makeStyles, Theme, Typography } from "@material-ui/core";
import CancelButton from "../CancelButton";
import { Option } from "../../domain/model/common";

export default React.memo(Header);

type Props = {
    title: string,
    rightIcon: Option<JSX.Element>,
    onCancelButtonClick: () => void
}

Header.defaultProps = {
    rightIcon: null
}

const useStyles = makeStyles((theme: Theme) => ({
    header: {
        ...theme.header,
        backgroundColor: theme.customColors.headerBackgroundColor
    },
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
        <Grid container justify="space-between" className={classes.header} alignItems="center">
            <Grid item>
                <Grid container alignItems="center">
                    <Grid item>
                        <CancelButton onClick={props.onCancelButtonClick} />
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
