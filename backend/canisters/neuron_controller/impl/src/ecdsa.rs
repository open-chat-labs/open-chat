use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister::ecdsa::{EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument, SignWithEcdsaArgument};

pub fn get_key_id(test_mode: bool) -> EcdsaKeyId {
    let key_name = if test_mode { "dfx_test_key" } else { "key_1" };

    EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: key_name.to_string(),
    }
}

pub async fn get_public_key(key_id: EcdsaKeyId) -> CallResult<Vec<u8>> {
    ic_cdk::api::management_canister::ecdsa::ecdsa_public_key(EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path: Vec::new(),
        key_id,
    })
    .await
    .map(|res| res.0.public_key)
}

pub async fn sign(key_id: EcdsaKeyId, message_hash: [u8; 32]) -> CallResult<Vec<u8>> {
    ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa(SignWithEcdsaArgument {
        message_hash: message_hash.to_vec(),
        derivation_path: Vec::new(),
        key_id,
    })
    .await
    .map(|res| res.0.signature)
}
