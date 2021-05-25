import React from "react";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { toDayOfWeekString, toLongDateString } from "../../formatters/date";
import * as dateFunctions from "../../utils/dateFunctions";

type Props = {
    date: Date
}

const useStyles = makeStyles((theme: Theme) => ({
    dayChangeMarker: {
        padding: "6px 12px",
        borderRadius: 10,
        color: theme.colors.dayChangeMarker.textColor,
        backgroundColor: theme.colors.dayChangeMarker.backgroundColor,
        alignSelf: "center",
        position: "sticky",
        top: 10,
        zIndex: 60
    }
}));

export default React.memo(DayChangeMarker);

function DayChangeMarker(props : Props) {
    const classes = useStyles();
    return <Typography variant="body2" className={classes.dayChangeMarker}>{formatDate(props.date)}</Typography>;
}

function formatDate(date: Date) : string {
    const startOfToday = dateFunctions.getStartOfToday();
    if (date >= startOfToday) {
        return "Today";
    }
    const startOfYesterday = dateFunctions.addDays(startOfToday, -1);
    if (date >= startOfYesterday) {
        return "Yesterday";
    }
    const useDayNameOnly = date >= dateFunctions.addDays(startOfToday, -6);
    return useDayNameOnly
        ? toDayOfWeekString(date)
        : toLongDateString(date);
}
