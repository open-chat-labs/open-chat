use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;
use std::error::Error;
use types::{Chat, TimestampMillis, UserId};

#[derive(Serialize)]
pub struct VideoCallClaim {
    exp: usize,
    claim_type: String,
    user_id: UserId,
    username: String,
    chat_id: Chat,
}

impl VideoCallClaim {
    pub fn new(user_id: UserId, username: String, chat_id: Chat, now: TimestampMillis) -> VideoCallClaim {
        VideoCallClaim {
            exp: now as usize / 1000 + 300,
            claim_type: "video_call".to_string(),
            user_id,
            username,
            chat_id,
        }
    }
}

pub fn sign_and_encode_token<T: Serialize>(secret_key_der: &[u8], claim: T) -> Result<String, Box<dyn Error>> {
    let key = EncodingKey::from_ec_der(secret_key_der);
    let header = Header::new(Algorithm::ES256);
    let token = encode(&header, &claim, &key)?;
    Ok(token)
}
