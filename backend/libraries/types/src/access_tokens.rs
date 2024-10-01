use crate::VideoCallType;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum AccessTokenType {
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct VideoCallAccessTokenArgs {
    pub call_type: VideoCallType,
}

impl AccessTokenType {
    pub fn type_name(&self) -> &str {
        match self {
            AccessTokenType::StartVideoCallV2(_) => "StartVideoCall",
            AccessTokenType::JoinVideoCall => "JoinVideoCall",
            AccessTokenType::MarkVideoCallAsEnded => "MarkVideoCallAsEnded",
        }
    }
}
