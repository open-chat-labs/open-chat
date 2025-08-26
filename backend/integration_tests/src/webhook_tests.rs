use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use group_canister::send_message_v2;
use reqwest::Url;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{Chat, ChatEvent, ChatType, EventIndex, MessageContent, SenderContext, UserId};

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn e2e_webhook_test(chat_type: ChatType) {
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);

    let chat = match chat_type {
        ChatType::Group => Chat::Group(client::user::happy_path::create_group(
            env,
            &owner,
            &random_string(),
            true,
            true,
        )),
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
            Chat::Channel(community_id, channel_id)
        }
        ChatType::Direct => unreachable!(),
    };

    // Register a webhook and get the details
    let name = random_string();
    let webhook_details = match chat {
        Chat::Group(group_id) => {
            client::group::happy_path::register_webhook(env, owner.principal, group_id, name.clone(), None);
            let updates = client::group::happy_path::selected_updates(env, owner.principal, group_id, start);
            assert!(updates.is_some());
            updates.unwrap().webhooks
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::register_webhook(env, owner.principal, community_id, channel_id, name.clone(), None);
            let updates =
                client::community::happy_path::selected_channel_updates(env, owner.principal, community_id, channel_id, start);
            assert!(updates.is_some());
            updates.unwrap().webhooks
        }
        _ => unreachable!(),
    };

    assert!(webhook_details.is_some());
    let webhook_details = webhook_details.unwrap();
    assert_eq!(webhook_details.len(), 1);
    let webhook_details = webhook_details.first().unwrap();
    assert_eq!(webhook_details.name, name);

    // Get the webhook secret
    let webhook_secret = match chat {
        Chat::Group(group_id) => client::group::happy_path::webhook(env, owner.principal, group_id, webhook_details.id),
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::webhook(env, owner.principal, community_id, channel_id, webhook_details.id)
        }
        _ => unreachable!(),
    };

    // Post a message to the webhook
    let message_text = random_string();
    let gateway_url = env.make_live(None);
    let response = post_message_to_webhook(chat, webhook_details.id, webhook_secret, message_text.clone(), gateway_url);
    env.stop_live();

    let response = match response {
        Ok(response) => response,
        Err(e) => panic!("Failed to post a message to webhook: {e}"),
    };

    let send_message_v2::Response::Success(_) = response else {
        panic!("Expected a success response, but got: {response:?}");
    };

    // Check the message was received
    let events_response = match chat {
        Chat::Group(group_id) => {
            client::group::happy_path::events(env, &owner, group_id, EventIndex::default(), true, 100, 100)
        }
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::events(env, &owner, community_id, channel_id, EventIndex::default(), true, 100, 100)
        }
        _ => unreachable!(),
    };

    let latest_event = &events_response.events.last().unwrap().event;

    let ChatEvent::Message(message) = latest_event else {
        panic!("Expected a message event, but got: {latest_event:?}");
    };

    assert!(matches!(message.content, MessageContent::Text(_)));
    assert!(matches!(message.sender_context, Some(SenderContext::Webhook)));

    let MessageContent::Text(content) = &message.content else {
        panic!("Expected a text message, but got: {:?}", message.content);
    };

    assert_eq!(content.text, message_text);
}

fn post_message_to_webhook(
    chat: Chat,
    webhook_id: UserId,
    webhook_secret: String,
    message: String,
    gateway_url: Url,
) -> Result<send_message_v2::Response, String> {
    let port = gateway_url.port_or_known_default().ok_or("Unknown port")?;

    // Build the webhook URL
    let (domain, url) = match chat {
        Chat::Group(group_id) => {
            let domain = format!("{group_id}.localhost");
            let url = format!(
                "http://{}:{}/webhook/{}/{}",
                domain,
                port,
                webhook_id.to_text(),
                webhook_secret
            );
            (domain, url)
        }
        Chat::Channel(community_id, channel_id) => {
            let domain = format!("{community_id}.localhost");
            let url = format!(
                "http://{}:{}/channel/{}/webhook/{}/{}",
                domain,
                port,
                channel_id,
                webhook_id.to_text(),
                webhook_secret
            );
            (domain, url)
        }
        _ => unreachable!(),
    };

    let client = reqwest::blocking::Client::builder()
        .resolve(&domain, SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), port))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(url)
        .header("Content-Type", "text/plain")
        .body(message)
        .send()
        .map_err(|e| e.to_string())?;

    if response.status() != 200 {
        return Err(format!(
            "Failed to send message to webhook: {}: {:?}",
            response.status(),
            response.text()
        ));
    }

    response.json::<send_message_v2::Response>().map_err(|e| e.to_string())
}
