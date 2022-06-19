import { IDL } from "@dfinity/candid"

export const Notification = IDL.Variant({
  'DirectMessageNotification' : IDL.Record({
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'Giphy' : IDL.Record({
            'title' : IDL.Text,
            'desktop' : IDL.Record({
              'url' : IDL.Text,
              'height' : IDL.Nat32,
              'mime_type' : IDL.Text,
              'width' : IDL.Nat32,
            }),
            'caption' : IDL.Opt(IDL.Text),
            'mobile' : IDL.Record({
              'url' : IDL.Text,
              'height' : IDL.Nat32,
              'mime_type' : IDL.Text,
              'width' : IDL.Nat32,
            }),
          }),
          'File' : IDL.Record({
            'name' : IDL.Text,
            'mime_type' : IDL.Text,
            'file_size' : IDL.Nat32,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Poll' : IDL.Record({
            'votes' : IDL.Record({
              'total' : IDL.Variant({
                'Anonymous' : IDL.Vec(IDL.Tuple(IDL.Nat32, IDL.Nat32)),
                'Visible' : IDL.Vec(
                  IDL.Tuple(IDL.Nat32, IDL.Vec(IDL.Principal))
                ),
                'Hidden' : IDL.Nat32,
              }),
              'user' : IDL.Vec(IDL.Nat32),
            }),
            'ended' : IDL.Bool,
            'config' : IDL.Record({
              'allow_multiple_votes_per_user' : IDL.Bool,
              'text' : IDL.Opt(IDL.Text),
              'show_votes_before_end_date' : IDL.Bool,
              'end_date' : IDL.Opt(IDL.Nat64),
              'anonymous' : IDL.Bool,
              'options' : IDL.Vec(IDL.Text),
            }),
          }),
          'Text' : IDL.Record({ 'text' : IDL.Text }),
          'Image' : IDL.Record({
            'height' : IDL.Nat32,
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'thumbnail_data' : IDL.Text,
            'caption' : IDL.Opt(IDL.Text),
            'width' : IDL.Nat32,
          }),
          'Cryptocurrency' : IDL.Record({
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Record({
                'to' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'from' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'error_message' : IDL.Text,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'Completed' : IDL.Record({
                'to' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'Pending' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'User' : IDL.Principal,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'memo' : IDL.Opt(IDL.Nat64),
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
            }),
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Video' : IDL.Record({
            'height' : IDL.Nat32,
            'image_blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'video_blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'mime_type' : IDL.Text,
            'thumbnail_data' : IDL.Text,
            'caption' : IDL.Opt(IDL.Text),
            'width' : IDL.Nat32,
          }),
          'Deleted' : IDL.Record({
            'timestamp' : IDL.Nat64,
            'deleted_by' : IDL.Principal,
          }),
        }),
        'edited' : IDL.Bool,
        'sender' : IDL.Principal,
        'thread_summary' : IDL.Opt(
          IDL.Record({
            'latest_event_timestamp' : IDL.Nat64,
            'participant_ids' : IDL.Vec(IDL.Principal),
            'reply_count' : IDL.Nat32,
            'latest_event_index' : IDL.Nat32,
          })
        ),
        'message_id' : IDL.Nat,
        'replies_to' : IDL.Opt(
          IDL.Record({
            'chat_id_if_other' : IDL.Opt(IDL.Principal),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
    }),
    'sender_name' : IDL.Text,
  }),
  'GroupMessageNotification' : IDL.Record({
    'hide' : IDL.Bool,
    'mentioned' : IDL.Vec(
      IDL.Record({ 'username' : IDL.Text, 'user_id' : IDL.Principal })
    ),
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'Giphy' : IDL.Record({
            'title' : IDL.Text,
            'desktop' : IDL.Record({
              'url' : IDL.Text,
              'height' : IDL.Nat32,
              'mime_type' : IDL.Text,
              'width' : IDL.Nat32,
            }),
            'caption' : IDL.Opt(IDL.Text),
            'mobile' : IDL.Record({
              'url' : IDL.Text,
              'height' : IDL.Nat32,
              'mime_type' : IDL.Text,
              'width' : IDL.Nat32,
            }),
          }),
          'File' : IDL.Record({
            'name' : IDL.Text,
            'mime_type' : IDL.Text,
            'file_size' : IDL.Nat32,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Poll' : IDL.Record({
            'votes' : IDL.Record({
              'total' : IDL.Variant({
                'Anonymous' : IDL.Vec(IDL.Tuple(IDL.Nat32, IDL.Nat32)),
                'Visible' : IDL.Vec(
                  IDL.Tuple(IDL.Nat32, IDL.Vec(IDL.Principal))
                ),
                'Hidden' : IDL.Nat32,
              }),
              'user' : IDL.Vec(IDL.Nat32),
            }),
            'ended' : IDL.Bool,
            'config' : IDL.Record({
              'allow_multiple_votes_per_user' : IDL.Bool,
              'text' : IDL.Opt(IDL.Text),
              'show_votes_before_end_date' : IDL.Bool,
              'end_date' : IDL.Opt(IDL.Nat64),
              'anonymous' : IDL.Bool,
              'options' : IDL.Vec(IDL.Text),
            }),
          }),
          'Text' : IDL.Record({ 'text' : IDL.Text }),
          'Image' : IDL.Record({
            'height' : IDL.Nat32,
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'thumbnail_data' : IDL.Text,
            'caption' : IDL.Opt(IDL.Text),
            'width' : IDL.Nat32,
          }),
          'Cryptocurrency' : IDL.Record({
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Record({
                'to' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'from' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'error_message' : IDL.Text,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'Completed' : IDL.Record({
                'to' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'UserIndex' : IDL.Vec(IDL.Nat8),
                  'Named' : IDL.Tuple(IDL.Text, IDL.Vec(IDL.Nat8)),
                  'Mint' : IDL.Null,
                  'User' : IDL.Tuple(IDL.Principal, IDL.Vec(IDL.Nat8)),
                  'Unknown' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'Pending' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'User' : IDL.Principal,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                'token' : IDL.Variant({ 'InternetComputer' : IDL.Null }),
                'memo' : IDL.Opt(IDL.Nat64),
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
            }),
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Video' : IDL.Record({
            'height' : IDL.Nat32,
            'image_blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'video_blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'mime_type' : IDL.Text,
            'thumbnail_data' : IDL.Text,
            'caption' : IDL.Opt(IDL.Text),
            'width' : IDL.Nat32,
          }),
          'Deleted' : IDL.Record({
            'timestamp' : IDL.Nat64,
            'deleted_by' : IDL.Principal,
          }),
        }),
        'edited' : IDL.Bool,
        'sender' : IDL.Principal,
        'thread_summary' : IDL.Opt(
          IDL.Record({
            'latest_event_timestamp' : IDL.Nat64,
            'participant_ids' : IDL.Vec(IDL.Principal),
            'reply_count' : IDL.Nat32,
            'latest_event_index' : IDL.Nat32,
          })
        ),
        'message_id' : IDL.Nat,
        'replies_to' : IDL.Opt(
          IDL.Record({
            'chat_id_if_other' : IDL.Opt(IDL.Principal),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
    }),
    'sender_name' : IDL.Text,
    'chat_id' : IDL.Principal,
    'group_name' : IDL.Text,
  }),
  'AddedToGroupNotification' : IDL.Record({
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'chat_id' : IDL.Principal,
    'group_name' : IDL.Text,
  }),
});

