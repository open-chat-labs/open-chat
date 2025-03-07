use crate::generate_msgpack_update_call;
use escrow_canister::*;

// Queries

// Updates
generate_msgpack_update_call!(create_swap);
generate_msgpack_update_call!(notify_deposit);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo, UserId};

    #[allow(clippy::too_many_arguments)]
    pub fn create_swap(
        env: &mut PocketIc,
        sender: Principal,
        escrow_canister_id: CanisterId,
        location: P2PSwapLocation,
        input_token: TokenInfo,
        input_amount: u128,
        output_token: TokenInfo,
        output_amount: u128,
        expires_at: TimestampMillis,
    ) -> u32 {
        let response = super::create_swap(
            env,
            sender,
            escrow_canister_id,
            &escrow_canister::create_swap::Args {
                location,
                token0: input_token,
                token0_amount: input_amount,
                token1: output_token,
                token1_amount: output_amount,
                expires_at,
                additional_admins: Vec::new(),
                canister_to_notify: None,
            },
        );

        match response {
            escrow_canister::create_swap::Response::Success(result) => result.id,
            response => panic!("'create_swap' error: {response:?}"),
        }
    }

    pub fn notify_deposit(
        env: &mut PocketIc,
        user_id: UserId,
        escrow_canister_id: CanisterId,
        swap_id: u32,
    ) -> escrow_canister::notify_deposit::SuccessResult {
        let response = super::notify_deposit(
            env,
            user_id.into(),
            escrow_canister_id,
            &escrow_canister::notify_deposit::Args { swap_id, user_id: None },
        );

        match response {
            escrow_canister::notify_deposit::Response::Success(result) => result,
            response => panic!("'notify_deposit' error: {response:?}"),
        }
    }
}
