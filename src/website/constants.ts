export const APP_TITLE = "OpenChat";

export const IDP_URL = 'https://identity.messaging.ic0.app/authorize';
export const IDP_URL = 'http://identity.localhost/';

export const PAGE_SIZE = 20;
export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB
export const DEFAULT_UPDATED_DATE = new Date(2000, 1, 1);

export const MARK_CURRENT_USER_AS_ONLINE_INTERVAL_MS = 30000; // 30 seconds
export const REFRESH_CHATS_INTERVAL_MS = 1000; // 1 second
export const REFRESH_P2P_CONNECTIONS_MS = 1000; // 1 second
export const UPDATE_USERS_INTERVAL_MS = 30000; // 30 seconds
export const SCAVENGE_CACHE_INTERVAL_MS = 60000; // 1 minute

export const CONFIRMED_DIRECT_CHAT = "cd";
export const CONFIRMED_GROUP_CHAT = "cg";
export const UNCONFIRMED_DIRECT_CHAT = "ud";
export const UNCONFIRMED_GROUP_CHAT = "ug";