import React from "react";

export default DayChangeMarker;

interface Props {
    date: Date
}

function DayChangeMarker(props : Props) {
    const dayOfWeek = props.date.toLocaleDateString("en", { weekday: "long" });
    const dayOfMonth = props.date.getDate();
    const month = props.date.toLocaleDateString("en", { month: "long" });
    const ordinal = getOrdinal(dayOfMonth);
    const year = props.date.getFullYear();

    const text = `${dayOfWeek} ${dayOfMonth}${ordinal} ${month} ${year}`;

    return (
        <div className="day-change-marker">{text}</div>
    );
}

function getOrdinal(n: number) : string {
    // Taken from https://stackoverflow.com/a/39466341
    return [,"st","nd","rd"][n/10%10^1&&n%10]||"th";
}
