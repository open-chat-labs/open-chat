use base64::Engine;
use base64::prelude::BASE64_STANDARD;
use candid::CandidType;
use rsa::rand_core::CryptoRngCore;
use rsa::{Pkcs1v15Encrypt, RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

pub const ONE_MINUTE: Milliseconds = 60 * 1000;
pub const ONE_DAY: Milliseconds = 24 * 60 * ONE_MINUTE;
pub const NANOS_PER_MILLISECOND: u64 = 1_000_000;
pub const DEFAULT_SESSION_EXPIRATION_PERIOD: Nanoseconds = 30 * ONE_DAY * NANOS_PER_MILLISECOND;
pub const MAX_SESSION_EXPIRATION_PERIOD: Nanoseconds = 90 * ONE_DAY * NANOS_PER_MILLISECOND;

pub type Hash = [u8; 32];
pub type Milliseconds = u64;
pub type Nanoseconds = u64;
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Delegation {
    #[serde(with = "serde_bytes")]
    pub pubkey: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SignedDelegation {
    pub delegation: Delegation,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EmailSenderConfig {
    Aws(AwsEmailSenderConfig),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AwsEmailSenderConfig {
    pub region: String,
    pub function_url: String,
    pub access_key: String,
    pub secret_key: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EncryptedEmailSenderConfig {
    Aws(EncryptedAwsEmailSenderConfig),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EncryptedAwsEmailSenderConfig {
    pub region: String,
    pub function_url: String,
    pub access_key: String,
    pub secret_key_encrypted: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EmailSenderConfigPublic {
    Aws(AwsEmailSenderConfigPublic),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AwsEmailSenderConfigPublic {
    pub region: String,
    pub function_url: String,
    pub access_key: String,
}

impl EmailSenderConfig {
    pub fn encrypt<R: CryptoRngCore>(
        self,
        rsa_public_key: &RsaPublicKey,
        rng: &mut R,
    ) -> EncryptedEmailSenderConfig {
        match self {
            EmailSenderConfig::Aws(aws) => {
                EncryptedEmailSenderConfig::Aws(aws.encrypt(rsa_public_key, rng))
            }
        }
    }
}

impl EncryptedEmailSenderConfig {
    pub fn decrypt(self, rsa_private_key: &RsaPrivateKey) -> EmailSenderConfig {
        match self {
            EncryptedEmailSenderConfig::Aws(aws) => {
                EmailSenderConfig::Aws(aws.decrypt(rsa_private_key))
            }
        }
    }
}

impl AwsEmailSenderConfig {
    pub fn encrypt<R: CryptoRngCore>(
        self,
        rsa_public_key: &RsaPublicKey,
        rng: &mut R,
    ) -> EncryptedAwsEmailSenderConfig {
        EncryptedAwsEmailSenderConfig {
            region: self.region,
            function_url: self.function_url,
            access_key: self.access_key,
            secret_key_encrypted: encrypt(&self.secret_key, rsa_public_key, rng),
        }
    }
}

impl EncryptedAwsEmailSenderConfig {
    pub fn decrypt(self, rsa_private_key: &RsaPrivateKey) -> AwsEmailSenderConfig {
        AwsEmailSenderConfig {
            region: self.region,
            function_url: self.function_url,
            access_key: self.access_key,
            secret_key: decrypt(&self.secret_key_encrypted, rsa_private_key),
        }
    }
}

impl From<&EmailSenderConfig> for EmailSenderConfigPublic {
    fn from(value: &EmailSenderConfig) -> Self {
        match value {
            EmailSenderConfig::Aws(aws) => EmailSenderConfigPublic::Aws(aws.into()),
        }
    }
}

impl From<&AwsEmailSenderConfig> for AwsEmailSenderConfigPublic {
    fn from(value: &AwsEmailSenderConfig) -> Self {
        AwsEmailSenderConfigPublic {
            region: value.region.clone(),
            function_url: value.function_url.clone(),
            access_key: value.access_key.clone(),
        }
    }
}

fn encrypt<R: CryptoRngCore>(value: &str, rsa_public_key: &RsaPublicKey, rng: &mut R) -> String {
    BASE64_STANDARD.encode(
        rsa_public_key
            .encrypt(rng, Pkcs1v15Encrypt, value.as_bytes())
            .unwrap(),
    )
}

fn decrypt(value: &str, rsa_private_key: &RsaPrivateKey) -> String {
    String::from_utf8(
        rsa_private_key
            .decrypt(Pkcs1v15Encrypt, &BASE64_STANDARD.decode(value).unwrap())
            .unwrap(),
    )
    .unwrap()
}
