import React from "react";
import { toDayOfWeekString, toLongDateString } from "../formatters/date";
import * as dateFunctions from "../utils/dateFunctions";

type Props = {
    date: Date
}

export default React.memo(DayChangeMarker);

function DayChangeMarker(props : Props) {
    return <div className="day-change-marker">{formatDate(props.date)}</div>;
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
