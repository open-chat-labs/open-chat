use crate::guards::caller_is_governance_principal;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::ONE_MB;
use oc_error_codes::OCErrorCode;
use types::{C2CError, CanisterId};
use user_index_canister::export_migrating_user::{Response::*, *};

// Pulls everything a user being migrated exports, in pages, as the MultiUser canister does, so that
// the export can be tested until the MultiUser canister imports users itself. Only available in test
// mode, and only for a migration started with the UserIndex as the MultiUser canister.
#[update(guard = "caller_is_governance_principal", msgpack = true)]
#[trace]
async fn export_migrating_user(args: Args) -> Response {
    if !read_state(|state| state.data.test_mode) {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }

    match export(args.user_id.canister_id()).await {
        Ok(result) => Success(result),
        Err(error) => Error(error.into()),
    }
}

async fn export(canister_id: CanisterId) -> Result<SuccessResult, C2CError> {
    const PAGE_SIZE: u32 = ONE_MB as u32;

    let mut user_bytes = 0;
    loop {
        let user_canister::c2c_export_user::Response::Success(page) = user_canister_c2c_client::c2c_export_user(
            canister_id,
            &user_canister::c2c_export_user::Args {
                from: user_bytes,
                page_size: PAGE_SIZE,
            },
        )
        .await?;

        user_bytes += page.len() as u64;
        if page.len() < PAGE_SIZE as usize {
            break;
        }
    }

    let mut stable_memory_entries = 0;
    let mut stable_memory_bytes = 0;
    let mut after = None;
    loop {
        let user_canister::c2c_export_user_stable_memory::Response::Success(page) =
            user_canister_c2c_client::c2c_export_user_stable_memory(
                canister_id,
                &user_canister::c2c_export_user_stable_memory::Args { after: after.clone() },
            )
            .await?;

        stable_memory_entries += page.entries.len() as u32;
        stable_memory_bytes += page.entries.iter().map(|(k, v)| (k.len() + v.len()) as u64).sum::<u64>();
        after = page.entries.last().map(|(key, _)| key.clone());
        if page.finished {
            break;
        }
    }

    Ok(SuccessResult {
        user_bytes,
        stable_memory_entries,
        stable_memory_bytes,
    })
}
