import { isBreakStatement } from "typescript";
import "../public/global.css";
import "../src/i18n/i18n";
import { loadSavedTheme, saveSeletedTheme } from "../src/theme/themes";
loadSavedTheme();
saveSeletedTheme('light');

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  layout: 'fullscreen',
}