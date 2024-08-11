use crate::VideoCallType;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub enum AccessTokenType {
    StartVideoCall,
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct VideoCallAccessTokenArgs {
    pub call_type: VideoCallType,
}

impl AccessTokenType {
    pub fn type_name(&self) -> &str {
        match self {
            AccessTokenType::StartVideoCall | AccessTokenType::StartVideoCallV2(_) => "StartVideoCall",
            AccessTokenType::JoinVideoCall => "JoinVideoCall",
            AccessTokenType::MarkVideoCallAsEnded => "MarkVideoCallAsEnded",
        }
    }
}
