use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use testing::rng::{random_from_u128, random_string};
use types::bot_actions::SendTextMessageArgs;
use types::{BotAction, BotCommandClaims, Chat, ChatEvent};
use user_index_canister::c2c_register_bot::OptionalBotConfig;

#[test]
fn bot_send_text_message_in_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);

    let bot_id = env.create_canister();

    let register_bot_response = client::user_index::c2c_register_bot(
        env,
        bot_id,
        canister_ids.user_index,
        &user_index_canister::c2c_register_bot::Args {
            username: random_string(),
            display_name: None,
            config: OptionalBotConfig {
                can_be_added_to_groups: None,
                supports_direct_messages: None,
            },
        },
    );
    assert!(matches!(
        register_bot_response,
        user_index_canister::c2c_register_bot::Response::Success
    ));

    tick_many(env, 3);

    client::local_user_index::happy_path::join_group(env, bot_id, canister_ids.local_user_index, group_id);

    let message_id = random_from_u128();

    let call_response = client::bot_api_gateway::call(
        env,
        bot_id,
        canister_ids.bot_api_gateway,
        &bot_api_gateway_canister::call::Args {
            action: BotAction::SendTextMessage(SendTextMessageArgs { text: random_string() }),
            jwt: build_jwt(BotCommandClaims {
                user_id: user.user_id,
                bot: bot_id,
                chat: Chat::Group(group_id),
                thread_root_message_index: None,
                message_id,
                command_name: todo!(),
                parameters: todo!(),
                version: todo!(),
                command_text: todo!(),
                bot_api_gateway: todo!(),
            }),
        },
    );
    assert!(call_response.is_ok());

    let event = client::group::happy_path::events(env, &user, group_id, 0.into(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(message) = event {
        assert_eq!(message.sender, bot_id.into());
    } else {
        panic!()
    }
}

fn build_jwt(_bot_command_claims: BotCommandClaims) -> String {
    "".to_string()
}
