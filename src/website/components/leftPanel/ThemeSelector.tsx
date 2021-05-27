import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Button from "@material-ui/core/Button";
import Radio from '@material-ui/core/Radio';
import useTheme from "@material-ui/core/styles/useTheme";
import selectTheme from "../../actions/app/selectTheme";
import { RootState } from "../../reducers";
import { SelectedTheme } from "../../domain/model/theme";

export default ThemeSelector;

type Props = {
    onClose: () => void
}

const options: ThemeOption[] = [
    {
        name: "System default",
        value: SelectedTheme.SystemDefault
    }, {
        name: "Light",
        value: SelectedTheme.Light
    }, {
        name: "Dark",
        value: SelectedTheme.Dark
    }
];

type ThemeOption = {
    name: string,
    value: SelectedTheme
}

function ThemeSelector(props: Props) {
    const dispatch = useDispatch();
    const currentTheme = useSelector((state: RootState) => state.appState.selectedTheme);
    const [value, setValue] = useState(currentTheme);
    const theme = useTheme();

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const selectedTheme = parseInt(event.target.value) as SelectedTheme;
        setValue(selectedTheme);
    }

    function handleOk() {
        dispatch(selectTheme(value));
        props.onClose();
    }

    return (
        <Dialog open={true}>
            <DialogTitle>Select theme</DialogTitle>
            <DialogContent dividers>
                <RadioGroup
                    name="theme"
                    value={value}
                    onChange={handleChange}>
                    {options.map((option) => (
                        <FormControlLabel
                            key={option.value}
                            value={option.value}
                            control={<Radio />}
                            label={option.name}
                            color={theme.colors.buttonColor} />
                    ))}
                </RadioGroup>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose}>
                    Cancel
                </Button>
                <Button onClick={handleOk}>
                    Ok
                </Button>
            </DialogActions>
        </Dialog>
    )
}