use ct_codecs::{Base64UrlSafeNoPadding, Decoder};
use p256::ecdsa;
use p256::ecdsa::signature::Verifier;
use p256::pkcs8::DecodePublicKey;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::error::Error;

use crate::types::TimestampMillis;

#[derive(Serialize, Deserialize)]
pub struct Claims<T> {
    exp: u64,
    claim_type: String,
    #[serde(flatten)]
    custom: T,
}

impl<T> Claims<T> {
    pub fn new(expiry: TimestampMillis, claim_type: String, custom: T) -> Claims<T> {
        Claims {
            exp: expiry / 1000,
            claim_type,
            custom,
        }
    }

    pub fn exp(&self) -> u64 {
        self.exp
    }

    pub fn exp_ms(&self) -> TimestampMillis {
        self.exp * 1000
    }

    pub fn claim_type(&self) -> &str {
        &self.claim_type
    }

    pub fn custom(&self) -> &T {
        &self.custom
    }

    pub fn into_custom(self) -> T {
        self.custom
    }
}

pub fn verify<T: DeserializeOwned>(jwt: &str, public_key_pem: &str) -> Result<T, Box<dyn Error>> {
    let mut parts = jwt.split('.');
    let header_json = parts.next().ok_or("Invalid jwt")?;
    let claims_json = parts.next().ok_or("Invalid jwt")?;
    let signature_str = parts.next().ok_or("Invalid jwt")?;
    let signature_bytes = decode_to_bytes(signature_str)?;
    let signature = ecdsa::Signature::from_slice(&signature_bytes)?;
    let authenticated = format!("{header_json}.{claims_json}");

    let verifying_key = ecdsa::VerifyingKey::from_public_key_pem(public_key_pem)?;
    verifying_key.verify(authenticated.as_bytes(), &signature)?;

    decode_from_json(claims_json)
}

fn decode_from_json<T: DeserializeOwned>(s: &str) -> Result<T, Box<dyn Error>> {
    let bytes = decode_to_bytes(s)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn decode_to_bytes(s: &str) -> Result<Vec<u8>, ct_codecs::Error> {
    Base64UrlSafeNoPadding::decode_to_vec(s, None)
}
