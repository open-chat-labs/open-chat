use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[ts(as = "ts_export::TSBytes")]
pub struct EncryptionKey(#[serde(with = "serde_bytes")] Vec<u8>);

impl From<Vec<u8>> for EncryptionKey {
    fn from(vec: Vec<u8>) -> Self {
        EncryptionKey(vec)
    }
}

impl From<EncryptionKey> for Vec<u8> {
    fn from(val: EncryptionKey) -> Self {
        val.0
    }
}
