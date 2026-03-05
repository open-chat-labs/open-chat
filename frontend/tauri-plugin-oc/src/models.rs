use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenUrlRequest {
    pub url: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenUrlResponse {
    pub value: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpRequest {
    pub username: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpResponse {
    pub passkey: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInRequest {
    challenge: Vec<u8>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInResponse {
    pub passkey: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowNotificationRequest {
    pub notification_id: u32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct SvelteReadyRequest;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct MinimizeAppRequest;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseNotificationsRequest {
    pub sender_id: Option<String>,
    pub group_id: Option<String>,
    pub community_id: Option<String>,
    pub channel_id: Option<String>,
    pub thread_index: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct LoadRecentMediaRequest {
    pub count: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadRecentMediaResponse {
    pub permission: String,
    pub media: Vec<RecentMedia>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentMedia {
    pub uri: String,
    pub filename: String,
    pub mime_type: String,
    pub date_added: u32,
    pub is_video: bool,
    pub file_path: String,
    pub thumbnail: Option<String>,
}
