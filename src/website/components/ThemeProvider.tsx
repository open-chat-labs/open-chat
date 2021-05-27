import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import MuiThemeProvider from "@material-ui/core/styles/ThemeProvider";
import { darkTheme, lightTheme } from "../theme";
import { RootState } from "../reducers";
import { SelectedTheme } from "../domain/model/theme";

export interface Props {
    children: React.ReactNode
}

export default function ThemeProvider(props: Props) {
    const selectedTheme = useSelector((state: RootState) => state.appState.selectedTheme);
    const useSystemTheme = selectedTheme === SelectedTheme.SystemDefault;
    const isSystemDarkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const shouldDarkModeBeActive = isDarkModeSelected();

    const [darkMode, setDarkMode] = useState(shouldDarkModeBeActive);

    if (darkMode !== shouldDarkModeBeActive) {
        setDarkMode(shouldDarkModeBeActive)
    }

    function isDarkModeSelected() : boolean {
        return selectedTheme === SelectedTheme.Dark ||
            (selectedTheme === SelectedTheme.SystemDefault && isSystemDarkModeQuery.matches);
    }

    function setDarkModeBasedOnSystemTheme() {
        const isSystemDarkMode = isSystemDarkModeQuery.matches;
        setDarkMode(isSystemDarkMode);
    }

    useEffect(() => {
        if (useSystemTheme) {
            isSystemDarkModeQuery.addEventListener("change", setDarkModeBasedOnSystemTheme);
            return () => isSystemDarkModeQuery.removeEventListener("change", setDarkModeBasedOnSystemTheme);
        }
    }, [useSystemTheme]);

    return (
        <MuiThemeProvider theme={darkMode ? darkTheme : lightTheme}>
            {props.children}
        </MuiThemeProvider>
    );
}