export default ({ IDL }) => {
  const PendingSmsMessagesArgs = IDL.Record({
    'max_results' : IDL.Nat64,
    'from_index' : IDL.Nat64,
  });
  const SmsNotification = IDL.Record({
    'message' : IDL.Text,
    'phone_number' : IDL.Text,
  });
  const PendingSmsMessagesResponse = IDL.Variant({
    'Success' : IDL.Record({
      'notifications' : IDL.Vec(SmsNotification),
      'latest_index' : IDL.Nat64,
    }),
  });
  return IDL.Service({
    'pending_sms_messages' : IDL.Func(
        [PendingSmsMessagesArgs],
        [PendingSmsMessagesResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
