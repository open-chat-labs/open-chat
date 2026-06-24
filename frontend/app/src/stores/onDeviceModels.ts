import { configKeys } from "../utils/config";
import { createLocalStorageStore } from "../utils/store";

// The user's currently selected on-device model ("" = none selected). Downloaded-model metadata is read
// from the native model store at runtime (listLocalModels) and the catalog is fetched, so neither is
// persisted here — only the user's selection is.
export const selectedModelId = createLocalStorageStore(configKeys.selectedModelId, "");
