import { IDL } from "@dfinity/candid"

export const Notification = IDL.Variant({
  'DirectReactionAddedNotification' : IDL.Record({
    'username' : IDL.Text,
    'them' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'timestamp' : IDL.Nat64,
    'reaction' : IDL.Text,
  }),
  'DirectMessageNotification' : IDL.Record({
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'sender_name' : IDL.Text,
    'thread_root_message_index' : IDL.Opt(IDL.Nat32),
  }),
  'AddedToChannelNotification' : IDL.Record({
    'channel_id' : IDL.Nat,
    'community_id' : IDL.Principal,
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'channel_name' : IDL.Text,
    'community_name' : IDL.Text,
    'timestamp' : IDL.Nat64,
  }),
  'GroupMessageNotification' : IDL.Record({
    'mentioned' : IDL.Vec(
      IDL.Record({ 'username' : IDL.Text, 'user_id' : IDL.Principal })
    ),
    'sender' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'sender_name' : IDL.Text,
    'chat_id' : IDL.Principal,
    'thread_root_message_index' : IDL.Opt(IDL.Nat32),
    'group_name' : IDL.Text,
  }),
  'ChannelMessageNotification' : IDL.Record({
    'channel_id' : IDL.Nat,
    'community_id' : IDL.Principal,
    'mentioned' : IDL.Vec(
      IDL.Record({ 'username' : IDL.Text, 'user_id' : IDL.Principal })
    ),
    'sender' : IDL.Principal,
    'channel_name' : IDL.Text,
    'community_name' : IDL.Text,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'sender_name' : IDL.Text,
    'thread_root_message_index' : IDL.Opt(IDL.Nat32),
  }),
  'ChannelReactionAddedNotification' : IDL.Record({
    'channel_id' : IDL.Nat,
    'community_id' : IDL.Principal,
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'channel_name' : IDL.Text,
    'community_name' : IDL.Text,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'timestamp' : IDL.Nat64,
    'thread_root_message_index' : IDL.Opt(IDL.Nat32),
    'reaction' : IDL.Text,
  }),
  'GroupReactionAddedNotification' : IDL.Record({
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'message' : IDL.Record({
      'event' : IDL.Record({
        'forwarded' : IDL.Bool,
        'content' : IDL.Variant({
          'ReportedMessage' : IDL.Record({
            'count' : IDL.Nat32,
            'reports' : IDL.Vec(
              IDL.Record({
                'notes' : IDL.Opt(IDL.Text),
                'timestamp' : IDL.Nat64,
                'reported_by' : IDL.Principal,
                'reason_code' : IDL.Nat32,
              })
            ),
          }),
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
          'Prize' : IDL.Record({
            'token' : IDL.Variant({
              'InternetComputer' : IDL.Null,
              'CHAT' : IDL.Null,
              'SNS1' : IDL.Null,
              'KINIC' : IDL.Null,
              'CKBTC' : IDL.Null,
            }),
            'end_date' : IDL.Nat64,
            'prizes_remaining' : IDL.Nat32,
            'prizes_pending' : IDL.Nat32,
            'caption' : IDL.Opt(IDL.Text),
            'winners' : IDL.Vec(IDL.Principal),
          }),
          'Custom' : IDL.Record({
            'data' : IDL.Vec(IDL.Nat8),
            'kind' : IDL.Text,
          }),
          'GovernanceProposal' : IDL.Record({
            'my_vote' : IDL.Opt(IDL.Bool),
            'governance_canister_id' : IDL.Principal,
            'proposal' : IDL.Variant({
              'NNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'topic' : IDL.Int32,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Nat64,
              }),
              'SNS' : IDL.Record({
                'id' : IDL.Nat64,
                'url' : IDL.Text,
                'status' : IDL.Variant({
                  'Failed' : IDL.Null,
                  'Open' : IDL.Null,
                  'Rejected' : IDL.Null,
                  'Executed' : IDL.Null,
                  'Adopted' : IDL.Null,
                  'Unspecified' : IDL.Null,
                }),
                'payload_text_rendering' : IDL.Opt(IDL.Text),
                'tally' : IDL.Record({
                  'no' : IDL.Nat64,
                  'yes' : IDL.Nat64,
                  'total' : IDL.Nat64,
                  'timestamp' : IDL.Nat64,
                }),
                'title' : IDL.Text,
                'created' : IDL.Nat64,
                'action' : IDL.Nat64,
                'last_updated' : IDL.Nat64,
                'deadline' : IDL.Nat64,
                'reward_status' : IDL.Variant({
                  'ReadyToSettle' : IDL.Null,
                  'AcceptVotes' : IDL.Null,
                  'Unspecified' : IDL.Null,
                  'Settled' : IDL.Null,
                }),
                'summary' : IDL.Text,
                'proposer' : IDL.Vec(IDL.Nat8),
              }),
            }),
          }),
          'PrizeWinner' : IDL.Record({
            'transaction' : IDL.Variant({
              'NNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Vec(IDL.Nat8),
                }),
                'memo' : IDL.Nat64,
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'SNS' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'transaction_hash' : IDL.Vec(IDL.Nat8),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Nat64),
                'ledger' : IDL.Principal,
                'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
              }),
              'ICRC1' : IDL.Record({
                'to' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'fee' : IDL.Nat,
                'created' : IDL.Nat64,
                'token' : IDL.Variant({
                  'InternetComputer' : IDL.Null,
                  'CHAT' : IDL.Null,
                  'SNS1' : IDL.Null,
                  'KINIC' : IDL.Null,
                  'CKBTC' : IDL.Null,
                }),
                'block_index' : IDL.Nat64,
                'from' : IDL.Variant({
                  'Mint' : IDL.Null,
                  'Account' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                }),
                'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                'ledger' : IDL.Principal,
                'amount' : IDL.Nat,
              }),
            }),
            'winner' : IDL.Principal,
            'prize_message' : IDL.Nat32,
          }),
          'Audio' : IDL.Record({
            'mime_type' : IDL.Text,
            'blob_reference' : IDL.Opt(
              IDL.Record({ 'blob_id' : IDL.Nat, 'canister_id' : IDL.Principal })
            ),
            'caption' : IDL.Opt(IDL.Text),
          }),
          'Crypto' : IDL.Record({
            'recipient' : IDL.Principal,
            'caption' : IDL.Opt(IDL.Text),
            'transfer' : IDL.Variant({
              'Failed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'error_message' : IDL.Text,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Completed' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'memo' : IDL.Nat64,
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'transaction_hash' : IDL.Vec(IDL.Nat8),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'block_index' : IDL.Nat64,
                  'from' : IDL.Variant({
                    'Mint' : IDL.Null,
                    'Account' : IDL.Record({
                      'owner' : IDL.Principal,
                      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                    }),
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                }),
              }),
              'Pending' : IDL.Variant({
                'NNS' : IDL.Record({
                  'to' : IDL.Variant({
                    'User' : IDL.Principal,
                    'Account' : IDL.Vec(IDL.Nat8),
                  }),
                  'fee' : IDL.Opt(IDL.Record({ 'e8s' : IDL.Nat64 })),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'SNS' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Nat64),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Record({ 'e8s' : IDL.Nat64 }),
                  'symbol' : IDL.Text,
                }),
                'ICRC1' : IDL.Record({
                  'to' : IDL.Record({
                    'owner' : IDL.Principal,
                    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  }),
                  'fee' : IDL.Nat,
                  'created' : IDL.Nat64,
                  'token' : IDL.Variant({
                    'InternetComputer' : IDL.Null,
                    'CHAT' : IDL.Null,
                    'SNS1' : IDL.Null,
                    'KINIC' : IDL.Null,
                    'CKBTC' : IDL.Null,
                  }),
                  'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
                  'ledger' : IDL.Principal,
                  'amount' : IDL.Nat,
                  'symbol' : IDL.Text,
                }),
              }),
            }),
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
          'MessageReminderCreated' : IDL.Record({
            'hidden' : IDL.Bool,
            'notes' : IDL.Opt(IDL.Text),
            'remind_at' : IDL.Nat64,
            'reminder_id' : IDL.Nat64,
          }),
          'MessageReminder' : IDL.Record({
            'notes' : IDL.Opt(IDL.Text),
            'reminder_id' : IDL.Nat64,
          }),
        }),
        'edited' : IDL.Bool,
        'last_updated' : IDL.Opt(IDL.Nat64),
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
            'chat_if_other' : IDL.Opt(
              IDL.Tuple(
                IDL.Variant({
                  'Group' : IDL.Principal,
                  'Channel' : IDL.Tuple(IDL.Principal, IDL.Nat),
                  'Direct' : IDL.Principal,
                }),
                IDL.Opt(IDL.Nat32),
              )
            ),
            'event_index' : IDL.Nat32,
          })
        ),
        'reactions' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Vec(IDL.Principal))),
        'message_index' : IDL.Nat32,
      }),
      'timestamp' : IDL.Nat64,
      'index' : IDL.Nat32,
      'correlation_id' : IDL.Nat64,
      'expires_at' : IDL.Opt(IDL.Nat64),
    }),
    'timestamp' : IDL.Nat64,
    'chat_id' : IDL.Principal,
    'thread_root_message_index' : IDL.Opt(IDL.Nat32),
    'group_name' : IDL.Text,
    'reaction' : IDL.Text,
  }),
  'AddedToGroupNotification' : IDL.Record({
    'added_by_name' : IDL.Text,
    'added_by' : IDL.Principal,
    'timestamp' : IDL.Nat64,
    'chat_id' : IDL.Principal,
    'group_name' : IDL.Text,
  }),
});

