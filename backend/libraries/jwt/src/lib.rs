use ct_codecs::Encoder;
use ct_codecs::{Base64UrlSafeNoPadding, Decoder};
use p256::ecdsa;
use p256::ecdsa::signature::{RandomizedDigestSigner, Verifier};
use p256::elliptic_curve::rand_core::CryptoRngCore;
use p256::pkcs8::{DecodePrivateKey, DecodePublicKey};
use serde::de::DeserializeOwned;
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

pub fn sign_and_encode_token<T: Serialize>(
    secret_key_der: &[u8],
    claims: T,
    rng: &mut impl CryptoRngCore,
) -> Result<String, Box<dyn Error>> {
    let jwt_header = JwtHeader {
        alg: "ES256".to_string(),
    };
    let authenticated = format!("{}.{}", encode_as_json(&jwt_header)?, encode_as_json(&claims)?);

    let signature = sign_token(&authenticated, secret_key_der, rng)?;

    let mut token = authenticated;
    token.push('.');
    token.push_str(&encode_bytes(&signature)?);
    Ok(token)
}

pub fn verify_jwt<T: DeserializeOwned>(jwt: &str, public_key_pem: &str) -> Result<T, Box<dyn Error>> {
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

fn sign_token(token: &str, secret_key_der: &[u8], rng: &mut impl CryptoRngCore) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut digest = hmac_sha256::Hash::new();
    digest.update(token.as_bytes());

    let p256_sk = ecdsa::SigningKey::from_pkcs8_der(secret_key_der)?;

    let signature: ecdsa::Signature = p256_sk.sign_digest_with_rng(rng, digest);

    Ok(signature.to_vec())
}

fn encode_as_json<T: Serialize>(value: &T) -> Result<String, Box<dyn Error>> {
    let bytes = serde_json::to_vec(value)?;
    Ok(encode_bytes(&bytes)?)
}

fn encode_bytes(bytes: &[u8]) -> Result<String, ct_codecs::Error> {
    Base64UrlSafeNoPadding::encode_to_string(bytes)
}

fn decode_from_json<T: DeserializeOwned>(s: &str) -> Result<T, Box<dyn Error>> {
    let bytes = decode_to_bytes(s)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn decode_to_bytes(s: &str) -> Result<Vec<u8>, ct_codecs::Error> {
    Base64UrlSafeNoPadding::decode_to_vec(s, None)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct JwtHeader {
    pub alg: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use std::time::{SystemTime, UNIX_EPOCH};
    use types::{StartVideoCallClaims, StringChat, VideoCallType};

    #[test]
    fn sign_and_encode_token_then_verify_succeeds() {
        let mut rng = rand::thread_rng();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

        for _ in 0..50 {
            let mut kp = P256KeyPair::default();
            kp.initialize(&mut rng);

            let sk_der = kp.secret_key_der();
            let pk_pem = kp.public_key_pem();

            let claims = Claims::new(
                now + 300_000, // Token valid for 5 mins from now
                "StartVideoCall".to_string(),
                StartVideoCallClaims {
                    user_id: Principal::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap().into(),
                    chat_id: StringChat::Group("6nb6r-kyaaa-aaaar-asvgq-cai".to_string()),
                    call_type: VideoCallType::Default,
                    is_diamond: true,
                },
            );

            let jwt = sign_and_encode_token(sk_der, claims, &mut rng).unwrap();

            let claims: Claims<StartVideoCallClaims> = verify_jwt(&jwt, pk_pem).unwrap();

            assert_eq!(claims.claim_type, "StartVideoCall");
        }
    }
}
