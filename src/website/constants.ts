export const APP_TITLE = "OpenChat";

export const APP_SERVICE_WORKER_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
export const MAX_IMAGE_SIZE = 1024 * 1024;
export const MAX_AVATAR_SIZE = 1024 * 256;
export const MAX_VIDEO_SIZE = 1024 * 1024 * 5;
export const MAX_FILE_SIZE = 1024 * 1024;

export const IDP_URL = 'https://identity.ic0.app/';
// export const IDP_URL = 'http://identity.localhost/';

export const PAGE_SIZE = 20;
export const CHUNK_SIZE_BYTES = 1024 * 500; // 500KB
export const DEFAULT_UPDATED_DATE = new Date(2000, 1, 1);

export const MARK_CURRENT_USER_AS_ONLINE_INTERVAL_MS = 61000; // 61 seconds
export const REFRESH_CHATS_MIN_INTERVAL_MS = 3000; // 3 seconds
export const REFRESH_CHATS_MAX_INTERVAL_MS = 19000; // 19 seconds
export const REFRESH_P2P_CONNECTIONS_MIN_INTERVAL_MS = 3000; // 3 seconds
export const REFRESH_P2P_CONNECTIONS_MAX_INTERVAL_MS = 17000; // 17 seconds
export const UPDATE_USERS_INTERVAL_MS = 37000; // 37 seconds
export const SCAVENGE_CACHE_INTERVAL_MS = 60000; // 1 minute

export const CONFIRMED_DIRECT_CHAT = "cd";
export const CONFIRMED_GROUP_CHAT = "cg";
export const UNCONFIRMED_DIRECT_CHAT = "ud";
export const UNCONFIRMED_GROUP_CHAT = "ug";