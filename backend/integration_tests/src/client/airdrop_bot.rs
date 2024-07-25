use crate::generate_update_call;
use airdrop_bot_canister::*;

// Updates
generate_update_call!(initialize_bot);
generate_update_call!(set_airdrop);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::CanisterId;

    pub fn initialize(env: &mut PocketIc, sender: Principal, airdrop_bot_canister_id: CanisterId) {
        let response = super::initialize_bot(
            env,
            sender,
            airdrop_bot_canister_id,
            &airdrop_bot_canister::initialize_bot::Args {
                username: "AirdropBot".to_string(),
                display_name: Some("Airdrop Bot".to_string()),
            },
        );

        match response {
            user_index_canister::c2c_register_bot::Response::Success => (),
            _ => panic!("'initialize_bot' error: {response:?}"),
        }
    }
}
