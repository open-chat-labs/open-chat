use crate::VideoCallType;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Debug, Clone)]
pub enum AccessTokenType {
    StartVideoCall,
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[ts_export]
#[derive(CandidType, Debug, Clone)]
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
