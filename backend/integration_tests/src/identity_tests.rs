use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv};
use candid::Principal;
use identity_canister::{Delegation, SignedDelegation};
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use testing::rng::random_internet_identity_principal;
use utils::time::NANOS_PER_MILLISECOND;

#[test]
fn link_auth_identities_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal1, public_key1, delegation1) = sign_in_with_email(env, canister_ids);
    let (auth_principal2, public_key2) = random_internet_identity_principal();

    let session_key1 = random::<[u8; 32]>().to_vec();
    let session_key2 = random::<[u8; 32]>().to_vec();

    let create_identity_result = client::identity::happy_path::create_identity(
        env,
        auth_principal1,
        canister_ids.identity,
        public_key1.clone(),
        session_key1.clone(),
    );

    let oc_principal1 = Principal::self_authenticating(create_identity_result.user_key);

    client::identity::happy_path::initiate_identity_link(
        env,
        auth_principal2,
        canister_ids.identity,
        public_key2,
        auth_principal1,
    );
    client::identity::happy_path::approve_identity_link(
        env,
        auth_principal1,
        canister_ids.identity,
        delegation1,
        public_key1,
        auth_principal2,
    );

    let prepare_delegation_response =
        client::identity::happy_path::prepare_delegation(env, auth_principal2, canister_ids.identity, session_key2);

    let oc_principal2 = Principal::self_authenticating(prepare_delegation_response.user_key);

    assert_eq!(oc_principal1, oc_principal2);
}

fn sign_in_with_email(env: &mut PocketIc, canister_ids: &CanisterIds) -> (Principal, Vec<u8>, SignedDelegation) {
    let email = "test@test.com";
    let session_key = random::<[u8; 32]>().to_vec();

    let generate_magic_link_response = client::sign_in_with_email::generate_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::GenerateMagicLinkArgs {
            email: email.to_string(),
            session_key: session_key.clone(),
            max_time_to_live: None,
        },
    );

    let sign_in_with_email_canister::GenerateMagicLinkResponse::Success(generate_magic_link_success) =
        generate_magic_link_response
    else {
        panic!("{generate_magic_link_response:?}");
    };

    let magic_link = sign_in_with_email_canister_test_utils::generate_magic_link(
        &email,
        session_key.clone(),
        generate_magic_link_success.created * NANOS_PER_MILLISECOND,
        generate_magic_link_success.expiration,
    );

    let handle_magic_link_response = client::sign_in_with_email::handle_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::HandleMagicLinkArgs {
            link: magic_link.build_querystring(),
        },
    );
    assert!(matches!(
        handle_magic_link_response,
        sign_in_with_email_canister::HandleMagicLinkResponse::Success
    ));

    let get_delegation_response = client::sign_in_with_email::get_delegation(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::GetDelegationArgs {
            email: email.to_string(),
            session_key,
            expiration: generate_magic_link_success.expiration,
        },
    );

    let sign_in_with_email_canister::GetDelegationResponse::Success(delegation) = get_delegation_response else {
        panic!("{get_delegation_response:?}");
    };

    let principal = Principal::self_authenticating(&generate_magic_link_success.user_key);
    let public_key = generate_magic_link_success.user_key;
    let delegation = SignedDelegation {
        delegation: Delegation {
            pubkey: delegation.delegation.pubkey,
            expiration: delegation.delegation.expiration,
        },
        signature: delegation.signature,
    };

    (principal, public_key, delegation)
}
