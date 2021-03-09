import produce from "immer";
import { THEME_SELECTED, ThemeSelectedEvent } from "../actions/selectTheme";
import SelectedThemeCache from "../domain/SelectedThemeCache";

export enum SelectedTheme {
    SystemDefault,
    Light,
    Dark
}

export type ThemeState = {
    selectedTheme: SelectedTheme
}

const initialState: ThemeState = {
    selectedTheme: SelectedThemeCache.tryGet() ?? SelectedTheme.SystemDefault
}

type Event =
    ThemeSelectedEvent;

export default produce((state: ThemeState, event: Event) => {
    switch (event.type) {
        case THEME_SELECTED: {
            const selectedTheme = event.payload;
            state.selectedTheme = selectedTheme;
            SelectedThemeCache.set(selectedTheme);
            break;
        }
    }
}, initialState);
