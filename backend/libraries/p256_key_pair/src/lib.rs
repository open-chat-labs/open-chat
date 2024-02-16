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
    pub secret_key_der: Vec<u8>,
    pub public_key_pem: String,
}

impl P256KeyPair {
    pub fn generate(rng: &mut impl CryptoRngCore) -> P256KeyPair {
        let sk: ecdsa::SigningKey = ecdsa::SigningKey::random(rng);
        let secret_key = P256KeyPair::to_der(&sk).unwrap();
        let public_key = sk.verifying_key().to_public_key_pem(Default::default()).unwrap();

        P256KeyPair {
            secret_key_der: secret_key,
            public_key_pem: public_key,
        }
    }

    pub fn is_initialised(&self) -> bool {
        !self.secret_key_der.is_empty()
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
