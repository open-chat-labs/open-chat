use taco_exchange_canister::*;
use types::{C2CError, CanisterId};

// Candid uses positional args but a single return value, so the standard
// `generate_candid_c2c_call_tuple_args!` macro (which uses `decode_args`)
// doesn't fit. We pair `encode_args` with `decode_one` directly.

pub async fn get_expected_receive_amount_batch_multi(
    canister_id: CanisterId,
    args: get_expected_receive_amount_batch_multi::Args,
) -> Result<get_expected_receive_amount_batch_multi::Response, C2CError> {
    canister_client::make_c2c_call(
        canister_id,
        "getExpectedReceiveAmountBatchMulti",
        args,
        ::candid::encode_args,
        |r| ::candid::decode_one(r),
        None,
    )
    .await
}

pub async fn swap_multi_hop(
    canister_id: CanisterId,
    args: swap_multi_hop::Args,
) -> Result<swap_multi_hop::Response, C2CError> {
    canister_client::make_c2c_call(
        canister_id,
        "swapMultiHop",
        args,
        ::candid::encode_args,
        |r| ::candid::decode_one(r),
        None,
    )
    .await
}

pub async fn swap_split_routes(
    canister_id: CanisterId,
    args: swap_split_routes::Args,
) -> Result<swap_split_routes::Response, C2CError> {
    canister_client::make_c2c_call(
        canister_id,
        "swapSplitRoutes",
        args,
        ::candid::encode_args,
        |r| ::candid::decode_one(r),
        None,
    )
    .await
}
