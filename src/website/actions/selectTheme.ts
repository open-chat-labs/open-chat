import { SelectedTheme } from "../reducers/themeReducer";

export const THEME_SELECTED = "THEME_SELECTED";

export default function selectTheme(theme: SelectedTheme) {
    return {
        type: THEME_SELECTED,
        payload: theme
    };
}

export type ThemeSelectedEvent = {
    type: typeof THEME_SELECTED,
    payload: SelectedTheme
}
