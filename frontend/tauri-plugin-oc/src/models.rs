use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
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
    pub size: usize,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct EmptyPayload;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMediaRequest {
    pub kind: String,
    pub filename: String,
    pub data: Vec<u8>,
    pub mime_type: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatShortcut {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatShortcutsRequest {
    pub chats: Vec<ChatShortcut>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatShortcutsResponse {
    pub count: usize,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFileSpec {
    pub url: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadModelRequest {
    pub model_id: String,
    pub runtime: String,
    pub files: Vec<ModelFileSpec>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub model_id: String,
    pub runtime: String,
    pub size_bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteModelRequest {
    pub model_id: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferRequest {
    pub model_id: String,
    pub runtime: String,
    pub prompt: String,
    #[serde(default)]
    pub image: Option<Vec<u8>>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    // A JSON Schema (serialised) the output must conform to. Best-effort: constrains generation via a
    // grammar when the runtime supports it.
    #[serde(default)]
    pub response_schema: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferResponse {
    pub text: String,
}
