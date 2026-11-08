import type { LearnDoc } from "@openchat/ui/src/pages/learnContent";

// The OpenChat Terms and Conditions, converted word for word from the old TermsContent.svelte. The one copy of
// the terms: the web's /terms shows it (MarketingScreen), and so do the old desktop page and sign-up
// (components/landingpages/TermsContent.svelte) and the old mobile tree's sign-up (components_mobile/TermsContent.svelte).
// A section's id is its old `?section=` id. A clause's number is written as the old page showed it.
export const terms: LearnDoc = {
    kicker: "Legal",
    title: "OpenChat Terms and Conditions",
    intro: [
        "IT IS IMPORTANT YOU READ THESE TERMS CAREFULLY BEFORE USING THE OPENCHAT PLATFORM OR OTHERWISE USING OUR SERVICES. BY USING THE OPENCHAT PLATFORM OR OTHERWISE USING OUR SERVICES, YOU INDICATE THAT YOU ACCEPT THESE TERMS AND AGREE TO COMPLY WITH THEM. IF YOU USE THE OPENCHAT PLATFORM OR OTHERWISE USE OUR SERVICES IN THE COURSE OF YOUR BUSINESS OR WORK, YOU ARE ALSO AGREEING TO THESE TERMS ON BEHALF OF THAT BUSINESS. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT USE THE OPENCHAT PLATFORM OR OTHERWISE USE OUR SERVICES.",
        "YOU SHOULD CAREFULLY CONSIDER WHETHER USING THE OPENCHAT PLATFORM OR OTHERWISE DEALING IN CRYPTOASSETS IS SUITABLE FOR YOU IN LIGHT OF YOUR OWN SITUATION AND ATTITUDE TO RISK, AS EVALUATED BY YOU CAREFULLY. WE DO NOT MAKE ANY REPRESENTATIONS OR RECOMMENDATIONS REGARDING THE ADVISABILITY OR OTHERWISE OF USING THE OPENCHAT PLATFORM OR OTHERWISE USING OUR SERVICES OR DEALING IN CRYPTOASSETS. IF YOU ARE UNSURE AS TO WHETHER USING THE OPENCHAT PLATFORM, USING OUR SERVICES OR OTHERWISE DEALING IN CRYPTOASSETS IS SUITABLE FOR YOU, YOU SHOULD SEEK INDEPENDENT PROFESSIONAL ADVICE PRIOR TO USING THE OPENCHAT PLATFORM, USING OUR SERVICES OR OTHERWISE DEALING IN CRYPTOASSETS. DEALING IN CRYPTOASSETS MAY NOT BE SUBJECT TO ANY INVESTOR PROTECTION, AND MAY INVOLVE A HIGH DEGREE OF RISK TO YOUR CAPITAL.",
    ],
    sections: [
        {
            id: "1",
            title: "Section A: General terms applicable to all services",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "A1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'We are OpenChat DAO. In these Terms, we refer to ourselves as "**OpenChat**", “**we**”, “**us**”, or “**our**”. We operate the OpenChat Platform which enables users of the OpenChat Platform (“**you**”, “**your**”) to access and benefit from our Services.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "These terms and conditions and each of the documents we refer to in them (all together, the “**Terms**”) form the relationship between us and you in relation to your use of the OpenChat Platform and our Services provided under these Terms (our “**Services**”). Our Terms apply when using specific Services as follows:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section A: General terms applicable to all Services",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section B: Additional terms for messaging on the OpenChat Platform",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section C: Additional terms for using the OpenChat Wallet",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section D: Additional terms applicable to Swaps",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section E: Additional terms for dealing in CHAT",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section F: Additional terms for Diamond Membership holders",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Section G: Participating in the OpenChat DAO",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.8)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Schedule 1: Risks relating to Cryptoassets",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.9)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Schedule 2: Content Standards",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.10)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Schedule 3: CHAT Features",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.11)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Schedule 4: Multiple accounts",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By using the OpenChat platform, you confirm that you accept these Terms and that you agree to comply with them. If you do not agree to these Terms, you must not use the OpenChat Platform or our Services.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.4)",
                                            title: "Interpretation",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In these Terms, the following words and expressions have the following meanings:",
                                                },
                                                {
                                                    kind: "definitions",
                                                    items: [
                                                        {
                                                            term: '"Applicable Law"',
                                                            meaning:
                                                                "all applicable statutes, laws, enactments, orders, regulations, regulatory rules, official guidance, standards, regulator expectations and other similar instruments in any relevant jurisdiction, as in force and amended from time to time;",
                                                        },
                                                        {
                                                            term: '"Channel"',
                                                            meaning:
                                                                "refers to chats within Communities, to make clear that they are part of a Community;",
                                                        },
                                                        {
                                                            term: '"CHAT"',
                                                            meaning:
                                                                "refers to the token used to facilitate the governance of OpenChat, with the features set out at Schedule 3;",
                                                        },
                                                        {
                                                            term: '"Community", "Communities"',
                                                            meaning:
                                                                "refers to a group of Channels users can communicate within. This is distinct from the concept of a Group, as in a Group involves users messaging within a single channel (and Communities and Groups are a distinct forms of communication within the OpenChat Platform);",
                                                        },
                                                        {
                                                            term: '"Content Standards"',
                                                            meaning:
                                                                "means the standards that apply to all Contributions, as set out at Schedule 2;",
                                                        },
                                                        {
                                                            term: '"Contribution"',
                                                            meaning:
                                                                "refers to any material which you contribute to the OpenChat Platform, including any communication you make via our Services;",
                                                        },
                                                        {
                                                            term: '"Cryptoassets"',
                                                            meaning:
                                                                "refers to CHAT as well as any and all other cryptoassets that are supported by the OpenChat Platform, a list of which are available in your OpenChat Wallet;",
                                                        },
                                                        {
                                                            term: '"Diamond Membership"',
                                                            meaning:
                                                                "refers to our subscription service that gives members access to exclusive benefits;",
                                                        },
                                                        {
                                                            term: '"Exchange Swap"',
                                                            meaning:
                                                                "has the meaning set out at clause D 1.2.1;",
                                                        },
                                                        {
                                                            term: '"Gated"',
                                                            meaning:
                                                                "refers to the restrictions or rules that the owner of a Group, Community, or Channel may impose on users' ability to access or use that Group, Community, or Channel;",
                                                        },
                                                        {
                                                            term: '"Governance Matters"',
                                                            meaning:
                                                                "refers to matters which relate to the operation or governance of the OpenChat DAO;",
                                                        },
                                                        {
                                                            term: '"Group"',
                                                            meaning:
                                                                "refers to a channel in which a group of users can communicate. This is distinct from the concept of a Community, as a Community involves users messaging within a set of channels (and Communities and Groups are a distinct forms of communication within the OpenChat Platform);",
                                                        },
                                                        {
                                                            term: '"Manifest Error"',
                                                            meaning:
                                                                "refers to the purported price of a Cryptoasset that differs so significantly from that reported by exchanges generally that it is clearly inaccurate due to, for example, a computer error;",
                                                        },
                                                        {
                                                            term: '"OpenChat Platform"',
                                                            meaning:
                                                                "refers to the platform we provide, available at [https://oc.app](https://oc.app/);",
                                                        },
                                                        {
                                                            term: '"OpenChat Wallet"',
                                                            meaning:
                                                                "refers to the digital wallet we provide, in which you can store your Cryptoassets;",
                                                        },
                                                        {
                                                            term: '"P2P Swap"',
                                                            meaning:
                                                                "has the meaning set out at clause D 1.2.2;",
                                                        },
                                                        {
                                                            term: '"Prize Messages"',
                                                            meaning:
                                                                "refers to messages containing Cryptoassets which are distributed to OpenChat users, who, upon receipt of the message, can potentially be gifted Cryptoassets;",
                                                        },
                                                        {
                                                            term: '"Source Cryptoasset"',
                                                            meaning:
                                                                "refers to the Cryptoasset you wish to exchange to obtain the Target Cryptoasset;",
                                                        },
                                                        {
                                                            term: '"Swap(s)"',
                                                            meaning:
                                                                "refers to either or both an Exchange Swap and / or a P2P Swap (as relevant);",
                                                        },
                                                        {
                                                            term: '"Swap Offer"',
                                                            meaning:
                                                                "has the meaning set out at clause D 1.6;",
                                                        },
                                                        {
                                                            term: '"Target Cryptoasset"',
                                                            meaning:
                                                                "refers to the Cryptoasset you wish to acquire in exchange for the Source Cryptoasset;",
                                                        },
                                                        {
                                                            term: '"Virus"',
                                                            meaning:
                                                                "means any software, thing or device which contains any malicious code, file, program, or other internal component which may prevent, impair or otherwise adversely affect the operation of any computer software, hardware or network; or which may prevent, impair or otherwise adversely affect access to or the operation of any programme or data, including the reliability of any programme or data (whether by re-arranging, altering or erasing the programme or data in whole or part or otherwise); or adversely affect the user experience, including worms, trojan horses, viruses, time bombs and other similar things or devices;",
                                                        },
                                                        {
                                                            term: '"Voting Platform"',
                                                            meaning:
                                                                "refers to the mechanism by which CHAT holders may submit votes as prescribed from time to time; and",
                                                        },
                                                        {
                                                            term: '"Vulnerability"',
                                                            meaning:
                                                                "means a weakness, glitch or bug in the computational logic (for example, code) found in software and hardware components that, when exploited, results in a negative impact to confidentiality, integrity, or availability.",
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'Where the words "**includes**", "**including**", "**for example**" or "**such as**" are used in these Terms, they are deemed to have the words "**without limitation**" following them.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.6)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'A reference to “**writing**” or “**written**” includes email but not faxes. Any reference to "**written consent**" shall mean specific explicit consent.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.7)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "References to “**dealing in**” or “**deal in**” are references to any participation in Cryptoassets including buying, acquiring, accepting, holding, selling, staking, disposing of and / or otherwise making use of Cryptoassets. References to “**transaction”** or “**transactions**” are references to any activity involving a person disposing, acquiring, or otherwise transferring a Cryptoasset to another person (be that by a Swap, a chat message, or any other means).",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.8)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "The headings of the clauses and schedules of these Terms are for convenience only and shall not affect its construction or interpretation. The schedules form part of these Terms and any reference in these Terms to a clause or schedule is a reference to a clause or schedule of these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.9)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "A reference to these Terms or to any other agreement or document referred to in these Terms is a reference to these Terms or such other document or agreement as amended or varied in accordance with its terms from time to time.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.10)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "A reference to a statute, statutory provision or subordinate legislation is a reference to it as it is in force from time to time, and includes any statute, statutory provision or subordinate legislation which it amends or re-enacts and subordinate legislation for the time being in force made under it.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.11)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Unless the context otherwise requires, words in the singular shall include the plural and the plural shall include the singular, and a reference to one gender shall include a reference to the other genders.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A2",
                            title: "Contact Details",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you have any queries, you can contact us via the help channel in the OpenChat Community, accessible via the OpenChat Platform.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Communications between us shall be in English. Should we receive a communication which purports to be from you, we are entitled, but are not obliged, to rely on and conclusively presume that such communication has been given by you. We may record and monitor conversations we have with you.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You must keep your information with us up to date, as any communication we send using the details you provide us will be deemed received by you, regardless of whether or not you actually receive it.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You accept that we are deemed to have received any correspondence only at the time we actually access it. You accept that there may be a delay in responding to correspondence received.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A3",
                            title: "Setting up and securing your OpenChat account",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "3.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Before you can use our Services, you need to set up an account and provide certain information. You can do this via our Platform.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "To set up an account, our Platform will ask you to authenticate your identity via a third party identity provider. By authenticating your identity, you agree to the terms of the third party identity provider.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "As part of setting up your account, you may be provided with or asked to create security details. You must keep your security details secure and not disclose them to anyone else. Any action or instruction by anyone using your security details will be treated as if such action or instruction had been made by you, and we are not responsible for any loss as a result. You should contact us immediately upon discovering any unauthorised use of your security details.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "**We strongly recommend logging out of the OpenChat Platform at the end of every session you have on the OpenChat Platform, as otherwise the OpenChat Platform may not prompt the next user of the device used to access the OpenChat Platform to enter credentials in order to use the OpenChat Platform. If you do not log out of the OpenChat Platform at the end of each session, there is a risk that another person may impersonate you, for example to send Contributions or to access your Cryptoassets without your knowledge or consent. We are not responsible for any losses as a consequence of your failure to log out at the end of a session or your credentials otherwise being compromised.**",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A4",
                            title: "Eligibility to use our services",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "4.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By using the OpenChat Platform, you confirm and represent at all times that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "4.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "(if you are a body corporate) you are duly organised and validly existing under the laws of the jurisdiction of your domicile, and have full power, authority and right, and have taken all action required, to bind yourself to these Terms, including as regards performing all actions and obligations under these Terms, which therefore constitute valid and legally binding obligations;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "(if you are an individual) you are of legal age and competency to agree to these Terms and all related obligations, including as regards any age, residency, legal capacity, competency and all other requirements;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are at least 13 years of age;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are not a citizen or resident of, or a legal entity in any country or territory which appears on the sanctions lists of the Office of Foreign Assets Control of the U.S. Department of Treasury (“**OFAC**”), United Nations Security Council (“**UNSC**”), Her Majesty’s Treasury (“**HMT**”) or any other relevant sanctions list;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "(if using our Services to deal in Cryptoassets) you are not a citizen or resident of, or a legal entity in any country that prohibits dealing in Cryptoassets or which would otherwise require us to have a licence, permission, registration or authorisation which we do not have;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "(if using our Services to send Contributions) you shall not make a Contribution that is prohibited in the country where you are a citizen or resident, or registered as a legal entity.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will comply with any Applicable Law relevant to you, including not committing, causing, facilitating or contributing to the commission by any person of any bribery, corruption or tax evasion offence;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.8)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you shall not deal in Cryptoassets where this would require you or us to obtain any registration, approval, authorisation or similar which you / we do not have, or in any other circumstances in which your dealing in Cryptoassets is prohibited;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.9)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "in using the OpenChat Platform you do not breach the rights of any third party, including any intellectual property or data privacy rights of any third party;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.10)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you have not received any advice from us in relation to the using the Openchat Platform or our Services or dealing in CHAT, and you are solely responsible for any evaluations, decisions and actions taken in connection with such;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.11)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will provide us with whatever information we may request for the purposes of satisfying our regulatory, compliance and contractual obligations;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.12)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will deal with us in any open and honest way, including as regards providing us with full, complete and accurate information when responding to our reasonable requests;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.13)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you waive any right you may have to participate in a class action lawsuit or a class-wide arbitration against us and / or any person involved with us that arises out of or relates to CHAT or these Terms;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.14)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will not attempt to circumvent the security of or interfere with the proper working of the OpenChat Platform, CHAT or any server on which they are hosted, nor otherwise introduce, nor permit the introduction of, any Virus or Vulnerability into the OpenChat Platform, CHAT nor any of our systems; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "4.1.15)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will not use (or assist others in using) our Services or CHAT in ways that are unlawful, misleading, harmful, discriminatory or fraudulent.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "4.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In using the OpenChat Platform and our Services you are responsible for all activity that occurs under your OpenChat account and via any device connected with/to your OpenChat account.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "4.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You shall notify us via the help channel in the OpenChat Community (accessible via the OpenChat Platform) immediately if you become aware you have breached, or may have breached, any of your obligations under these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "4.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You may not create multiple accounts on the OpenChat Platform according to Schedule 4;",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A5",
                            title: "Availability",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "5.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Whilst we strive to make our Services and the OpenChat Platform available for all users all the time, we do not guarantee that our Services or the OpenChat Platform will be available without interruption, and there may be unavailability for reasons such as maintenance, repairs, upgrades, or failures of network or equipment.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "5.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We shall not be responsible for any loss from or arising out of Service interruptions, delays in processing transactions or inability to execute transactions.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A6",
                            title: "General obligations when dealing with cryptoassets",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "6.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "When using our Services to deal in Cryptoassets (including CHAT), you acknowledge and accept that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "6.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that we do not provide, nor do we accept responsibility for, any investment, legal, tax or accounting advice, and we do not provide any form of recommendation regarding the suitability/appropriateness or quality of any Cryptoasset, and the fact that our Services may be used in relation to any Cryptoasset should not be taken as an indication of such;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "your dealing in Cryptoassets is based on your own assessment of the risks involved, and if you are in any doubt as to what these risks are you confirm you have taken your own independent advice as appropriate;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are responsible for ensuring that any Cryptoassets and software (including any external wallet) you use in connection with our Services is compatible with the OpenChat Platform and CHAT, and we are not liable in the event of any incompatibility resulting in loss;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are only able to send Cryptoassets using our Services that are stored in your OpenChat Wallet, and you are not able to send Cryptoassets stored in any external wallet;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the OpenChat Platform will refuse to complete, cancel or reverse any transaction you have authorised or made using our Services where there is insufficient Cryptoassets in your OpenChat Wallet to cover the transaction and our fees incurred;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will be charged a fee for every chat message sent containing Cryptoassets as determined by the relevant Cryptoasset ledger, and this fee will be automatically deducted from your OpenChat Wallet (this is not a fee charged by us);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will provide us with whatever information we request to facilitate any transaction using our Services;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.8)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "Cryptoasset transfers are irreversible and so accidental or fraudulent transactions with respect to Cryptoassets may not be recoverable. We are not responsible for any losses that may arise in connection with accidental or fraudulent transactions and as such, caution should be exercised whenever you make a transaction via the OpenChat Platform;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.9)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "whilst we will use reasonable endeavours to ensure that instructions in relation to Cryptoassets are processed in a timely manner, we make no representation or warranty regarding the amount of time needed to complete any instruction, as this is dependent upon many factors outside of our control, and we shall not be responsible for any loss from or arising out of delays in processing transactions or any inability to execute transactions; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "6.1.10)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are responsible for complying with any tax obligations applicable to you in connection with your dealing in Cryptoassets.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A7",
                            title: "Intellectual property",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "7.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "OpenChat and their licensors (if any) are at all times the owners of all intellectual property rights (of whatever nature, anywhere in the world) associated with our Services, the OpenChat Platform or CHAT, as well as any related software or information provided in relation to the CHAT (the “**OpenChat Intellectual Property**”). The OpenChat Intellectual Property and aforesaid rights are licensed (not sold) to you under the AGPLv3 licence (at [https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html)) and you have the right to use the OpenChat Intellectual Property only for the purpose of using our Services and as otherwise permitted under the AGPLv3 licence. You have no intellectual property rights in the OpenChat Intellectual Property other than the right to use them in accordance with these Terms and the AGPLv3 licence. Any other use is expressly prohibited. We reserve all rights not expressly granted under these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "7.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "The main repository for the OpenChat application used in the OpenChat Platform is at [https://github.com/open-chat-labs/open-chat/](https://github.com/open-chat-labs/open-chat/). You may use this code solely in accordance with the AGPLv3 licence or as otherwise expressly agreed by us in these Terms or in writing. Subject to the foregoing, you shall not, except as may be allowed by Applicable Law which is incapable of exclusion by agreement between the Parties:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "7.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "except to the extent expressly permitted under these Terms, attempt to copy, modify, duplicate, create derivative works from, frame, mirror, republish, download, display, transmit, or distribute all or any portion of any OpenChat Intellectual Property;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "7.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "attempt to reverse compile, disassemble, reverse engineer or otherwise reduce to human-perceivable form all or any part of any OpenChat Intellectual Property;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "7.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "access all or any part of the OpenChat Intellectual Property in order to build a product or Service which competes with the CHAT and / or the activities of OpenChat;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "7.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "license, sell, rent, lease, transfer, assign, distribute, display, disclose, or otherwise commercially exploit OpenChat Intellectual Property, and this includes not doing so via any third party; and / or",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "7.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "attempt to obtain, or assist third parties in obtaining, access to OpenChat Intellectual Property other than as expressly permitted by these Terms.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "7.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "All logos related to us and the OpenChat Intellectual Property are marks of OpenChat or our licensors. You may not copy, imitate, or use our trading names or logos without our prior written consent. All rights, title and interests in and to such is the exclusive property of us and our licensors.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "7.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "OpenChat Intellectual Property may contain code, commonly referred to as open-source software, which is distributed under any of the many known variations of open source licence terms, including terms which allow the free distribution and modification of the relevant software’s source code and/or which require all distributors to make such source code freely available upon request, including any contributions or modifications made by such distributor (collectively, “**Open Source Software**”). To the extent that our Services, the OpenChat Platform or CHAT use or contain any Open Source Software, that element only is licensed to you under the relevant licence terms of the applicable third party licensor (“**Open Source Licence Terms**”), and you accept and agree to be bound by such Open Source Licence Terms.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A8",
                            title: "Our liability",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "8.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Notwithstanding any other clause in these Terms, we do not in any way exclude or limit our liability for death or personal injury caused by our negligence; fraud or fraudulent misrepresentation; or any other liability which cannot be limited or excluded by Applicable Law.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "8.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Subject to clause A 8.1, we shall be responsible to you only for loss that you suffer as a direct and foreseeable result of our breach of this Agreement as a result of our gross negligence, and only insofar that such loss does not arise as a result of a breach of these Terms and / or Applicable Law by you. In any event, we shall not be liable to you for any loss: (i) of profits or expected revenue; (ii) caused by events outside our reasonable control; (iii) resulting from any attack by a third party on our systems; (iv) as a result of us exercising any of our rights or any exercise of discretion permitted to us under these Terms; or (v) anything else which we state we are not responsible for or which we otherwise exclude our liability for under these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "8.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Subject to clause A 8.1, our total liability under these Terms shall be capped at the total amount of fees received by us from you in the year proceeding the breach.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A9",
                            title: "Your liability",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "9.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You agree to indemnify us for any losses that arise from or relate to:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "9.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "your breach of any Applicable Law or these Terms;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "9.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "your breach of the rights of any third party to these Terms;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "9.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "any regulatory inquiry, legal action, litigation, dispute or investigation, whether such situations occur or are anticipated, that relate to you; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "9.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "any fees, taxes or costs not imposed by or via us, which we pay on your behalf.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "9.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Losses for the purposes of this clause A 9 include direct and indirect losses, as well as any costs and expenses (including reasonable legal fees).",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A10",
                            title: "Termination",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "10.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You may terminate your relationship with us immediately at any time for any reason by ceasing to use our Services. You will not be charged for terminating your OpenChat account. Once your OpenChat account is closed, you accept and acknowledge that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "10.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will no longer have access to any Contributions you have made;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "10.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "our other users will continue to have access to the Contributions you have made (as Contributions are not deleted when you terminate); and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "10.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will no longer have access to your OpenChat Wallet, and you are solely responsible for transferring any Cryptoassets stored in your OpenChat Wallet to an external wallet prior to account deletion (otherwise you will lose access to those Cryptoassets).",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "10.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We may suspend, restrict or terminate your access to or use of any or all of our Services or the OpenChat Platform with immediate effect at any time by giving you notice via the OpenChat Platform where (i) we believe that has been suspicious or unlawful conduct, including fraud; (ii) if we reasonably believe you breach these Terms repeatedly or in a serious way; (iii) if we reasonably believe you create harm, risk, or possible legal exposure for us, our users, or others; (iv) for security, legal or regulatory reasons; or (v) if you have not given us information we need, or we believe that the information you have provided us is incorrect.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "10.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "On suspension of some or all of our Services, you shall not be able to access some or all of our Services until the suspension is ended at our discretion. We shall have no obligation to end any suspension within any particular time period or at all, and we shall not incur any liability for any loss caused or as a consequence of us exercising our suspension rights under these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "10.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "On termination of all of our Services:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "10.4.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will no longer be permitted or have any right to access or use the OpenChat Platform or our Services, and we will also cease to support your use of CHAT in connection with these purposes.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "10.4.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you must withdraw all of your Cryptoassets from your OpenChat Wallet within 1 week of termination, as we will cease to provide support for your OpenChat Wallet after the expiry of that period, and we are not responsible for any loss as a consequence.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "10.4.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "all other rights, obligations and liabilities of the parties accrued up to and including the date of termination shall not be affected by termination.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "10.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Termination shall not affect the continued operation of clauses and provisions which by their nature clearly reflect the intention of the parties that they survive termination, including in relation to liability and the protection of intellectual property.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A11",
                            title: "Changes to these terms",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "11.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We may make changes to these Terms and our Services available from time to time:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "11.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to reflect changes to Applicable Law;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to reflect changes required by any court, regulatory or tax authority or industry guidance or codes of practice;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to reflect changes in the way cryptoasset markets work;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to reflect changes to our technology or other systems, including those required to reflect to our intention to have increasing decentralisation of the OpenChat Platform;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "if it becomes impossible or impractical, in our reasonable opinion, to carry out any aspect of these Terms as a result of circumstances beyond our reasonable control;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to make these Terms easier to understand;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "to reflect changes to the nature or scope of the Services we provide generally;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.8)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "where the changes are to your benefit or not detrimental to you; or",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "11.1.9)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "for any other valid reason.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "11.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We will give you reasonable notice of any changes to these Terms, or we may make changes with immediate effect where they are in your favour or are required by Applicable Law.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "11.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We will notify you of any changes via the OpenChat Platform. You will be treated as accepting any change that we make to these Terms unless you tell us that you do not agree to the change, in which case you must discontinue using our Services. We will treat this as your termination of your agreement to use our Services, with effect from the date that the change would otherwise come into effect.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A12",
                            title: "Novation",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "12.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We may appoint another entity to take over all or some of our rights and obligations under these Terms (the “**New Entity**”), in which case you consent to us transferring by way of novation all or some of our rights and obligations under these Terms to the New Entity. As soon as reasonably practicable following such novation, we shall notify you in writing of the effective date of such novation. From such effective date, all references in these Terms to “OpenChat”, “we”, “us” or “our” shall be deemed to be references to the New Entity.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A13",
                            title: "Governing law and jurisdiction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "13.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you are a consumer, please note that these Terms and any dispute or claim arising out of or in connection with them shall be governed by English law. You and we both agree that the courts of England and Wales will have non-exclusive jurisdiction to settle any dispute or claim arising out of or in connection with these Terms or their subject matter. However, nothing in these Terms will override any mandatory laws of the country in which you have your usual place of residence.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "13.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you are a business, these Terms and any dispute or claim arising out of or in connection with them or their subject matter or formation (including non-contractual disputes or claims) shall be governed by and construed in accordance with English law. We both agree that the courts of England and Wales shall have exclusive jurisdiction to settle any such dispute or claim (including non-contractual disputes or claims).",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A14",
                            title: "Entire agreement",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "14.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "These Terms constitute the entire agreement between you and us and supersede any prior agreement, terms and conditions or arrangement in respect of their subject matter. There are no promises, representations, warranties, terms, conditions or obligations between you and us other than those set out in these Terms.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "14.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You warrant that you have not entered into these Terms in reliance upon, and will have no remedy in respect of, any misrepresentation, representation or statement which is not expressly set out or referred to in these Terms. The only remedy available for any misrepresentation or breach of any representation or statement set out or referred to in these Terms shall be for breach of contract.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "A15",
                            title: "Miscellaneous",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "15.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "These Terms shall take effect from the earlier of the date on which you (i) receive CHAT (ii) access the OpenChat Platform or (iii) otherwise use our Services.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "15.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Each of the provisions of these Terms are separate, severable and enforceable and, accordingly, if at any time any provision or part-provision of these Terms is or becomes invalid, void, illegal or unenforceable, it shall be deemed deleted, but that shall not affect the validity and enforceability of the rest of these Terms. If any provision or part-provision of these Terms is deemed deleted under this clause A 15.2, these Terms shall be interpreted so as, to the greatest extent possible, to achieve the intended commercial result of the deleted provision.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "15.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You may not assign, lien, mortgage, transfer, charge or otherwise encumber any of your rights or obligations in a way which may impede your performance of your obligations under these Terms. We may assign the benefit of these Terms without restriction subject to compliance with Applicable Law.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "15.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'The parties intend that any New Entity shall have the right to enforce any rights granted to it under clause A 12 pursuant to the Contracts (Rights of Third Parties) Act 1999 (the "**1999 Act**"). Save as aforesaid, the participants do not intend that the provisions of these Terms shall be enforceable by virtue of the 1999 Act or otherwise by any person not a user of the OpenChat Platform. Notwithstanding this clause A 15.4, the consent any third party is not required for any variation (including any release or compromise of any liability) or termination of these Terms.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "15.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "No variation or waiver of any of the terms of these Terms shall be effective unless agreed by us explicitly in writing. No failure or delay by us to exercise any right, power or remedy under these Terms shall operate as a waiver of that right, or any other right, nor shall any single or partial exercise by us of any right, power or remedy preclude any other or further exercise of that right or any other right, power or remedy.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "2",
            title: "Section B: Additional terms for messaging on the OpenChat platform",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "B1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply to OpenChat users when using the OpenChat Platform to send Contributions to each other.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "B2",
                            title: "Messaging services",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "The OpenChat Platform enables all its users to, for example:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "send and receive text and multimedia communications;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "send messages containing Cryptoassets (including tips);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "send Prize Messages;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "join video and voice calls;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "create private Groups;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "join public and / or private and / or Gated Groups; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "join (but not create) public and / or private Communities.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Please note:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "when using our messages or prize messages to send Cryptoassets, this shall constitute dealing in Cryptoassets and the provisions in clause A 6 shall apply.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "that we strongly recommend logging out of the OpenChat Platform at the end of every session you have on the OpenChat Platform, as otherwise the OpenChat Platform may not prompt the next user of the device used to access the OpenChat Platform to enter credentials in order to use the OpenChat Platform. If you do not log out of the OpenChat Platform at the end of each session, there is a risk that another person may impersonate you to send Contributions. We are not responsible for any losses as a consequence of your failure to log out at the end of a session or your credentials otherwise being compromised.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "B3",
                            title: "Conditions for contributions",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "3.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "A Contribution must not:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "3.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "do anything that is unlawful;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "communicate any illegal content or activity;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "be defamatory, obscene, offensive, hateful or inflammatory;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "contain pornographic or otherwise sexually explicit material (see clause B 6.2);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "bully, harass, insult or intimidate; or",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "otherwise breach our Content Standards.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We shall decide, at our discretion, if a Contribution does not meet these requirements and if we decide that there has been a breach of clause B 3.1, we may suspend or terminate your access to or use of our Services immediately and you will be liable for any loss we incur as a consequence.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If we decide that a Contribution is prohibited in any jurisdiction, we reserve the right to conceal the Contribution and prevent it from being viewed by users who are citizens, residents or legal entities in those jurisdictions where such a Contribution is prohibited.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If we decide that a Contribution is likely to be interpreted by any users as defamatory, offensive, hateful or inflammatory, we reserve the right to require users to confirm an appropriate risk warning before permitting them to view such a Contribution.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you see any Contribution that you believe is in breach of clause B 3.1, you should contact us via the help channel in the OpenChat Community (accessible via the OpenChat Platform) and we will investigate. However, you acknowledge that we are not responsible if a person breaches clause B 3.1 when using our Services, whether or not we take any action as a result.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.6)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We will enable you to send Prize Messages. Where you do so, you shall ensure that the arrangements under which any Cryptoasset prizes are gifted:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "3.6.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "are clear, fair, honest, not misleading and in compliance with any Applicable Law;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.6.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "are not structured in a way that would meet the definition of regulated gambling under any relevant jurisdiction; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.6.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "are gifted in accordance on a basis which is clearly communicated with all participants.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.7)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "All participants in any arrangement for Cryptoasset prizes accept that we do not control, and are not responsible or liable for, any issue or loss in connection with any Cryptoassets prizes offered or gifted via our Services.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.8)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You understand that messaging services are vulnerable to spoofing and phishing attacks and so caution should be exercised in reviewing all Contributions, and we shall not be responsible for any loss caused by phishing, spoofing or any other malicious attack.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.9)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You also accept that we shall also not be responsible for any loss in connection with any delay or error in the transmission or receipt of any Contribution, so long as we have acted in good faith. This includes loss caused as a result of a delay in the transmission or receipt of Cryptoassets sent via our messaging system, so long as we have acted in good faith.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "B4",
                            title: "Conditions for joining groups and communities",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "4.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By joining a public or private Group or Community (including those which are Gated) on the OpenChat Platform, you understand and accept that you must comply with all applicable rules of that Group or Community. You also understand that we do not accept responsibility for the operation of Groups and Communities available via the OpenChat Platform.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "4.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In addition, to join a Gated Group or Community you will need to at all relevant times satisfy the criteria as determined by the creator of that particular Group or Community.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "B5",
                            title: "Intellectual property",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "5.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We do not claim any ownership of any intellectual property in the content that you submit via our messaging Services. However, you represent that any content you submit does not breach the intellectual property of any person, that you have the full right to send such information, and there is no other reason why we would be in breach of any obligation to any person in enabling you to send such information via our Services.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "B6",
                            title: "Safety, moderation and reporting",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "6.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'Moderation, enforcement and other safety functions for the OpenChat Platform, including reporting to authorities, are performed on our behalf by [OpenChat Labs Ltd](https://openchatlabs.org), a company registered in England and Wales with company number 14871398 ("**OpenChat Labs**").',
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'Pornographic content, and all other content falling within the categories of "primary priority content" under the UK Online Safety Act 2023 (pornographic content, and content which encourages, promotes or provides instructions for suicide, deliberate self-injury or eating disorders), is prohibited on all parts of the OpenChat Platform for all users. This applies in public and private Groups, Channels and direct chats alike, and regardless of any labelling or rules applied to a Group or Community. Such content will be removed and account action may be taken in accordance with these Terms.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Messages sent to public Groups and Channels are subject to automated classification for safety purposes. Message text is classified using third-party processors (currently OpenAI). Message media is not sent to general-purpose classifiers; it is checked against databases of known child sexual abuse material. OpenChat uses PhotoDNA technology licensed by Microsoft at no cost. Only a non-reversible perceptual hash of the media is shared with the matching service; the media itself never leaves OpenChat infrastructure, and where media does not match, nothing is retained from the check. Private messages are never proactively scanned; the content of a private message is checked only if a recipient reports it.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: 'Where suspected child sexual exploitation or abuse ("**CSEA**") content is detected, the content is removed immediately and the sending account is suspended pending review by a human moderator. Where any other prohibited content is detected, it is referred to a human moderator and action is taken only if the moderator upholds the referral. Any notice of sanction will state the grounds for the decision.',
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If action is taken against your account by an automated system, you have the right to contest that decision and have it reviewed by a human moderator. The means to contest is provided with the sanction notice and remains available while an account is suspended. If the decision is not upheld, it is reversed: restorable content is restored and the suspension is lifted.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.6)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We report detected CSEA content, together with associated account data, to the relevant authorities (including the UK National Crime Agency and/or the US National Center for Missing and Exploited Children) as required by Applicable Law.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.7)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Where suspected CSEA content is detected, a copy is preserved as evidence in access-restricted storage for the period required by Applicable Law (typically one year from any report to an authority, or longer where a legal preservation request applies), after which it is deleted. This evidence-preservation regime is separate from, and does not change, the ordinary deletion behaviour of the OpenChat Platform for all other content.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.8)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "For the purposes of data protection law, [OpenChat Labs](https://openchatlabs.org) is the controller in respect of the processing described in this clause B 6. The legal basis for this processing is compliance with legal obligations to which OpenChat Labs is subject. This processing involves automated decision-making; the right to contest such decisions and obtain human review is described in clause B 6.5. Data may be shared with the processors identified in clause B 6.3 and, where required by Applicable Law, with law enforcement authorities. Full information about this processing, and about your rights in relation to it, is set out in our [Privacy Notice](/privacy).",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.9)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you wish to complain about any safety matter, including any moderation decision, you may do so via the help channel in the OpenChat Community (accessible via the OpenChat Platform) or by emailing **safety@openchatlabs.org** (which does not require access to an OpenChat account). Complaints will be acknowledged and investigated within a reasonable time.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "6.10)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Our published standards against child sexual abuse and exploitation are available at [https://openchatlabs.org/csae](https://openchatlabs.org/csae).",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "3",
            title: "Section C: Additional terms for using the OpenChat wallet",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "C1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply to OpenChat users who use the OpenChat Wallet.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "C2",
                            title: "Conditions for use",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By using the OpenChat Wallet, you acknowledge and accept that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that in order to secure your OpenChat Wallet and be able to store Cryptoassets, you must access your OpenChat account using the credentials provided when opening your account. You are responsible for keeping, protecting and safeguarding your credentials. In this respect, you are aware that if you lose your credentials or access to your OpenChat account is compromised for any other reason, you may not be able to access your OpenChat Wallet and someone else may take control of your Cryptoassets (and may as a consequence be treated by the OpenChat Platform as if they were owner of those Cryptoassets). We are not responsible for any losses in relation to your loss of or inability to access the Cryptoassets stored in your OpenChat Wallet in connection with you losing your credentials or your credentials otherwise being compromised;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "unless you log out of the OpenChat Platform at the end of every session you have on the OpenChat Platform, the OpenChat Platform may not prompt the next user of the device used to access the OpenChat Platform to enter credentials in order to use the OpenChat Platform. If you do not log out of the OpenChat Platform at the end of each session, there is a risk that another person may impersonate you to access your Cryptoassets without your knowledge or consent, and the OpenChat Platform may treat them as if they are the owner of those Cryptoassets. We are not responsible for any losses as a consequence of your failure to log out at the end of a session or your credentials otherwise being compromised;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "we assume no responsibility in connection with any attempt to use your OpenChat Wallet for cryptoassets that we do not support or with regard to Cryptoassets sent from your OpenChat Wallet to an incompatible external wallet address;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that if you authorise or allow any third party to access your OpenChat Wallet, the third party will know your OpenChat Wallet information (including without limitation, information relating to your assets and transactions), and your OpenChat Wallet will be exposed to certain risks, and you may suffer losses (we are not responsible for any such losses);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the transfer of Cryptoassets into your OpenChat Wallet exposes those Cryptoassets to the risk of loss from, amongst other things, security breaches from cyber-attacks, and so long as we have acted in good faith we are not responsible for any such loss; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that if you hold Cryptoassets in your OpenChat Wallet, and there has been no activity on your OpenChat account for a prolonged period of time and we are unable to contact you, Applicable Law may require us to deliver any such Cryptoassets to the authorities in certain jurisdictions as unclaimed property. Where this is the case, we will comply with such requirements to the extent reasonably required by Applicable Law.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By using the OpenChat Wallet, you covenant, represent and warrant that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you shall not allow your OpenChat Wallet to be used in connection with any activities that are prohibited by Applicable Law;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you shall not use your OpenChat Wallet to store, send, or receive cryptoassets that we do not support;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you are the legal and rightful owner of all Cryptoassets in your OpenChat Wallet, and that the sources of such Cryptoassets are legal, and you will not transfer or trade through the OpenChat Platform anything other than Cryptoassets that have been legally obtained by you and that belong to you; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you shall notify us without undue delay of any unauthorised use and / or access of your OpenChat Wallet.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "4",
            title: "Section D: Additional terms applicable to making a swap",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "D1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply to OpenChat users who use the OpenChat Platform to make a Swap.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "A Swap can be either:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "an Exchange Swap, which is where the OpenChat Platform offers you a price for the Cryptoasset, and the transaction is completed using the third party exchange(s) the OpenChat Platform is linked to; or",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "a P2P Swap, which is where you send a message to the users of a chat with the proposed terms of a transaction, and the OpenChat Platform facilitates you in completing that transaction with the other user.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In order to make an Exchange Swap, you need to choose (i) your Source Cryptoasset, (ii) your Target Cryptoasset and (ii) the amount of the Source Cryptoasset you wish to exchange for that Target Cryptoasset. You can then ask us to provide you with a proposed estimated exchange rate. This exchange rate reflects the rate(s) provided by the third party exchange(s) we are connected with.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.4)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "If you instruct us to proceed with an Exchange Swap, we will transfer the Source Cryptoasset from your OpenChat Wallet to the relevant third party exchange to make the conversion. You will then receive the Target Cryptoasset back to your OpenChat Wallet.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.5)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Where we use a third party exchange to complete an Exchange Swap, please note that the exchange rates provided by us are an estimated rate at the time you request the rate. The actual rate provided will be determined at the time you instruct us to make the Exchange Swap. **As the prices of Cryptoassets can be highly volatile, we do not guarantee that the amount of Target Cryptoassets you acquire from an Exchange Swap will be the same as that set out in the proposed exchange rate. Rather, it will reflect the rate actually obtained when the Exchange Swap is actually executed by the third party exchange (which may result you in receiving less of the Target Cryptoasset than that predicted by the estimated exchange rate you receive**).",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.6)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In order to engage in a P2P Swap (either by making a Swap Offer or accepting a Swap Offer), you need to have a Diamond Membership. A “Swap Offer”, is a communication which you, if you hold a Diamond Membership, can make to other users in chat(s) with the following information:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.6.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "your Source Cryptoasset;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.6.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "your Target Cryptoasset;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.6.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the amount of the Source Cryptoasset you are willing to exchange;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.6.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the amount of the Target Cryptoasset you wish to acquire; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.6.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the chat(s) who can accept the Swap Offer.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.7)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Upon making a Swap Offer:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.7.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the amount of the Source Cryptoasset you are willing to exchange is sent from your OpenChat Wallet into escrow.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.7.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "a message containing the details of the Swap Offer is sent to the users in the relevant chat(s), who have the ability to accept your Swap Offer at their discretion.",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.7.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you have the ability to cancel the Swap Offer for as long as no other user has accepted the Swap Offer, in which case the Source Cryptoasset shall be returned to your OpenChat Wallet.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.8)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "As soon as another user accepts your Swap Offer, the P2P Swap is processed, meaning that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.8.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the Target Cryptoassets will be transferred from their wallet to escrow;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.8.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the Source Cryptoassets will be transferred from escrow to the other user’s OpenChat Wallet; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.8.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the Target Cryptoassets will be transferred from escrow to your OpenChat Wallet.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "D2",
                            title: "Conditions for making a swap",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By using our Services to make a Swap, you are dealing in Cryptoassets and clause A 6 shall apply. In addition, you acknowledge and accept that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you will only able to make a Swap if there are sufficient Cryptoassets stored in your OpenChat Wallet to do so;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that once an offer for a Swap has been accepted, you are not able to cancel that Swap (or otherwise ask for a refund), and as such before making any Swap or Swap Offer you should make sure that you are certain you want to proceed;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "whilst we may cancel an Exchange Swap where there is a Manifest Error in the price of a Cryptoasset as shown by us (in which case we will give you the ability as soon as commercially practicable to acquire the Cryptoasset at the correct price, and we shall notify you of any cancellation as soon as we reasonably can by email or via the OpenChat Platform), you do not have the right to cancel an accepted Swap Offer because of a Manifest Error (and so you should be careful to ensure that the details of any Swap Offer you make are accurate); and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "we reserve the right to make changes to these Terms to reflect changes to the third party exchanges available to us and their offerings.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "As long as we act in good faith, we do not accept responsibility for:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "our Services being interrupted;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "any Swap not being executed or accepted by any counterparty;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "any delay in processing a Swap;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "any lack of liquidity in any market for a Cryptoasset; or",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "our refusal to carry out any Swap for you if we believe it is in breach of these Terms.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "5",
            title: "Section E: Additional terms for dealing in CHAT",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "E1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply whenever you deal in CHAT.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "E2",
                            title: "Conditions for dealing in CHAT",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "By dealing in CHAT, you are dealing in Cryptoassets and clause A 6 shall apply. In addition, you acknowledge and accept that:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you have the necessary and relevant experience, knowledge and understanding to deal in CHAT;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "other than as set out in these Terms, you are not relying upon any other representation or warranty by OpenChat or any other person, written or otherwise, in determining whether to deal in CHAT, and have reached your independent view regarding that dealing in CHAT is right for you;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you accept that CHAT is created and you obtain CHAT on an “as is” basis. Therefore, provided we act in good faith in accordance with these Terms, you accept that OpenChat is providing CHAT without being able to provide any warranties in relation to them, including, but not limited to, title, merchantability or fitness for a particular purpose;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "OpenChat has not made, and does not make, any representations that you will be able to generate a return on your obtaining of CHAT, and you should not expect a return or any kind of cancellation or refund rights in relation to the CHAT;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "whilst OpenChat will use reasonable endeavours to ensure that CHAT will have the utility reflected in these Terms, the features of the CHAT are subject to change, modification, amendment, alternation or supplementation at any time (at OpenChat’s sole discretion);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "these Terms do not constitute a prospectus, offering memorandum or private placement memorandum of any sort and does not pertain in any way to be any kind of regulated offering;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you understand that the CHAT is not being offered as securities, e-money or stablecoins; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.8)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "you accept that we reserve the right to create new classes of cryptoassets other than CHAT under separate brands and with features outside of the scope of these Terms and nothing in these Terms shall entitle you to have any rights (of whatever nature) in relation to such cryptoassets.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Any sale of CHAT by you to another person is subject to these Terms, and you are responsible for ensuring that any acquirer of CHAT is aware of the fact that in doing so they accept, and are subject to, these Terms.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "6",
            title: "Section F: Additional terms for Diamond membership holders",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "F1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply if you hold a Diamond Membership.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "1.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "As a Diamond Membership holder, you are eligible to:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "1.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "earn rewards in return for referring other users to become Diamond Membership holders. Rewards are 50% of the referred member’s total Diamond Membership payments for the first year after the referral is completed. Rewards are paid out in either CHAT or ICP, depending on whether the referred member uses CHAT or ICP to purchase the Diamond Membership;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "create public Groups (in addition to the general ability to create private Groups);",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "create public and / or private Communities;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "create Gated Groups and Gated Communities;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "make video and voice calls;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "make or accept Swap Offers in relation to a P2P Swaps (see section D for further information); and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "1.2.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "access any other features that we make available from time to time at our discretion to holders of a Diamond Membership (subject to your acceptance of any additional terms which may apply to such).",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "F2",
                            title: "Conditions for becoming a Diamond membership holder",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "We will charge you in advance for your Diamond Membership and we will automatically deduct the fee (as specified on the fees page on the OpenChat Platform and payable in either CHAT or ICP) directly from your OpenChat Wallet at the start of your membership. This fee shall cover your Diamond Membership for the membership period specified when you sign up for Diamond Membership.",
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "In the event that we suspend the provision of Diamond Membership to you:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.2.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "because you breach the terms of this Agreement, you will forfeit your Diamond Membership (and shall not be entitled to any refund in respect of such).",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.2.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "for any other reason, the membership period shall be extended accordingly so that you do not pay any fee in respect of a time period during which the Diamond Membership is suspended.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "2.3)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Your Diamond Membership cannot be transferred or assigned. To the extent permitted by Applicable Law, we do not provide any refund rights in relation to your purchase of a Diamond Membership, and we note that the Diamond Membership is contingent on the operation and value of CHAT and ICP which is dependent on fluctuations in the financial market which cannot be controlled by us.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "F3",
                            title: "Conditions for creating groups and communities",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "3.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "As the creator of a Group, Community or Channel, you may:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "3.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "determine the rules that users must comply with in order to send messages in the Group, Community or Channel;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "manage and control the operation of the Group, Community or Channel; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.3)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "assign functions to admins and moderators at their discretion to assist with the management of the Group, Community or Channel,",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.4)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "and in doing so you accept that you are responsible for:",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.5)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the Groups, Communities, and Channels you administer;",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.6)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "ensuring that the rules of the Groups, Communities and Channels you administer are appropriately enforced; and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "3.1.7)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "dealing with any complaints or queries received from participants in relation to the Groups, Communities, and Channels you administer.",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            number: "3.2)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "Notwithstanding the rest of this clause F 3, we may require you to change the rules of any Group, Community or Channel, or we may require that certain jurisdictions be geo-blocked from a Group, Community or Channel, if we in good faith believe that this is required to comply with Applicable Law. We also have the right to require you to resolve any complaint or query in a particular way, if we in good faith believe that this is required to protect the rights of any person. You shall comply with any such requirement we impose promptly, and ensure that we are provided with full, complete, accurate and up to date responses to any queries we make in deciding whether to place such a requirement on you or any Group or Community. We do not accept any liability for our exercise of our rights under this clause F 3.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "7",
            title: "Section G: Participating in the OpenChat DAO",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "G1",
                            title: "Introduction",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "1.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "This section of these Terms will apply if you participate in the governance of the OpenChat DAO.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "G2",
                            title: "Location of information regarding the DAO",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "2.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "For information regarding:",
                                                },
                                                {
                                                    kind: "clauses",
                                                    items: [
                                                        {
                                                            number: "2.1.1)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "the rules setting out the operation and governance of the OpenChat DAO, please see: [https://oc.app/blog/governance](https://oc.app/blog/governance); and",
                                                                },
                                                            ],
                                                        },
                                                        {
                                                            number: "2.1.2)",
                                                            body: [
                                                                {
                                                                    kind: "para",
                                                                    text: "how holders of CHAT may vote on Governance Matters, please see: [https://oc.app/blog/governance](https://oc.app/blog/governance),",
                                                                },
                                                            ],
                                                        },
                                                    ],
                                                },
                                                {
                                                    kind: "para",
                                                    text: "and in participating in the OpenChat DAO you agree to and are bound by these rules as amended from time to time, which shall be considered as part of these Terms.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            number: "G3",
                            title: "Conditions for using the voting platform",
                            body: [
                                {
                                    kind: "clauses",
                                    items: [
                                        {
                                            number: "3.1)",
                                            body: [
                                                {
                                                    kind: "para",
                                                    text: "You understand that the Voting Platform you use to vote may be operated by a third party. As such, you may be subject to the additional terms of the third party operating the Voting Platform. Where this is the case, and you confirm that (i) you accept and will comply with these additional terms as applicable to you and (ii) you understand that we are not responsible for them.",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "8",
            title: "Schedule 1: Risks relating to cryptoassets",
            blocks: [
                {
                    kind: "para",
                    text: "**DEALING IN CRYPTOASSETS INVOLVES A HIGH DEGREE OF RISK, AND, THEREFORE, SHOULD BE UNDERTAKEN ONLY IF YOU ARE CAPABLE OF EVALUATING THE RISKS INVOLVED AND ABLE TO BEAR THE RISK OF A COMPLETE LOSS OF ALL CAPITAL USED TO PARTICIPATE IN CRYPTOASSETS.**",
                },
                {
                    kind: "para",
                    text: "**YOU SHOULD CAREFULLY CONSIDER THE RISKS DESCRIBED BELOW BEFORE DEALING IN CRYPTOASSETS. IT SHOULD BE NOTED THAT THE LIST OF RISK FACTORS DESCRIBED HEREUNDER IS NOT INTENDED TO BE EXHAUSTIVE AND DOES NOT NECESSARILY INCLUDE ALL THE RISKS TO WHICH YOU MAY BE EXPOSED WHEN DEALING IN CRYPTOASSETS.**",
                },
                {
                    kind: "para",
                    text: "We expressly disclaim all responsibility for any loss or damage of any kind whatsoever arising directly or indirectly from: (i) reliance on any information contained in this Schedule 1, (ii) any error, omission or inaccuracy in any such information or (iii) any action resulting from such information.",
                },
                {
                    kind: "para",
                    text: "Please note that in addition to the risks below, there may be other risks associated with your dealing in Cryptoassets and using our Services generally, including those that we cannot reasonably foresee. Additional risks may also materialise as unanticipated variations or combinations of the risks discussed below.",
                },
                {
                    kind: "para",
                    text: "By participating in these Terms, or by otherwise dealing in Cryptoassets, including CHAT, you expressly acknowledge and assume the following risks, which we shall not be liable should they materialise:",
                },
                {
                    kind: "para",
                    text: "**Risks applicable to all Cryptoassets (including CHAT)**",
                },
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1)",
                            title: "General risks",
                            body: [
                                {
                                    kind: "para",
                                    text: "The value of the Cryptoassets can fall as well as rise. If you buy Cryptoassets, you may not get back the full amount you spent on them, or anything at all. The value of Cryptoassets may depend on fluctuations in the financial markets, or other economic factors, which are outside our control. The past performance of a Cryptoassets is not a guide to the future performance of Cryptoassets.",
                                },
                            ],
                        },
                        {
                            number: "2)",
                            title: "The prices of Cryptoassets are extremely volatile",
                            body: [
                                {
                                    kind: "para",
                                    text: "Fluctuations in the price of Cryptoassets are subject to significant price volatility. The prices of Cryptoassets have historically been subject to dramatic fluctuations and are highly volatile. A range of factors may influence the market price, if any, of Cryptoassets , including, but not limited to: (i) the ability (if any) of Cryptoassets to trade on a secondary market; (ii) global supply and demand (iii) general expectations with respect to the rate of inflation, interest rates and exchange rates; (iv) changes in the software, software requirements or hardware requirements underlying Cryptoassets; (v) changes in the rights, obligations, incentives, or rewards for holders of Cryptoassets;(vii) interruptions in service from or failures of exchanges on which Cryptoassets are traded; (viii) investment and trading activities of large purchasers, including private and registered funds, that may directly or indirectly invest in Cryptoassets; (ix) monetary policies of governments, trade restrictions, currency devaluations and revaluations; (x) regulatory measures, if any, that affect the use of Cryptoassets and changes in Applicable Law; (xi) global or regional political, economic or financial events and situations; and (x) expectations among participants that the value of a particular Cryptoasset or Cryptoassets generally will soon change. A decrease in the price of a single cryptoasset may cause volatility in the entire cryptoasset industry and may affect the Cryptoassets available via our Services. Volatility in the price of Cryptoassets may result in significant loss over a short period of time.",
                                },
                            ],
                        },
                        {
                            number: "3)",
                            title: "Risk of losing access to Cryptoassets due to loss of private key(s) and wallet(s)",
                            body: [
                                {
                                    kind: "para",
                                    text: "A private key, or a combination of private keys, is necessary to deal in Cryptoassets. Accordingly, loss of requisite private key(s) associated with your digital wallet or vault storing Cryptoassets will result in loss of such Cryptoassets. Moreover, any third party that gains access to such private key(s), including by gaining access to login credentials of a hosted wallet service you use (including the OpenChat Wallet), may be able to misappropriate your Cryptoassets.",
                                },
                                {
                                    kind: "para",
                                    text: "Any errors or malfunctions caused by or otherwise related to the wallet you use to receive and store Cryptoassets, including your own failure to properly maintain or use such wallet, may also result in the loss of your Cryptoassets. Failure to precisely follow any procedures set forth by us for dealing in Cryptoassets, including, for instance, providing an incorrect wallet address, or using incompatible wallet(s), may result in the loss of Cryptoassets you hold.",
                                },
                            ],
                        },
                        {
                            number: "4)",
                            title: "Regulatory risks",
                            body: [
                                {
                                    kind: "para",
                                    text: "Regulation of Cryptoassets and the offering thereof, as well as blockchain technologies, and cryptoasset exchanges is currently underdeveloped and likely to rapidly evolve. Regulation varies significantly between different jurisdictions and is subject to significant uncertainty. Regulators may in the future adopt laws, regulations, guidance or other actions that may severely impact the development, operations and growth of the OpenChat Platform and the adoption and utility of Cryptoassets.",
                                },
                            ],
                        },
                        {
                            number: "5)",
                            title: "Risks associated with the blockchain protocol",
                            body: [
                                {
                                    kind: "para",
                                    text: "Because Cryptoassets are based on blockchain protocols, any malfunction, breakdown or abandonment of a blockchain protocol may have a material adverse effect on Cryptoassets. Moreover, advances in cryptography, or technical advances such as the development of quantum computing, could present risks to Cryptoassets by rendering ineffective the cryptographic consensus mechanism that underpins the blockchain protocol.",
                                },
                            ],
                        },
                        {
                            number: "6)",
                            title: "Risk of hacking and software and security weaknesses",
                            body: [
                                {
                                    kind: "para",
                                    text: "Hackers or other malicious groups or organizations may attempt to interfere with Cryptoassets in a variety of ways, including malware attacks, denial of service attacks, consensus-based attacks, Sybil attacks, smurfing and spoofing, as well as attacks which overpower the consensus-based mechanism on which the blockchain in built and attacks which interfere with or otherwise cause nodes to malfunction (nodes are computers / hardware devices that help maintain the blockchain).",
                                },
                                {
                                    kind: "para",
                                    text: "There is also an inherent risk that the software and related technologies and theories we use could contain Viruses or Vulnerabilities. Viruses or Vulnerabilities could cause, inter alia, complete loss of Cryptoassets, or could negatively affect the OpenChat Platform.",
                                },
                            ],
                        },
                        {
                            number: "7)",
                            title: "Other potential risks applicable to Cryptoassets",
                            body: [
                                {
                                    kind: "para",
                                    text: "In addition to the risks included in this Schedule 1, there are other risks associated with dealing in Cryptoassets (including CHAT), including those that we cannot reasonably foresee. Additional risks may also materialize as unanticipated variations or combinations of the risks discussed above in this Schedule 1.",
                                },
                                {
                                    kind: "para",
                                    text: "Where you deal in any Cryptoasset you should take care to understand the risks involved. In this respect, we note some of the additional specific risks relevant to CHAT. In relation to Cryptoassets other than CHAT, it is usual for the issuer of the Cryptoasset to provide an explanation of the risks involved (or if they have not, this can be an indicator that a Cryptoasset is particularly risky as there has been a lack of consideration of the risks relevant to that Cryptoasset). By dealing in any Cryptoasset, you confirm to us that you have taken to time to understand, and accept, the risks involved (including in respect of the risks as explained by the issuer of the Cryptoasset).",
                                },
                            ],
                        },
                        {
                            number: "8)",
                            title: "Forks and Airdrops",
                            body: [
                                {
                                    kind: "para",
                                    text: "The underlying protocols of Cryptoassets may be subject to substantial changes in their operating rules (called a “forks”), and these may alter the value or function of a Cryptoasset. A fork may result in multiple versions of a Cryptoasset, leading to volatility as one version becomes dominant over another, which may lose its value.",
                                },
                                {
                                    kind: "para",
                                    text: "There may be additional distributions (called an “airdrop”) made to holders of a particular Cryptoasset, which may be a new variant of a Cryptoasset or a further quantity of the same Cryptoasset. The (anticipated) occurrence of an airdrop may impact the value of the Cryptoasset(s) affected by that airdrop.",
                                },
                            ],
                        },
                    ],
                },
                {
                    kind: "para",
                    text: "**CHAT specific risks**",
                },
                {
                    kind: "para",
                    text: "As noted elsewhere in these Terms, CHAT is not being structured or sold as securities nor any other form of regulated investment product. Accordingly, there has not been any consideration as to whether the CHAT is a suitable or an appropriate thing for you to deal in. In addition to the General Cryptoasset risks, you should be aware of the following risks in relation to CHAT specifically:",
                },
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1)",
                            title: "Lack of operating history",
                            body: [
                                {
                                    kind: "para",
                                    text: "Purchases of CHAT involve a high degree of risk. The value of CHAT is reliant on the success of us developing our business. As such, CHAT has all of the risks and uncertainties normally associated with a developing business, including in respect of potential difficulties operating the OpenChat Platform, lack of name recognition, lack of adequate capital to progress the business, and difficulties in complying with all Applicable Law. Financial and operational risks confronting start-ups are significant and we are not immune to these. The market in which we compete is highly competitive, and the percentage of companies that survive and prosper is small.",
                                },
                                {
                                    kind: "para",
                                    text: "Our lack of an operating history may make it difficult for you to evaluate our business and long-term operating prospects and the prospects of the OpenChat Platform in connection with acquiring CHAT. These risks include, but are not limited to, our ability to: (i) increase revenues and manage costs relating to the operation of the OpenChat Platform; (ii) increase awareness of the OpenChat Platform and CHAT; (iii) offer compelling content on the OpenChat Platform; (iv) maintain current and develop new strategic relationships; (v) respond effectively to competitive pressures; (vi) continue to develop and upgrade technology; and (vii) raise any additional capital as potentially required. There are no assurances that our business strategy will be successful, nor that we will address these risks successfully during the operation of the OpenChat Platform and CHAT.",
                                },
                            ],
                        },
                        {
                            number: "2)",
                            title: "Risks associated with uncertain regulation",
                            body: [
                                {
                                    kind: "para",
                                    text: "The regulatory status of the CHAT may be unclear or unsettled in certain jurisdictions. It is difficult to predict how or whether regulatory agencies may apply existing regulation with respect to CHAT and its applications, including the OpenChat Platform. It is likewise difficult to predict how or whether legislatures or regulatory agencies may implement changes to law and regulation affecting distributed ledger technology and its applications. Regulatory actions could negatively impact CHAT in various ways, including, for purposes of illustration only, through a determination that CHAT are a regulated financial instrument that require registration or licensing. We may cease operations in a jurisdiction in the event that regulatory actions, or changes to Applicable Law, make it illegal to operate in such jurisdiction, or commercially undesirable to obtain the necessary regulatory approval(s) to operate in such jurisdiction.",
                                },
                                {
                                    kind: "para",
                                    text: "More generally, the OpenChat Platform is pioneered on new and evolving technology, which increases legal complexity, particularly as the Applicable Law is subject to interpretation and change. This could result in a variety of adverse consequences, including civil penalties and fines as well as the requirement that some or all of our Services by restricted or prohibited in certain jurisdictions. These developments could have an adverse effect on the operations of the OpenChat Platform and the value of CHAT.",
                                },
                            ],
                        },
                        {
                            number: "3)",
                            title: "Legal proceedings and litigation",
                            body: [
                                {
                                    kind: "para",
                                    text: "From time to time, we may be involved in legal proceedings or litigation. The results of such legal proceedings and claims cannot be predicted with certainty and, regardless of the outcome, legal proceedings could have an adverse impact on our business, because of defence and settlement costs, diversion of resources, and other factors. Generally, if third parties are successful in their claims, we may have to pay substantial damages, account for profits derived from the alleged infringing acts, and cease to use certain technologies or take other actions that could be detrimental to our business. If there is an intellectual property infringement claim, or to avoid such claims, we may be prohibited from selling or licensing to others some or all Services we develop, unless the patent or copyright holder grants a license of the relevant intellectual property to us, which the patent or copyright holder is not obligated to do. There also may be adverse publicity associated with litigation that could negatively affect people’s perception of us, the OpenChat Platform and/or CHAT, regardless of whether the allegations are valid or we are ultimately found liable. Accordingly, litigation may adversely affect our business and financial condition.",
                                },
                            ],
                        },
                        {
                            number: "4)",
                            title: "Intellectual property",
                            body: [
                                {
                                    kind: "para",
                                    text: "Companies, organisations, or individuals, including competitors, may hold or obtain patents, trademarks, or other proprietary rights that would prevent, limit, or interfere with our ability to make, use, develop, sell, and / or market CHAT and / or the OpenChat Platform, which could make it more difficult for us to operate our business. These third parties may have applied for, been granted, or obtained, patents that relate to intellectual property, and which compete with our intellectual property or technology. This may require us to develop or obtain alternative technology, or obtain appropriate licenses under these patents, which may not be available on acceptable terms or at all. Such a circumstance may result in us having to significantly increase development efforts and resources to redesign the technology in order for us to safeguard our competitive edge against competitors in the same industry. There is a risk that our means of protecting intellectual property rights may not be adequate, and weaknesses or failures in this area could adversely affect our business or reputation, financial condition, the operations of the OpenChat Platform and the development of CHAT.",
                                },
                                {
                                    kind: "para",
                                    text: "From time to time, we may receive communications from holders of patents or trademarks regarding their proprietary rights. Companies holding patents or other intellectual property rights may bring suits alleging infringement of such rights or otherwise assert their rights and urge us to take licenses. In addition, if we are determined to have infringed upon a third party's intellectual property rights, we may be required to cease operating the OpenChat Platform or certain Services, pay substantial damages, seek a license from the holder of the infringed intellectual property right (which license may not be available on reasonable terms or at all), and/or establish and maintain alternative branding for items relating to the OpenChat Platform and our Services. We may need to file lawsuits to protect our intellectual property rights from infringement from third parties, which could be expensive, time consuming, and distract management's attention from our core operations.",
                                },
                                {
                                    kind: "para",
                                    text: "Our ability to serve our customers and the OpenChat Platform’s participants will depend upon our intellectual property. The steps we take to protect our intellectual property rights may be inadequate. In order to protect our intellectual property rights, we may be required to spend significant resources to monitor and protect these rights. Litigation brought to protect and enforce our intellectual property rights could be costly, time-consuming and distracting to management and could result in the impairment or loss of portions of our intellectual property. Furthermore, our efforts to enforce our intellectual property rights may be met with defences, counterclaims, and countersuits attacking the validity and enforceability of our intellectual property rights. Our failure to secure, protect, and enforce our intellectual property rights could seriously harm the CHAT brand and adversely affect the development of the CHAT.",
                                },
                            ],
                        },
                        {
                            number: "5)",
                            title: "CHAT will have no refund rights or similar features and may have limited liquidity",
                            body: [
                                {
                                    kind: "para",
                                    text: "After issuance, to the extent permitted by Applicable Law you will have no right to return your CHAT to us or to receive a refund or otherwise require us to exchange CHAT for a certain value. As a result, if there is not sufficient demand or interest in the OpenChat Platform and CHAT, or if there are limits on the transferability of, or limited liquidity for, CHAT, then you may lose all or a portion of your investment.",
                                },
                            ],
                        },
                        {
                            number: "6)",
                            title: "Future distribution of CHAT and other types of token",
                            body: [
                                {
                                    kind: "para",
                                    text: "The distribution by us of a substantial number of CHAT or additional types of token could have an adverse effect on the value of CHAT. Any distribution of CHAT could dilute your percentage interest in then-outstanding CHAT, if any, and have an adverse effect on the market value of the CHAT. Additional new types of cryptoasset may also impact the value of CHAT, and you have no rights in relation to such new types of cryptoasset as a result of entering into these Terms.",
                                },
                            ],
                        },
                        {
                            number: "7)",
                            title: "Funding",
                            body: [
                                {
                                    kind: "para",
                                    text: "We intend to use the amounts received from CHAT holders to fund the development of our business and the OpenChat Platform. Amounts received from CHAT holders may be converted into other cryptoassets or fiat currencies. If the value of cryptoassets or fiat currencies fluctuate unfavourably this may mean that we may not be able to fund business development and deployment as expected or may not be able to develop the OpenChat Platform in the manner it intended, which may consequently impact the value of CHAT.",
                                },
                            ],
                        },
                        {
                            number: "8)",
                            title: "Lack information for monitoring their CHAT",
                            body: [
                                {
                                    kind: "para",
                                    text: "You may not be able to obtain all information you want from time to time regarding the OpenChat Platform and / or CHAT. Even if you do receive such information, you may not receive it on a timely basis. It is possible that you may not be aware of materially adverse changes that have occurred with respect to the OpenChat Platform and/or CHAT in a timely manner. As a result of these difficulties, as well as other uncertainties, you may not have accurate or accessible information relating to your purchase, which could prevent you from taking actions with the potential to prevent adverse consequences relating to your holding of CHAT.",
                                },
                            ],
                        },
                        {
                            number: "9)",
                            title: "CHAT may not be classified as unregulated",
                            body: [
                                {
                                    kind: "para",
                                    text: "Although we intend for CHAT to be classified as unregulated, the regulatory position of cryptoassets can be uncertain and subject to change. This may, at a later date, cause us to reclassify CHAT as a security, in which case CHAT may be subject to restrictions on resale and transfer.",
                                },
                            ],
                        },
                        {
                            number: "10)",
                            title: "Voting power",
                            body: [
                                {
                                    kind: "para",
                                    text: "Whilst CHAT allows CHAT holders to participate in the governance of the OpenChat DAO by voting on proposals, each CHAT holder’s voting power is proportional to the amount of CHAT they have deposited and locked. As such, there is a risk that a small number of CHAT holders may be able to exercise the majority of the voting power from time to time, meaning that other holders of CHAT cannot effectively influence the governance of the OpenChat DAO, and devaluing the CHAT they hold.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "9",
            title: "Schedule 2: Content Standards",
            blocks: [
                {
                    kind: "para",
                    text: "A Contribution must comply with Applicable Law. In addition, the Content Standards below must be complied with in spirit as well as to the letter. The Content Standards apply to each part of any Contribution as well as to its whole. We will determine, at our discretion, whether a Contribution breaches the Content Standards.",
                },
                {
                    kind: "para",
                    text: "A Contribution must not:",
                },
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "threaten to harm another individual or group of people. This includes direct, indirect, and suggestive threats.",
                                },
                            ],
                        },
                        {
                            number: "2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "solicit, share, or make attempts to distribute content that depicts, promotes, or attempts to normalise child sexual abuse.",
                                },
                            ],
                        },
                        {
                            number: "3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "post content that in any way sexualises children.",
                                },
                            ],
                        },
                        {
                            number: "4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "share sexually explicit or sexually suggestive content without the subject’s knowledge and consent, otherwise known as “revenge porn”. This includes the non-consensual distribution of intimate media that was created either with or without an individual’s consent.",
                                },
                            ],
                        },
                        {
                            number: "5)",
                            body: [
                                {
                                    kind: "para",
                                    text: "contain pornographic or otherwise sexually explicit material. Such material is prohibited on all parts of the OpenChat Platform for all users, in public and private Groups, Channels and direct chats alike, and regardless of any labelling or rules applied to a Group or Community.",
                                },
                            ],
                        },
                        {
                            number: "6)",
                            body: [
                                {
                                    kind: "para",
                                    text: "share content that glorifies, promotes, normalises, or provides instructions for suicide or other acts of physical self-harm. This includes content that encourages others to cut, burn, or starve themselves, as well as content that normalizes eating disorders, such as anorexia and bulimia. Self-harm acts or threats used as a form of emotional manipulation or coercion are also prohibited.",
                                },
                            ],
                        },
                        {
                            number: "7)",
                            body: [
                                {
                                    kind: "para",
                                    text: "share real media depicting gore, excessive violence, or animal harm, especially with the intention to harass or shock others.",
                                },
                            ],
                        },
                        {
                            number: "8)",
                            body: [
                                {
                                    kind: "para",
                                    text: "promote, coordinate, or execute financial scams. Promoting a particular crypto token or NFT does not break this rule in general.",
                                },
                            ],
                        },
                        {
                            number: "9)",
                            body: [
                                {
                                    kind: "para",
                                    text: "be sent persistently as a spam message. This includes repeatedly sending the same or meaningless messages, either in the same chat or across multiple chats.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "10",
            title: "Schedule 3: Chat features",
            blocks: [
                {
                    kind: "para",
                    text: "**PLEASE NOTE THAT THE BELOW REPRESENTS FEATURES OF CHAT AS AT THE CURRENT DATE OF THESE TERMS. HOWEVER, THERE MAY BE LEGAL, REGULATORY OR COMMERCIAL REASONS WHY CHAT FEATURE MAY IN THE FUTURE CHANGE FROM THE BELOW.**",
                },
                {
                    kind: "para",
                    text: "CHAT gives CHAT holders the following rights:",
                },
                {
                    kind: "para",
                    text: "CHAT may be:",
                },
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "deposited and locked as neurons to participate in the OpenChat DAO governance by voting on proposals;",
                                },
                            ],
                        },
                        {
                            number: "2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "distributed as a voting reward in accordance with the DAO governance rules as set out at https://oc.app/blog/governance.",
                                },
                            ],
                        },
                        {
                            number: "3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "used to purchase a Diamond Membership; and",
                                },
                            ],
                        },
                        {
                            number: "4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "used to gain access to additional features that we may, at our discretion, make available from time to time.",
                                },
                            ],
                        },
                    ],
                },
                {
                    kind: "para",
                    text: "Please see Section G: Participating in OpenChat DAO to find out where you can obtain information on the OpenChat DAO.",
                },
                {
                    kind: "para",
                    text: "**Please note that we have no obligation to give CHAT any rights or attributes other than those outlined above, and CHAT shall not give you any rights in relation to any aspect of any business conducted at any time by us other than as explicitly stated above.**",
                },
            ],
        },
        {
            id: "11",
            title: "Schedule 4: Multiple accounts",
            blocks: [
                {
                    kind: "para",
                    text: "You may not buy or sell OpenChat accounts, nor may you create multiple accounts on the OpenChat Platform:",
                },
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "that you aren't actively using",
                                },
                            ],
                        },
                        {
                            number: "2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "to squat on usernames with the intention of selling them",
                                },
                            ],
                        },
                        {
                            number: "3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "to farm tokens",
                                },
                            ],
                        },
                        {
                            number: "4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "to give the appearance of activity in a group/community",
                                },
                            ],
                        },
                        {
                            number: "5)",
                            body: [
                                {
                                    kind: "para",
                                    text: "to DoS the platform or otherwise drain platform resources",
                                },
                            ],
                        },
                        {
                            number: "6)",
                            body: [
                                {
                                    kind: "para",
                                    text: "any other nefarious purpose",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};
