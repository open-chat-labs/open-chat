use ic_cdk::api::call::CallResult;
use ic_cdk::api::management_canister::ecdsa::{EcdsaKeyId, EcdsaPublicKeyArgument, SignWithEcdsaArgument};

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
