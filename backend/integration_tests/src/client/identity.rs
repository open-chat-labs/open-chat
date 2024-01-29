use crate::{generate_query_call, generate_update_call};
use identity_canister::*;

// Queries
generate_query_call!(check_auth_principal);

// Updates
generate_update_call!(migrate_legacy_principal);

pub mod happy_path {
    use crate::User;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::CanisterId;

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
