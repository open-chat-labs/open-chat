use ct_codecs::Base64UrlSafeNoPadding;
use ct_codecs::Encoder;
use p256::ecdsa::{self, signature::DigestSigner as _};
use p256::pkcs8::DecodePrivateKey;
use serde::Serialize;
use std::error::Error;
use types::{Chat, TimestampMillis, UserId};

#[derive(Serialize)]
pub struct VideoCallClaims {
    exp: usize,
    claim_type: String,
    user_id: UserId,
    chat_id: Chat,
}

impl VideoCallClaims {
    pub fn new(user_id: UserId, chat_id: Chat, start_call: bool, now: TimestampMillis) -> VideoCallClaims {
        let claim_type = if start_call { "start_video_call" } else { "join_video_call" };
        VideoCallClaims {
            exp: now as usize / 1000 + 300,
            claim_type: claim_type.to_string(),
            user_id,
            chat_id,
        }
    }
}

pub fn sign_and_encode_token<T: Serialize>(secret_key_der: &[u8], claims: T) -> Result<String, Box<dyn Error>> {
    let jwt_header = JWTHeader {
        alg: "ES256".to_string(),
    };
    let jwt_header_json = serde_json::to_string(&jwt_header)?;
    let claims_json = serde_json::to_string(&claims)?;
    let authenticated = format!(
        "{}.{}",
        Base64UrlSafeNoPadding::encode_to_string(jwt_header_json)?,
        Base64UrlSafeNoPadding::encode_to_string(claims_json)?
    );

    let signature = sign_token(&authenticated, secret_key_der)?;

    let mut token = authenticated;
    token.push('.');
    token.push_str(&Base64UrlSafeNoPadding::encode_to_string(signature)?);
    Ok(token)
}

fn sign_token(token: &str, secret_key_der: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut digest = hmac_sha256::Hash::new();
    digest.update(token.as_bytes());

    let p256_sk = ecdsa::SigningKey::from_pkcs8_der(secret_key_der)?;

    let signature: ecdsa::Signature = p256_sk.sign_digest(digest);

    Ok(signature.to_vec())
}

#[derive(Debug, Clone, Serialize)]
struct JWTHeader {
    pub alg: String,
}
