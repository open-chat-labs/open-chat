use crate::{P2PSwap, User};
use types::{CanisterId, OCResult, TimestampMillis};
use user_canister::c2c_accept_p2p_swap::Args;

// Checks the acceptance of a swap in a group or channel, which the group or community has already
// reserved for the user. The caller then deposits token1 into the escrow canister.
pub fn prepare(user: &mut User, this_canister_id: CanisterId, args: &mut Args, now: TimestampMillis) -> OCResult {
    user.pin_number.verify(args.pin.as_mut(), now)?;
    ledger_utils::validate_from_account(args.from_account, this_canister_id)
}

// Records the swap against the user, their deposit having been made
pub fn deposited(user: &mut User, args: Args) {
    user.p2p_swaps.add(P2PSwap {
        id: args.swap_id,
        location: args.location,
        created_by: args.created_by,
        created: args.created,
        token0: args.token0,
        token0_amount: args.token0_amount,
        token1: args.token1,
        token1_amount: args.token1_amount,
        expires_at: args.expires_at,
    });
}
