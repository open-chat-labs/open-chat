import { configKeys } from "../utils/config";
import { createLsBoolStore } from "./localStorageSetting";

export const hideDeletedStore = createLsBoolStore(configKeys.hideDeleted, true);
