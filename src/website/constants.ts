export const APP_TITLE = "Open Chat";

export const PAGE_SIZE = 20;
export const MIN_MESSAGE_ID = 1;
export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB
export const DEFAULT_UPDATED_DATE = new Date(2000, 1, 1);

export const MARK_CURRENT_USER_AS_ONLINE_INTERVAL_MS = 30000; // 30 seconds
export const REFRESH_CHATS_INTERVAL_MS = 1000; // 1 second
export const REFRESH_P2P_CONNECTIONS_MS = 1000; // 1 second
export const UPDATE_USERS_INTERVAL_MS = 30000; // 30 seconds

export const CONFIRMED_DIRECT_CHAT = "cd";
export const CONFIRMED_GROUP_CHAT = "cg";
export const UNCONFIRMED_DIRECT_CHAT = "ud";
export const UNCONFIRMED_GROUP_CHAT = "ug";