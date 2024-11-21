use bot_api_gateway_canister::c2c_handle_bot_actions;
use bot_api_gateway_canister::call::*;
use canister_client::generate_c2c_call;
use ic_cdk::update;

#[update]
async fn call(args: Args) -> Response {
    let target_canister_id = args.target_canister_id;

    match validate(args) {
        Ok(validated) => match c2c_handle_bot_actions(target_canister_id, &validated).await {
            Ok(Ok(_)) => Ok(()),
            Ok(Err(message)) => Err(BotApiCallError::CanisterError(message)),
            Err((code, message)) => Err(BotApiCallError::C2CError(code as i32, message)),
        },
        Err(message) => Err(BotApiCallError::Invalid(message)),
    }
}

fn validate(args: Args) -> Result<c2c_handle_bot_actions::Args, String> {
    // TODO - do the proper validation

    Ok(c2c_handle_bot_actions::Args {
        bot_user_id: args.bot_user_id,
        bot_username: "".to_string(), // TODO
        actions: args.actions,
    })
}

generate_c2c_call!(c2c_handle_bot_actions);
