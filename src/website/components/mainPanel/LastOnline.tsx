import React from "react";
import Typography from "@material-ui/core/Typography";
import { Variant as TypographyVariant } from "@material-ui/core/styles/createTypography";

type Props = {
    variant: TypographyVariant,
    minutesSinceLastOnline: number
}

export default React.memo(LastOnline);

function LastOnline(props: Props) {
    return <Typography variant={props.variant}>{formatLastOnlineDate(props.minutesSinceLastOnline)}</Typography>;
}

function formatLastOnlineDate(minutesSinceLastOnline: number) : string {
    if (isNaN(minutesSinceLastOnline)) {
        return "";
    }
    if (minutesSinceLastOnline < 2) {
        return "Online now";
    }
    let durationText: string;
    if (minutesSinceLastOnline < 60) {
        durationText = `${minutesSinceLastOnline} minutes`;
    } else {
        const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
        if (hoursSinceLastOnline === 1) {
            durationText = "1 hour";
        } else if (hoursSinceLastOnline < 24) {
            durationText = `${hoursSinceLastOnline} hours`;
        } else {
            const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
            durationText = daysSinceLastOnline === 1
                ? "1 day"
                : `${daysSinceLastOnline} days`;
        }
    }
    return `Last online ${durationText} ago`;
}
