export const APP_TITLE = "OpenChat";

// https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid
export const PUBLIC_VAPID_KEY = "BD8RU5tDBbFTDFybDoWhFzlL5-mYptojI6qqqqiit68KSt17-vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv-iV3A=";

export const MAX_IMAGE_SIZE = 1024 * 1024;
export const MAX_AVATAR_SIZE = 1024 * 256;
export const MAX_VIDEO_SIZE = 1024 * 1024 * 5;
export const MAX_FILE_SIZE = 1024 * 1024;

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

export const ABOUT_US = {
    title: "TEST MODE",
    text: "OpenChat is running in test mode. Maximum users 100,000. Old media files scavenged. Dummy cycle balance. Accounts may get reset on main release expected in November. Enjoy! - OpenChat devs",
};