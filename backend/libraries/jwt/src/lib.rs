use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
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
    let key = EncodingKey::from_ec_der(secret_key_der);
    let header = Header::new(Algorithm::ES256);
    let token = encode(&header, &claims, &key)?;
    Ok(token)
}
