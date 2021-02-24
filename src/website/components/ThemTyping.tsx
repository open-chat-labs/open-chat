import React from "react";
import { Typography, TypographyVariant } from "@material-ui/core";

type Props = {
    variant: TypographyVariant
}

export default React.memo(ThemTyping);

function ThemTyping(props: Props) {
    return (
        <Typography variant={props.variant}>typing...</Typography>
    );
}
