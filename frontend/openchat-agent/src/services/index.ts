export { OpenChatAgent } from "./openchatAgent";
export { IdentityAgent } from "./identityAgent";
export type { ApiNotification } from "./notifications/candid/idl";
export { Notification as NotificationIdl } from "./notifications/candid/notification";
export { notification } from "./notifications/mappers";
export { notification as notificationV2 } from "./notifications/mappersV2";
export { getBotDefinition } from "./externalBot/externalBot";

export type ApiPrincipal = Uint8Array | number[] | string;