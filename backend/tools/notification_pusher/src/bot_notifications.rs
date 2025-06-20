use crate::BotNotification;
use crate::bot_notifications::pusher::Pusher;
use async_channel::Sender;

mod pusher;

pub fn start_bot_notifications_processor(is_localhost: bool) -> Sender<BotNotification> {
    let (sender, receiver) = async_channel::bounded::<BotNotification>(200_000);

    let pusher = Pusher::new(receiver, is_localhost);
    tokio::spawn(pusher.run());

    sender
}
