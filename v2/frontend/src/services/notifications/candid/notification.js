import { IDL } from "@dfinity/candid"

export const Notification = IDL.Variant({
  'DirectMessageNotification' : IDL.Record({
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'content' : IDL.Variant({
          'File' : IDL.Record({
            'name' : IDL.Text,
            'mime_type' : IDL.Text,
            'file_size' : IDL.Nat32,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
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
              'ICP' : IDL.Variant({
                'Failed' : IDL.Record({
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'recipient' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'Completed' : IDL.Record({
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'block_index' : IDL.Nat64,
                  'memo' : IDL.Nat64,
                  'recipient' : IDL.Principal,
                  'sender' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'Pending' : IDL.Record({
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'recipient' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
              }),
              'Cycles' : IDL.Variant({
                'Failed' : IDL.Record({
                  'error_message' : IDL.Text,
                  'recipient' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
                'Completed' : IDL.Record({
                  'recipient' : IDL.Principal,
                  'sender' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
                'Pending' : IDL.Record({
                  'recipient' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
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
    'mentioned' : IDL.Vec(
      IDL.Record({ 'username' : IDL.Text, 'user_id' : IDL.Principal })
    ),
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'content' : IDL.Variant({
          'File' : IDL.Record({
            'name' : IDL.Text,
            'mime_type' : IDL.Text,
            'file_size' : IDL.Nat32,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
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
              'ICP' : IDL.Variant({
                'Failed' : IDL.Record({
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'recipient' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'Completed' : IDL.Record({
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'block_index' : IDL.Nat64,
                  'memo' : IDL.Nat64,
                  'recipient' : IDL.Principal,
                  'sender' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'Pending' : IDL.Record({
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'recipient' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
              }),
              'Cycles' : IDL.Variant({
                'Failed' : IDL.Record({
                  'error_message' : IDL.Text,
                  'recipient' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
                'Completed' : IDL.Record({
                  'recipient' : IDL.Principal,
                  'sender' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
                'Pending' : IDL.Record({
                  'recipient' : IDL.Principal,
                  'cycles' : IDL.Nat,
                }),
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
    'hide' : IDL.Bool,
  }),
  'AddedToGroupNotification' : IDL.Record({
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'chat_id' : IDL.Principal,
    'group_name' : IDL.Text,
  }),
});

