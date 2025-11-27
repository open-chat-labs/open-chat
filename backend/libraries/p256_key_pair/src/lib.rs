use p256::pkcs8::DecodePrivateKey;
use p256::{
    NistP256, ecdsa,
    elliptic_curve::{NonZeroScalar, rand_core::CryptoRngCore, subtle::CtOption},
    pkcs8::{EncodePrivateKey, EncodePublicKey},
};
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct P256KeyPair {
    #[serde(with = "serde_bytes")]
    sk_der: Vec<u8>,
    pk_pem: String,
}

impl P256KeyPair {
    pub fn new(rng: &mut impl CryptoRngCore) -> P256KeyPair {
        let sk: ecdsa::SigningKey = ecdsa::SigningKey::random(rng);

        P256KeyPair {
            sk_der: P256KeyPair::to_der(&sk).unwrap(),
            pk_pem: Self::signing_key_to_pem(sk),
        }
    }

    pub fn from_secret_key_der(sk_der: Vec<u8>) -> Result<P256KeyPair, Box<dyn Error>> {
        let p256_sk = p256::SecretKey::from_pkcs8_der(&sk_der)?;
        let sk = ecdsa::SigningKey::from_bytes(&p256_sk.to_bytes())?;
        let pk_pem = Self::signing_key_to_pem(sk);

        Ok(P256KeyPair { sk_der, pk_pem })
    }

    pub fn secret_key_der(&self) -> &[u8] {
        &self.sk_der
    }

    pub fn public_key_pem(&self) -> &str {
        &self.pk_pem
    }

    pub fn is_initialised(&self) -> bool {
        !self.sk_der.is_empty()
    }

    fn signing_key_to_pem(sk: ecdsa::SigningKey) -> String {
        sk.verifying_key().to_public_key_pem(Default::default()).unwrap()
    }

    fn to_der(p256_sk: &ecdsa::SigningKey) -> Result<Vec<u8>, Box<dyn Error>> {
        let scalar: CtOption<NonZeroScalar<NistP256>> = NonZeroScalar::from_repr(p256_sk.to_bytes());
        if bool::from(scalar.is_none()) {
            return Err("Invalid key pair".into());
        }
        let p256_sk = p256::SecretKey::from(NonZeroScalar::from_repr(scalar.unwrap().into()).unwrap());
        let pkcs8_der = p256_sk.to_pkcs8_der()?;
        Ok(pkcs8_der.as_bytes().to_vec())
    }
}
