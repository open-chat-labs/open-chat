use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::bot_installations::*;

#[query(candid = true, msgpack = true)]
fn bot_installations(args: Args) -> Response {
    match read_state(|state| bot_installations_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn bot_installations_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    let Some(bot) = state.data.users.get_bot(&caller.into()) else {
        return Err(OCErrorCode::BotNotFound.into());
    };

    let mut installations: Vec<InstallationDetails> = bot
        .installations
        .iter()
        .map(|(location, details)| InstallationDetails {
            location: *location,
            installed_at: details.installed_at,
            local_user_index: details.local_user_index,
            granted_permissions: details.granted_permissions.clone(),
            granted_autonomous_permissions: details.granted_autonomous_permissions.clone(),
        })
        .collect();

    // Sort by installation time then by location to ensure consistent ordering
    installations.sort_by(|a, b| a.installed_at.cmp(&b.installed_at).then_with(|| a.location.cmp(&b.location)));

    let installations = installations
        .into_iter()
        .skip_while(|installation| args.installed_since.is_some_and(|location| installation.location != location))
        .take(args.max_results as usize)
        .collect();

    Ok(SuccessResult { installations })
}
