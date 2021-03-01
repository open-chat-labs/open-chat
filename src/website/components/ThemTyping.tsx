import React from "react";
import Typography from "@material-ui/core/Typography";
import { Variant as TypographyVariant } from "@material-ui/core/styles/createTypography";

type Props = {
    variant: TypographyVariant
}

export default React.memo(ThemTyping);

function ThemTyping(props: Props) {
    return (
        <Typography variant={props.variant}>typing...</Typography>
    );
}
