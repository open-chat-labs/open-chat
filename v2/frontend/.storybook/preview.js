import "../public/global.css";
import { loadSavedTheme, saveSeletedTheme } from "../src/theme/themes";
loadSavedTheme();
saveSeletedTheme('batman');

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}