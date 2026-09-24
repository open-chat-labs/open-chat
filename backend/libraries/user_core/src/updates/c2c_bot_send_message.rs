use crate::User;
use chat_events::{
    EditMessageArgs, EditMessageSuccess, EventPusher, MessageContentInternal, PushMessageArgs, TextContentInternal,
    ValidateNewMessageContentResult,
};
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{
    BlobReference, BotCaller, BotMessageContext, BotPermissions, DirectChatUserNotificationPayload, DirectMessageNotification,
    EventIndex, EventWrapper, Message, MessageContent, MessageId, MessageIndex, OCResult, OgPreview, SenderContext,
    TimestampMillis, UserId, UserType,
};
use user_canister::c2c_bot_send_message::Args;
use user_canister::send_message_v2::{self, SuccessResult};
use utils::migrated_user_ids::MigratedUserIds;

// A message from a bot to the user, checked and validated
pub struct BotMessage {
    bot_caller: BotCaller,
    bot_name: String,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    user_message_id: Option<MessageId>,
    content: MessageContentInternal,
    // The content as the notification of an edit to the message shows it
    notification_content: MessageContent,
    block_level_markdown: bool,
    og_previews: Vec<OgPreview>,
    finalised: bool,
}

// Checks the bot has been granted permission to send the message, and the user can receive it
pub fn prepare(user: &User, args: Args, now: TimestampMillis) -> OCResult<BotMessage> {
    let bot_caller = BotCaller {
        bot: args.bot_id,
        initiator: args.initiator.clone(),
    };
    let bot_name = args.bot_name.clone();
    let user_message_id = args.user_message_id;
    let finalised = args.finalised;
    let args: send_message_v2::Args = args.into();

    if !user.is_bot_permitted(
        &bot_caller.bot,
        &bot_caller.initiator,
        BotPermissions::from_message_permission((&args.content).into()),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    user.verify_not_suspended()?;

    if user.blocked_users.contains(&args.recipient) {
        return Err(OCErrorCode::TargetUserBlocked.into());
    }

    if args.recipient == OPENCHAT_BOT_USER_ID {
        return Err(OCErrorCode::InvalidRequest.with_message("Messaging the OpenChat Bot is not currently supported"));
    }

    // A bot's message which isn't yet finalised can be sent again, to edit it
    if user.direct_chats.get(&args.recipient.into()).is_some_and(|chat| {
        chat.events()
            .message_already_finalised(args.thread_root_message_index, args.message_id, true)
    }) {
        return Err(OCErrorCode::MessageIdAlreadyExists.into());
    }

    let notification_content = args.content.clone().into();
    let content = match MessageContentInternal::validate_new_message(args.content, true, UserType::BotV2, args.forwarding, now)
    {
        ValidateNewMessageContentResult::Success(content) => content,
        ValidateNewMessageContentResult::SuccessP2PSwap(_)
        | ValidateNewMessageContentResult::SuccessCrypto(_)
        | ValidateNewMessageContentResult::SuccessPrize(_) => unreachable!(),
        ValidateNewMessageContentResult::Error(error) => {
            return Err(OCErrorCode::InvalidMessageContent.with_json(&error));
        }
    };

    Ok(BotMessage {
        bot_caller,
        bot_name,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        user_message_id,
        content,
        notification_content,
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews,
        finalised,
    })
}

// The bot's message, as sent to the user
pub struct Sent {
    pub result: SuccessResult,
    pub notification: Option<DirectChatUserNotificationPayload>,
    // The message pushed, with the files it references, unless it was an edit of the bot's
    // unfinalised message. The caller handles the message's expiry.
    pub new_message: Option<(EventWrapper<Message>, Vec<BlobReference>)>,
}

// Sends the bot's message to the user's chat with the bot, creating the chat if they have none. A
// message with the id of the bot's unfinalised message, from the same command, edits that message
// instead. There is only a notification once the message is finalised, and none if the user has
// muted the chat.
pub fn send<P: EventPusher>(
    user: &mut User,
    my_user_id: UserId,
    message: BotMessage,
    anonymized_chat_id: impl FnOnce() -> u128,
    event_pusher: Option<P>,
    now: TimestampMillis,
) -> OCResult<Sent> {
    let bot_id = message.bot_caller.bot;
    let chat_id = bot_id.into();

    if let Some(chat) = user.direct_chats.get_mut(&chat_id)
        && let Some((existing, _)) = chat.message_internal(message.thread_root_message_index, message.message_id.into())
    {
        let bot_caller = &message.bot_caller;
        let Some(bot_message) = existing.bot_context().filter(|bot_message| {
            bot_caller.bot == existing.sender
                && bot_caller.initiator.user() == bot_message.command.as_ref().map(|c| c.initiator)
                && bot_caller.initiator.command() == bot_message.command.as_ref()
        }) else {
            return Err(OCErrorCode::MessageAlreadyFinalized.into());
        };
        if bot_message.finalised {
            return Err(OCErrorCode::MessageAlreadyFinalized.into());
        }

        let EditMessageSuccess {
            message_index, event, ..
        } = chat
            // Bots are never migrated to a MultiUser canister, so have no earlier ids
            .edit_message::<P>(
                EditMessageArgs {
                    sender: bot_id,
                    min_visible_event_index: EventIndex::default(),
                    thread_root_message_index: message.thread_root_message_index,
                    message_id: message.message_id,
                    content: message.content,
                    block_level_markdown: Some(message.block_level_markdown),
                    og_previews: message.og_previews,
                    finalise_bot_message: message.finalised,
                    now,
                },
                &MigratedUserIds::default(),
                None,
            )
            // Shouldn't happen
            .map_err(|_| OCErrorCode::InitiatorNotAuthorized)?;

        let notification = (message.finalised && !chat.notifications_muted.value).then(|| {
            notification(
                bot_id,
                message.bot_name,
                message.thread_root_message_index,
                message_index,
                event.index,
                &message.notification_content,
            )
        });

        return Ok(Sent {
            result: SuccessResult {
                chat_id,
                event_index: event.index,
                message_index,
                expires_at: event.expires_at,
                timestamp: now,
            },
            notification,
            new_message: None,
        });
    }

    let chat = user
        .direct_chats
        .get_or_create(my_user_id, bot_id, UserType::BotV2, anonymized_chat_id, now);

    // If the user is sending a direct message to the bot, the user's message is posted before the
    // bot's reply, so that they can converse with the bot naturally rather than via a command
    let mut user_message = false;
    if let Some(command) = message.bot_caller.initiator.command()
        && let (Some(text), Some(message_id)) = (
            command.args.first().and_then(|a| a.value.as_string().map(String::from)),
            message.user_message_id,
        )
    {
        chat.push_message::<P>(
            PushMessageArgs {
                thread_root_message_index: message.thread_root_message_index,
                message_id,
                sender: my_user_id,
                content: MessageContentInternal::Text(TextContentInternal { text }),
                mentioned: Vec::new(),
                replies_to: None,
                forwarded: false,
                sender_is_bot: false,
                block_level_markdown: message.block_level_markdown,
                og_previews: Vec::new(),
                now,
                sender_context: None,
            },
            None,
            None,
        );
        user_message = true;
    }

    let files = message.content.blob_references();
    let message_event = chat.push_message(
        PushMessageArgs {
            thread_root_message_index: None,
            message_id: message.message_id,
            sender: bot_id,
            content: message.content,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: true,
            block_level_markdown: message.block_level_markdown,
            og_previews: message.og_previews,
            now,
            // The bot's reply to the user's message reads as an ordinary message
            sender_context: (!user_message)
                .then(|| SenderContext::Bot(BotMessageContext::from(&message.bot_caller, message.finalised))),
        },
        None,
        event_pusher,
    );

    let notification = (message.finalised && !chat.notifications_muted.value).then(|| {
        notification(
            bot_id,
            message.bot_name,
            None,
            message_event.event.message_index,
            message_event.index,
            &message_event.event.content,
        )
    });

    Ok(Sent {
        result: SuccessResult {
            chat_id,
            event_index: message_event.index,
            message_index: message_event.event.message_index,
            expires_at: message_event.expires_at,
            timestamp: now,
        },
        notification,
        new_message: Some((message_event, files)),
    })
}

fn notification(
    bot_id: UserId,
    bot_name: String,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    event_index: EventIndex,
    content: &MessageContent,
) -> DirectChatUserNotificationPayload {
    DirectChatUserNotificationPayload::DirectMessage(DirectMessageNotification {
        sender: bot_id,
        thread_root_message_index,
        message_index,
        event_index,
        sender_name: bot_name,
        sender_display_name: None,
        message_type: content.content_type().to_string(),
        message_text: content.notification_text(&[], &[]),
        image_url: content.notification_image_url(),
        file_name: content.notification_file_name(),
        sender_avatar_id: None,
        crypto_transfer: content.notification_crypto_transfer_details(&[]),
        call: None,
    })
}
