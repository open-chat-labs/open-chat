use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(Debug, CandidType, Serialize, Deserialize, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub struct FcmToken(pub String);

impl From<String> for FcmToken {
    fn from(token: String) -> Self {
        FcmToken(token)
    }
}
impl From<FcmToken> for String {
    fn from(token: FcmToken) -> Self {
        token.0
    }
}
impl AsRef<str> for FcmToken {
    fn as_ref(&self) -> &str {
        &self.0
    }
}
