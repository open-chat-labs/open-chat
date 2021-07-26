export default ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const BlobReference = IDL.Record({
    'blob_size' : IDL.Nat32,
    'blob_id' : IDL.Text,
    'canister_id' : CanisterId,
    'chunk_size' : IDL.Nat32,
  });
  const FileContent = IDL.Record({
    'name' : IDL.Text,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'caption' : IDL.Opt(IDL.Text),
  });
  const TextContent = IDL.Record({ 'text' : IDL.Text });
  const MediaContent = IDL.Record({
    'height' : IDL.Nat32,
    'mime_type' : IDL.Text,
    'blob_reference' : IDL.Opt(BlobReference),
    'thumbnail_data' : IDL.Text,
    'caption' : IDL.Opt(IDL.Text),
    'width' : IDL.Nat32,
  });
  const CyclesContent = IDL.Record({
    'caption' : IDL.Opt(IDL.Text),
    'amount' : IDL.Nat,
  });
  const MessageContent = IDL.Variant({
    'File' : FileContent,
    'Text' : TextContent,
    'Media' : MediaContent,
    'Cycles' : CyclesContent,
  });
  const UserId = CanisterId;
  const MessageIndex = IDL.Nat32;
  const PushDirectMessageNotificationArgs = IDL.Record({
    'content' : MessageContent,
    'recipient' : UserId,
    'sender' : UserId,
    'message_index' : MessageIndex,
  });
  const PushDirectMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const GroupId = CanisterId;
  const PushGroupMessageNotificationArgs = IDL.Record({
    'content' : MessageContent,
    'sender' : UserId,
    'recipients' : IDL.Vec(UserId),
    'chat_id' : GroupId,
    'message_index' : MessageIndex,
  });
  const PushGroupMessageNotificationResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  const PushSubscriptionArgs = IDL.Record({
    'subscription' : IDL.Text,
    'user_id' : UserId,
  });
  const PushSubscriptionResponse = IDL.Variant({ 'Success' : IDL.Null });
  return IDL.Service({
    'push_direct_message_notification' : IDL.Func(
        [PushDirectMessageNotificationArgs],
        [PushDirectMessageNotificationResponse],
        [],
      ),
    'push_group_message_notification' : IDL.Func(
        [PushGroupMessageNotificationArgs],
        [PushGroupMessageNotificationResponse],
        [],
      ),
    'push_subscription' : IDL.Func(
        [PushSubscriptionArgs],
        [PushSubscriptionResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
