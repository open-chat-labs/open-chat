use ct_codecs::Base64UrlSafeNoPadding;
use ct_codecs::Encoder;
use p256::ecdsa;
use p256::ecdsa::signature::RandomizedDigestSigner;
use p256::elliptic_curve::rand_core::CryptoRngCore;
use p256::pkcs8::DecodePrivateKey;
use rand::rngs::StdRng;
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
    rng: &mut StdRng,
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
