use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use registry_canister::set_model_catalog::{Response::*, *};
use user_index_canister_c2c_client::lookup_user;

// Owner-configurable on-device model catalog. Platform-operator only (same authority as
// set_airdrop_config). Validated for internal consistency before it's stored — it does NOT fetch the
// URLs; integrity of the downloaded files is guaranteed separately by the client's SHA-256 check.
#[update(msgpack = true)]
#[trace]
async fn set_model_catalog(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_operator => (),
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    }

    if let Err(error) = args.catalog.validate() {
        return InvalidCatalog(error);
    }

    let catalog = args.catalog;
    mutate_state(|state| {
        let now = state.env.now();
        state.data.model_catalog.update(
            |c| {
                *c = catalog;
                true
            },
            now,
        );
    });

    Success
}
