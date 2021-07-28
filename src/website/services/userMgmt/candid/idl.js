export const idlFactory = ({ IDL }) => {
  const UserId = IDL.Principal;
  const MyProfile = IDL.Record({
    'id' : UserId,
    'username' : IDL.Text,
    'version' : IDL.Nat32,
    'image_id' : IDL.Opt(IDL.Text),
    'account_balance' : IDL.Nat,
  });
  const GetCurrentUserResponse = IDL.Variant({
    'Success' : MyProfile,
    'UserNotFound' : IDL.Null,
  });
  const GetUserIdResponse = IDL.Variant({
    'Success' : UserId,
    'UserNotFound' : IDL.Null,
  });
  const Timestamp = IDL.Nat64;
  const GetUsersRequest = IDL.Record({
    'users' : IDL.Vec(UserId),
    'updated_since' : IDL.Opt(Timestamp),
  });
  const ChatId = IDL.Nat;
  const UserSummary = IDL.Record({
    'id' : UserId,
    'username' : IDL.Text,
    'version' : IDL.Nat32,
    'image_id' : IDL.Opt(IDL.Text),
    'seconds_since_last_online' : IDL.Nat32,
    'chat_id' : ChatId,
  });
  const GetUsersResponse = IDL.Variant({
    'Success' : IDL.Record({
      'timestamp' : Timestamp,
      'users' : IDL.Vec(UserSummary),
    }),
  });
  const RegisterUserResponse = IDL.Variant({
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UserLimitReached' : IDL.Nat64,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : MyProfile,
    'UserExists' : IDL.Null,
  });
  const SearchUsersRequest = IDL.Record({
    'max_results' : IDL.Nat8,
    'search_term' : IDL.Text,
  });
  const SearchUsersResponse = IDL.Variant({
    'Success' : IDL.Record({ 'users' : IDL.Vec(UserSummary) }),
  });
  const SetProfileImageResponse = IDL.Variant({
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  const Stats = IDL.Record({
    'user_count' : IDL.Nat64,
    'cycles_balance' : IDL.Int64,
    'memory_used' : IDL.Nat64,
    'user_id' : UserId,
    'timestamp' : IDL.Nat64,
  });
  const TransferCyclesRequest = IDL.Record({
    'recipient' : UserId,
    'sender' : UserId,
    'amount' : IDL.Nat,
  });
  const TransferCyclesResponse = IDL.Variant({
    'BalanceExceeded' : IDL.Null,
    'Success' : IDL.Record({ 'new_balance' : IDL.Nat }),
    'UserNotFound' : IDL.Null,
    'RecipientNotFound' : IDL.Null,
  });
  const UpdateUsernameResponse = IDL.Variant({
    'SuccessNoChange' : IDL.Null,
    'UsernameTaken' : IDL.Null,
    'UsernameTooShort' : IDL.Nat16,
    'UsernameTooLong' : IDL.Nat16,
    'Success' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'get_current_user' : IDL.Func([], [GetCurrentUserResponse], ['query']),
    'get_user_id' : IDL.Func([IDL.Text], [GetUserIdResponse], ['query']),
    'get_users' : IDL.Func([GetUsersRequest], [GetUsersResponse], ['query']),
    'mark_as_online' : IDL.Func([], [], []),
    'register_user' : IDL.Func([IDL.Text], [RegisterUserResponse], []),
    'search_users' : IDL.Func(
        [SearchUsersRequest],
        [SearchUsersResponse],
        ['query'],
      ),
    'set_profile_image' : IDL.Func([IDL.Text], [SetProfileImageResponse], []),
    'stats' : IDL.Func([], [Stats], ['query']),
    'transfer_cycles' : IDL.Func(
        [TransferCyclesRequest],
        [TransferCyclesResponse],
        [],
      ),
    'update_username' : IDL.Func([IDL.Text], [UpdateUsernameResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };