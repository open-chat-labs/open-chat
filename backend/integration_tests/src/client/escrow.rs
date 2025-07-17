use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use escrow_canister::*;

// Queries
generate_msgpack_query_call!(lookup_swap);

// Updates
generate_msgpack_update_call!(create_swap);
generate_msgpack_update_call!(notify_deposit);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo};

    #[expect(clippy::too_many_arguments)]
    pub fn create_swap(
        env: &mut PocketIc,
        sender: Principal,
        escrow_canister_id: CanisterId,
        location: P2PSwapLocation,
        input_token: TokenInfo,
        input_amount: u128,
        input_token0_principal: Option<Principal>,
        output_token: TokenInfo,
        output_amount: u128,
        output_token0_principal: Option<Principal>,
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
                token0_principal: input_token0_principal,
                token1: output_token,
                token1_amount: output_amount,
                token1_principal: output_token0_principal,
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

    pub fn lookup_swap(
        env: &mut PocketIc,
        sender: Principal,
        escrow_canister_id: CanisterId,
        swap_id: u32,
        accepting_principal: Option<Principal>,
    ) -> escrow_canister::lookup_swap::Swap {
        let response = super::lookup_swap(
            env,
            sender,
            escrow_canister_id,
            &escrow_canister::lookup_swap::Args {
                swap_id,
                accepting_principal,
            },
        );

        match response {
            escrow_canister::lookup_swap::Response::Success(swap) => swap,
            response => panic!("'lookup_swap' error: {response:?}"),
        }
    }

    pub fn notify_deposit(
        env: &mut PocketIc,
        sender: Principal,
        escrow_canister_id: CanisterId,
        swap_id: u32,
        deposited_by: Option<Principal>,
    ) -> escrow_canister::notify_deposit::SuccessResult {
        let response = super::notify_deposit(
            env,
            sender,
            escrow_canister_id,
            &escrow_canister::notify_deposit::Args { swap_id, deposited_by },
        );

        match response {
            escrow_canister::notify_deposit::Response::Success(result) => result,
            response => panic!("'notify_deposit' error: {response:?}"),
        }
    }
}
