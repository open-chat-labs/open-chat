use crate::EncryptedEmailSenderConfig;
use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum InitOrUpgradeArgs {
    Init(InitArgs),
    Upgrade(UpgradeArgs),
}

impl InitOrUpgradeArgs {
    pub fn to_init_args(self) -> InitArgs {
        let InitOrUpgradeArgs::Init(args) = self else {
            panic!("InitOrUpgradeArgs not of type Init");
        };
        args
    }

    pub fn to_upgrade_args(self) -> UpgradeArgs {
        let InitOrUpgradeArgs::Upgrade(args) = self else {
            panic!("InitOrUpgradeArgs not of type Upgrade");
        };
        args
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct InitArgs {
    pub email_sender_public_key_pem: String,
    // Only use this for testing
    pub salt: Option<[u8; 32]>,
    pub whitelisted_principals: Vec<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct UpgradeArgs {
    pub email_sender_public_key_pem: Option<String>,
    pub email_sender_config: Option<EncryptedEmailSenderConfig>,
}
