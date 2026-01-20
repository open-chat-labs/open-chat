use rsa::pkcs1v15::{SigningKey, VerifyingKey};
use rsa::rand_core::CryptoRngCore;
use rsa::sha2::Sha256;
use rsa::signature::{SignatureEncoding, Signer, Verifier};
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha256::sha256;
use sign_in_with_email_canister::{
    DEFAULT_SESSION_EXPIRATION_PERIOD, Delegation, Hash, MAX_SESSION_EXPIRATION_PERIOD, Milliseconds, NANOS_PER_MILLISECOND,
    Nanoseconds, TimestampMillis,
};

const MAGIC_LINK_EXPIRATION: Milliseconds = 10 * 60 * 1000; // 10 minutes

pub fn generate<R: CryptoRngCore>(
    email: String,
    session_key: Vec<u8>,
    max_time_to_live: Option<Nanoseconds>,
    rng: &mut R,
    now: TimestampMillis,
) -> MagicLink {
    let delta = Nanoseconds::min(
        max_time_to_live.unwrap_or(DEFAULT_SESSION_EXPIRATION_PERIOD),
        MAX_SESSION_EXPIRATION_PERIOD,
    );

    let code = generate_random_3digit_code(rng);
    let now_nanos = now * NANOS_PER_MILLISECOND;
    let expiration = now_nanos.saturating_add(delta);
    let delegation = Delegation {
        pubkey: session_key,
        expiration,
    };

    MagicLink::new(email, delegation, code, now)
}

pub fn generate_random_3digit_code<R: CryptoRngCore>(rng: &mut R) -> String {
    let code = rng.next_u32() % 1000;
    format!("{:0>3}", code)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MagicLink {
    created: TimestampMillis,
    email: String,
    delegation: Delegation,
    code: String,
}

impl MagicLink {
    pub fn new(email: String, delegation: Delegation, code: String, now: TimestampMillis) -> MagicLink {
        MagicLink {
            created: now,
            email,
            delegation,
            code,
        }
    }

    pub fn created(&self) -> TimestampMillis {
        self.created
    }

    pub fn email(&self) -> &str {
        &self.email
    }

    pub fn delegation(&self) -> &Delegation {
        &self.delegation
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn expired(&self, now: TimestampMillis) -> bool {
        self.created + MAGIC_LINK_EXPIRATION < now
    }

    pub fn serialize(&self) -> Vec<u8> {
        rmp_serde::to_vec_named(self).unwrap()
    }

    pub fn deserialize(bytes: &[u8]) -> MagicLink {
        rmp_serde::from_slice(bytes).unwrap()
    }

    pub fn hash(&self) -> Hash {
        let bytes = self.serialize();
        sha256(&bytes)
    }

    pub fn sign(self, rsa_private_key: RsaPrivateKey) -> SignedMagicLink {
        let hash = self.hash();
        let signing_key: SigningKey<Sha256> = SigningKey::new(rsa_private_key);
        let signature = signing_key.sign(&hash).to_vec();

        SignedMagicLink {
            magic_link: self,
            signature,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SignedMagicLink {
    pub magic_link: MagicLink,
    pub signature: Vec<u8>,
}

impl SignedMagicLink {
    pub fn sign(self, rsa_private_key: RsaPrivateKey) -> DoubleSignedMagicLink {
        let signing_key: SigningKey<Sha256> = SigningKey::new(rsa_private_key);
        let signature2 = signing_key.sign(&self.signature).to_vec();

        DoubleSignedMagicLink {
            magic_link: self.magic_link,
            signature1: self.signature,
            signature2,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DoubleSignedMagicLink {
    pub magic_link: MagicLink,
    pub signature1: Vec<u8>,
    pub signature2: Vec<u8>,
}

impl DoubleSignedMagicLink {
    pub fn verify_sigs(&self, rsa_public_key: RsaPublicKey, email_sender_rsa_public_key: RsaPublicKey) -> bool {
        if !verify_sig(email_sender_rsa_public_key, &self.signature1, &self.signature2) {
            return false;
        }

        verify_sig(rsa_public_key, &self.magic_link.hash(), &self.signature1)
    }

    pub fn build_querystring(&self) -> String {
        format!(
            "?auth&m={}&s1={}&s2={}",
            hex_to_string(&self.magic_link.serialize()),
            hex_to_string(&self.signature1),
            hex_to_string(&self.signature2),
        )
    }

    pub fn from_hex_strings(magic_link: &str, signature1: &str, signature2: &str) -> DoubleSignedMagicLink {
        DoubleSignedMagicLink {
            magic_link: MagicLink::deserialize(&string_to_hex(magic_link)),
            signature1: string_to_hex(signature1),
            signature2: string_to_hex(signature2),
        }
    }
}

fn verify_sig(rsa_public_key: RsaPublicKey, msg: &[u8], signature: &[u8]) -> bool {
    let Ok(rsa_signature) = rsa::pkcs1v15::Signature::try_from(signature) else {
        return false;
    };

    let verifying_key: VerifyingKey<Sha256> = VerifyingKey::new(rsa_public_key);
    verifying_key.verify(msg, &rsa_signature).is_ok()
}

fn hex_to_string(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

fn string_to_hex(str: &str) -> Vec<u8> {
    hex::decode(str).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_sigs() {
        let magic_link = MagicLink {
            created: 1000,
            email: "a@b.com".to_string(),
            delegation: Delegation {
                pubkey: vec![2; 32],
                expiration: 1000000000,
            },
            code: "123".to_string(),
        };

        let mut rng = rand::thread_rng();
        let private_key1 = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let public_key1 = private_key1.to_public_key();

        let private_key2 = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let public_key2 = private_key2.to_public_key();

        let signed = magic_link.sign(private_key1).sign(private_key2);

        assert!(signed.verify_sigs(public_key1, public_key2));
    }
}
