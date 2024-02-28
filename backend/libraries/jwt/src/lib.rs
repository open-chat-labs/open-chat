use ct_codecs::Base64UrlSafeNoPadding;
use ct_codecs::Encoder;
use p256::ecdsa;
use p256::ecdsa::signature::RandomizedDigestSigner;
use p256::elliptic_curve::rand_core::CryptoRngCore;
use p256::pkcs8::DecodePrivateKey;
use serde::{Deserialize, Serialize};
use std::error::Error;
use types::TimestampMillis;

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
}

pub fn sign_and_encode_token<T: Serialize>(
    secret_key_der: &[u8],
    claims: T,
    rng: &mut impl CryptoRngCore,
) -> Result<String, Box<dyn Error>> {
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

    let signature = sign_token(&authenticated, secret_key_der, rng)?;

    let mut token = authenticated;
    token.push('.');
    token.push_str(&Base64UrlSafeNoPadding::encode_to_string(signature)?);
    Ok(token)
}

fn sign_token(token: &str, secret_key_der: &[u8], rng: &mut impl CryptoRngCore) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut digest = hmac_sha256::Hash::new();
    digest.update(token.as_bytes());

    let p256_sk = ecdsa::SigningKey::from_pkcs8_der(secret_key_der)?;

    let signature: ecdsa::Signature = p256_sk.sign_digest_with_rng(rng, digest);

    Ok(signature.to_vec())
}

#[derive(Debug, Clone, Serialize)]
struct JWTHeader {
    pub alg: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use std::time::{SystemTime, UNIX_EPOCH};
    use types::{StringChat, VideoCallClaims};

    #[test]
    fn sign_and_encode_token_succeeds() {
        let mut rng = rand::thread_rng();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

        for _ in 0..50 {
            let mut kp = P256KeyPair::default();
            kp.initialize(&mut rng);

            let sk_der = kp.secret_key_der();

            let claims = Claims::new(
                now + 300_000, // Token valid for 5 mins from now
                "StartVideoCall".to_string(),
                VideoCallClaims {
                    user_id: Principal::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap().into(),
                    chat_id: StringChat::Group("6nb6r-kyaaa-aaaar-asvgq-cai".to_string()),
                },
            );

            assert!(sign_and_encode_token(sk_der, claims, &mut rng).is_ok());
        }
    }
}
