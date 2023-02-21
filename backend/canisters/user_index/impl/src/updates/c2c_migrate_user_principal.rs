use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_migrate_user_principal::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_migrate_user_principal(args: Args) -> Response {
    mutate_state(|state| c2c_migrate_user_principal_impl(args, state))
}

fn c2c_migrate_user_principal_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id = runtime_state.env.caller().into();

    if let Some(user) = runtime_state.data.users.get_by_user_id(&user_id) {
        if user.principal == args.new_principal {
            SuccessNoChange
        } else if runtime_state.data.users.get_by_principal(&args.new_principal).is_some() {
            PrincipalAlreadyInUse
        } else if runtime_state.data.user_principal_migration_queue.count_pending(&user_id) > 0 {
            MigrationAlreadyInProgress
        } else {
            let old_principal = user.principal;
            let now = runtime_state.env.now();

            let mut clone = user.clone();
            clone.principal = args.new_principal;
            runtime_state.data.users.update(clone, now);

            runtime_state.data.user_principal_migration_queue.push(
                user_id,
                old_principal,
                args.new_principal,
                args.groups,
                runtime_state.data.storage_index_canister_id,
                runtime_state.data.notifications_index_canister_id,
            );

            Success
        }
    } else {
        UserNotFound
    }
}
