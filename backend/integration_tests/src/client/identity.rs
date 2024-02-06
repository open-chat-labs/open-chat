use crate::{generate_query_call, generate_update_call};
use identity_canister::*;

// Queries
generate_query_call!(check_auth_principal);
generate_query_call!(get_delegation);

// Updates
generate_update_call!(migrate_legacy_principal);
generate_update_call!(prepare_delegation);

pub mod happy_path {
    use crate::User;
    use candid::Principal;
    use identity_canister::{Delegation, SignedDelegation};
    use pocket_ic::PocketIc;
    use serde_bytes::ByteBuf;
    use types::CanisterId;

    pub fn prepare_delegation(env: &mut PocketIc, user: &User, identity_canister_id: CanisterId) -> Delegation {
        let response = super::prepare_delegation(
            env,
            user.principal,
            identity_canister_id,
            &identity_canister::prepare_delegation::Args {
                session_key: ByteBuf::from(user.public_key.clone()),
                max_time_to_live: None,
            },
        );

        match response {
            identity_canister::prepare_delegation::Response::Success(delegation) => delegation,
            response => panic!("'prepare_delegation' error: {response:?}"),
        }
    }

    pub fn get_delegation(
        env: &PocketIc,
        sender: Principal,
        identity_canister_id: CanisterId,
        delegation: Delegation,
    ) -> SignedDelegation {
        let response = super::get_delegation(env, sender, identity_canister_id, &delegation);

        match response {
            identity_canister::get_delegation::Response::Success(signed_delegation) => signed_delegation,
            response => panic!("'get_delegation' error: {response:?}"),
        }
    }

    pub fn migrate_legacy_principal(env: &mut PocketIc, user: &User, identity_canister_id: CanisterId) -> Principal {
        let response = super::migrate_legacy_principal(
            env,
            user.principal,
            identity_canister_id,
            &identity_canister::migrate_legacy_principal::Args {
                public_key: user.public_key.clone(),
            },
        );

        match response {
            identity_canister::migrate_legacy_principal::Response::Success(result) => result.new_principal,
            response => panic!("'migrate_legacy_principal' error: {response:?}"),
        }
    }
}
