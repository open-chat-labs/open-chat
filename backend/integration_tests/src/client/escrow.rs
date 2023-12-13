use crate::generate_update_call;
use escrow_canister::*;

// Queries

// Updates
generate_update_call!(create_offer);
generate_update_call!(notify_deposit);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, Cryptocurrency, TimestampMillis, UserId};

    #[allow(clippy::too_many_arguments)]
    pub fn create_offer(
        env: &mut PocketIc,
        sender: Principal,
        escrow_canister_id: CanisterId,
        input_token: Cryptocurrency,
        input_amount: u128,
        output_token: Cryptocurrency,
        output_amount: u128,
        expires_at: TimestampMillis,
    ) -> u32 {
        let response = super::create_offer(
            env,
            sender,
            escrow_canister_id,
            &escrow_canister::create_offer::Args {
                input_token: input_token.try_into().unwrap(),
                input_amount,
                output_token: output_token.try_into().unwrap(),
                output_amount,
                expires_at,
            },
        );

        match response {
            escrow_canister::create_offer::Response::Success(result) => result.id,
            response => panic!("'create_offer' error: {response:?}"),
        }
    }

    pub fn notify_deposit(
        env: &mut PocketIc,
        user_id: UserId,
        escrow_canister_id: CanisterId,
        offer_id: u32,
    ) -> escrow_canister::notify_deposit::SuccessResult {
        let response = super::notify_deposit(
            env,
            user_id.into(),
            escrow_canister_id,
            &escrow_canister::notify_deposit::Args { offer_id, user_id: None },
        );

        match response {
            escrow_canister::notify_deposit::Response::Success(result) => result,
            response => panic!("'notify_deposit' error: {response:?}"),
        }
    }
}
