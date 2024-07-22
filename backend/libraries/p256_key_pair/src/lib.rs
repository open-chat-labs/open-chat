use p256::{
    ecdsa,
    elliptic_curve::{rand_core::CryptoRngCore, subtle::CtOption, NonZeroScalar},
    pkcs8::{EncodePrivateKey, EncodePublicKey},
    NistP256,
};
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct P256KeyPair {
    sk_der: Vec<u8>,
    pk_pem: String,
}

impl P256KeyPair {
    pub fn from_secret_key_der(sk_der: Vec<u8>) -> P256KeyPair {
        let sk: ecdsa::SigningKey = ecdsa::SigningKey::from_slice(&sk_der).unwrap();
        let pk_pem = sk.verifying_key().to_public_key_pem(Default::default()).unwrap();

        P256KeyPair { sk_der, pk_pem }
    }

    pub fn initialize(&mut self, rng: &mut impl CryptoRngCore) {
        if self.is_initialised() {
            return;
        }

        let sk: ecdsa::SigningKey = ecdsa::SigningKey::random(rng);

        self.sk_der = P256KeyPair::to_der(&sk).unwrap();
        self.pk_pem = sk.verifying_key().to_public_key_pem(Default::default()).unwrap();
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
