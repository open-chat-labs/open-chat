dfx canister --ic call 2jvtu-yqaaa-aaaaq-aaama-cai manage_neuron '(
    record {
        subaccount = blob "\af\db\b4\63\96\37\4a\f0\ba\ad\27\0f\06\e7\38\fb\f6\09\97\35\9e\3f\1b\be\a2\29\33\12\e3\27\8a\ef";
        command = opt variant {
            MakeProposal = record {
                url = "https://forum.dfinity.org/t/sns-topics-plan";
                title = "Set topics for custom SNS proposals";
                action = opt variant {
                    SetTopicsForCustomProposals = record {
                        custom_function_id_to_topic = vec {
                            record {
                                1000 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                1001 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                1002 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                1003 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                1004 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                1008 : nat64;
                                variant { Governance };
                            };
                            record {
                                1009 : nat64;
                                variant { Governance };
                            };
                            record {
                                1010 : nat64;
                                variant { Governance };
                            };
                            record {
                                1011 : nat64;
                                variant { Governance };
                            };
                            record {
                                1012 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                1014 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                1015 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                2000 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2001 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2002 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2003 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2004 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2005 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                2006 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                2007 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                2008 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                2009 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                3000 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                3001 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                4002 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                4003 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                5001 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                5002 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                5003 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                6000 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                6001 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                7000 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                7001 : nat64;
                                variant { ApplicationBusinessLogic };
                            };
                            record {
                                7002 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                8000 : nat64;
                                variant { TreasuryAssetManagement };
                            };
                            record {
                                8001 : nat64;
                                variant { TreasuryAssetManagement };
                            };
                            record {
                                9000 : nat64;
                                variant { DappCanisterManagement };
                            };
                            record {
                                102000 : nat64;
                                variant { TreasuryAssetManagement };
                            };
                        };
                    }
                };
                summary = "Assign topics to all existing OpenChat custom SNS proposal types";
            }
        };
    },
)'
