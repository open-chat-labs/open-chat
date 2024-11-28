use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv};
use candid::Principal;
use constants::NANOS_PER_MILLISECOND;
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_internet_identity_principal, random_string};
use types::{Delegation, SignedDelegation};

#[test_case(false)]
#[test_case(true)]
fn link_auth_identities(delay: bool) {
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
        false,
    );

    let oc_principal1 = Principal::self_authenticating(create_identity_result.user_key.clone());
    client::local_user_index::happy_path::register_user(
        env,
        oc_principal1,
        canister_ids.local_user_index,
        create_identity_result.user_key,
    );

    env.tick();

    client::identity::happy_path::initiate_identity_link(
        env,
        auth_principal2,
        canister_ids.identity,
        public_key2,
        true,
        auth_principal1,
    );

    if delay {
        env.advance_time(Duration::from_secs(301));
    }

    let approve_identity_link_response = client::identity::approve_identity_link(
        env,
        auth_principal1,
        canister_ids.identity,
        &identity_canister::approve_identity_link::Args {
            delegation: delegation1,
            public_key: public_key1,
            link_initiated_by: auth_principal2,
        },
    );

    match approve_identity_link_response {
        identity_canister::approve_identity_link::Response::Success if !delay => {
            let prepare_delegation_response =
                client::identity::happy_path::prepare_delegation(env, auth_principal2, canister_ids.identity, session_key2);

            let oc_principal2 = Principal::self_authenticating(prepare_delegation_response.user_key);

            assert_eq!(oc_principal1, oc_principal2);
        }
        identity_canister::approve_identity_link::Response::DelegationTooOld if delay => {}
        response => panic!("{response:?}"),
    };
}

#[test_case(false)]
#[test_case(true)]
fn flag_ii_principal(is_ii_principal: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal, public_key) = if is_ii_principal {
        random_internet_identity_principal()
    } else {
        let (a, p, _) = sign_in_with_email(env, canister_ids);
        (a, p)
    };

    let session_key = random::<[u8; 32]>().to_vec();

    client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key.clone(),
        session_key.clone(),
        is_ii_principal,
    );

    let auth_principals_response = client::identity::happy_path::auth_principals(env, auth_principal, canister_ids.identity);

    assert_eq!(auth_principals_response.len(), 1);
    assert_eq!(auth_principals_response.first().unwrap().is_ii_principal, is_ii_principal);
}

fn sign_in_with_email(env: &mut PocketIc, canister_ids: &CanisterIds) -> (Principal, Vec<u8>, SignedDelegation) {
    let email = format!("{}@test.com", random_string());
    let session_key = random::<[u8; 32]>().to_vec();

    let generate_magic_link_response = client::sign_in_with_email::generate_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::GenerateMagicLinkArgs {
            email: email.clone(),
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
        generate_magic_link_success.code,
    );

    let handle_magic_link_response = client::sign_in_with_email::handle_magic_link(
        env,
        Principal::anonymous(),
        canister_ids.sign_in_with_email,
        &sign_in_with_email_canister::HandleMagicLinkArgs {
            link: format!("{}&c={}", magic_link.build_querystring(), magic_link.magic_link.code()),
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
