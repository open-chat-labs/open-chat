use crate::{generate_query_call, generate_update_call};
use identity_canister::*;

// Queries
generate_query_call!(auth_principals);
generate_query_call!(check_auth_principal);
generate_query_call!(get_delegation);

// Updates
generate_update_call!(approve_identity_link);
generate_update_call!(create_identity);
generate_update_call!(initiate_identity_link);
generate_update_call!(prepare_delegation);
generate_update_call!(remove_identity_link);

pub mod happy_path {
    use candid::Principal;
    use identity_canister::auth_principals::UserPrincipal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, SignedDelegation, TimestampMillis};

    pub fn create_identity(
        env: &mut PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        public_key: Vec<u8>,
        session_key: Vec<u8>,
        is_ii_principal: bool,
    ) -> identity_canister::create_identity::SuccessResult {
        let response = super::create_identity(
            env,
            sender,
            identity_canister_id,
            &identity_canister::create_identity::Args {
                public_key,
                webauthn_key: None,
                session_key,
                is_ii_principal: Some(is_ii_principal),
                max_time_to_live: None,
                challenge_attempt: None,
            },
        );

        match response {
            identity_canister::create_identity::Response::Success(result) => result,
            response => panic!("'create_identity' error: {response:?}"),
        }
    }

    pub fn prepare_delegation(
        env: &mut PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        session_key: Vec<u8>,
    ) -> identity_canister::prepare_delegation::SuccessResult {
        let response = super::prepare_delegation(
            env,
            sender,
            identity_canister_id,
            &identity_canister::prepare_delegation::Args {
                session_key,
                is_ii_principal: None,
                max_time_to_live: None,
            },
        );

        match response {
            identity_canister::prepare_delegation::Response::Success(result) => result,
            response => panic!("'prepare_delegation' error: {response:?}"),
        }
    }

    pub fn get_delegation(
        env: &PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        session_key: Vec<u8>,
        expiration: TimestampMillis,
    ) -> SignedDelegation {
        let response = super::get_delegation(
            env,
            sender,
            identity_canister_id,
            &identity_canister::get_delegation::Args { session_key, expiration },
        );

        match response {
            identity_canister::get_delegation::Response::Success(signed_delegation) => signed_delegation,
            response => panic!("'get_delegation' error: {response:?}"),
        }
    }

    pub fn initiate_identity_link(
        env: &mut PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        public_key: Vec<u8>,
        is_ii_principal: bool,
        link_to_principal: Principal,
    ) {
        let response = super::initiate_identity_link(
            env,
            sender,
            identity_canister_id,
            &identity_canister::initiate_identity_link::Args {
                public_key,
                webauthn_key: None,
                is_ii_principal: Some(is_ii_principal),
                link_to_principal,
            },
        );

        match response {
            identity_canister::initiate_identity_link::Response::Success => (),
            response => panic!("'initiate_identity_link' error: {response:?}"),
        }
    }

    pub fn approve_identity_link(
        env: &mut PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        delegation: SignedDelegation,
        public_key: Vec<u8>,
        link_initiated_by: Principal,
    ) {
        let response = super::approve_identity_link(
            env,
            sender,
            identity_canister_id,
            &identity_canister::approve_identity_link::Args {
                delegation,
                public_key,
                link_initiated_by,
            },
        );

        match response {
            identity_canister::approve_identity_link::Response::Success => (),
            response => panic!("'approve_identity_link' error: {response:?}"),
        }
    }

    pub fn remove_identity_link(
        env: &mut PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        linked_principal: Principal,
    ) {
        let response = super::remove_identity_link(
            env,
            sender,
            identity_canister_id,
            &identity_canister::remove_identity_link::Args { linked_principal },
        );

        match response {
            identity_canister::remove_identity_link::Response::Success => (),
            response => panic!("'remove_identity_link' error: {response:?}"),
        }
    }

    pub fn auth_principals(env: &mut PocketIc, sender: Principal, identity_canister_id: CanisterId) -> Vec<UserPrincipal> {
        let response = super::auth_principals(
            env,
            sender,
            identity_canister_id,
            &identity_canister::auth_principals::Args {},
        );

        match response {
            identity_canister::auth_principals::Response::Success(auth_principals) => auth_principals,
            response => panic!("'auth_principals' error: {response:?}"),
        }
    }
}
