import { configKeys } from "../utils/config";
import { createLsBoolStore } from "./localStorageSetting";

export const userCreatedStore = createLsBoolStore(configKeys.userCreated, false);
