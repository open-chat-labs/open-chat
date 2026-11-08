import type { LearnDoc } from "@openchat/ui/src/pages/learnContent";

// The OpenChat Privacy Notice, converted word for word from the old PrivacyContent.svelte. The one copy of the
// notice: the web's /privacy shows it (MarketingScreen), and so does the old desktop page
// (components/landingpages/PrivacyContent.svelte). A section's id is its old `?section=` id (the old headings'
// numbers, "1. Who is responsible …", are the doc's own). A clause's number is written as the old page showed it.
export const privacy: LearnDoc = {
    kicker: "Legal",
    title: "OpenChat Privacy Notice",
    intro: [
        "This notice explains what personal data is processed when you use the OpenChat Platform, why it is processed, who it is shared with and what rights you have. It supplements the [OpenChat Terms and Conditions](/terms), and should be read alongside clause B 6 of those Terms, which describes safety, moderation and reporting.",
        "The OpenChat Platform runs entirely on the Internet Computer blockchain. That has real consequences for your privacy which are explained in section 3, and which differ from those of a conventional messaging service.",
    ],
    sections: [
        {
            id: "1",
            title: "Who is responsible for your data",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "1.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "The OpenChat Platform is operated by OpenChat DAO, a decentralised autonomous organisation running on the Internet Computer. OpenChat DAO is the controller in respect of the ordinary operation of the OpenChat Platform.",
                                },
                            ],
                        },
                        {
                            number: "1.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: 'Moderation, enforcement and other safety functions, including reporting to authorities, are performed by [OpenChat Labs Ltd](https://openchatlabs.org), a company registered in England and Wales with company number 14871398 ("**OpenChat Labs**"). OpenChat Labs is the controller in respect of the processing described in section 5 of this notice.',
                                },
                            ],
                        },
                        {
                            number: "1.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "OpenChat Labs is the contact point for this notice as a whole, including for the processing OpenChat DAO controls: a decentralised autonomous organisation cannot receive correspondence directly, so requests which concern the ordinary operation of the OpenChat Platform are received and acted on by OpenChat Labs.",
                                },
                            ],
                        },
                        {
                            number: "1.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "You can contact OpenChat Labs about anything in this notice, including any request to exercise your rights, at **safety@openchatlabs.org**. That address does not require access to an OpenChat account.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "2",
            title: "What we process",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "2.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Account identifiers.** When you register, a principal derived from your chosen sign-in method (such as Internet Identity, a passkey, an email sign-in or a supported crypto wallet) and an OpenChat user identifier are associated with your account, together with the username, and any display name and profile image you choose. These identifiers are pseudonymous: we do not require your legal name or identity documents.",
                                },
                            ],
                        },
                        {
                            number: "2.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Sign-in data.** If you use email sign-in, or add an email address for account recovery, that address is used to send you sign-in links and to link your sign-in method to your account. Our sign-in canister stores it only in salted-hashed form, and it is passed to our email delivery provider in order to send you the link. If you sign in with a crypto wallet, the sign-in canisters process your wallet address.",
                                },
                            ],
                        },
                        {
                            number: "2.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Content you send.** Messages, media and reactions you send, and the groups, communities and channels you belong to.",
                                },
                            ],
                        },
                        {
                            number: "2.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Account activity.** Records needed to operate the Platform, such as Diamond membership status and payments, wallet transactions you initiate, referrals, achievements, activity streaks and the version of the Terms you have accepted and when.",
                                },
                            ],
                        },
                        {
                            number: "2.5)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Safety records.** Where content is reported or detected, a moderation record is created. This is described in section 5.",
                                },
                            ],
                        },
                        {
                            number: "2.6)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**What we do not collect.** We do not collect phone numbers, legal names or identity documents. The canisters which hold your account and messages do not receive or record IP addresses. Like any internet service, the infrastructure and services which deliver the Platform (see sections 3 and 6) see network data such as IP addresses when your device connects to them, but no OpenChat account record contains one, and we cannot produce data we do not hold.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "3",
            title: "What running on a blockchain means for your data",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "3.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Your data is held in canister smart contracts on the Internet Computer, and is replicated across the independently operated nodes of the subnet hosting each canister. Node providers necessarily hold a copy of that replicated state.",
                                },
                            ],
                        },
                        {
                            number: "3.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Content posted to public groups, communities and channels is publicly readable by anyone, including people who do not have an OpenChat account, and may be copied, indexed or retained by third parties beyond our control.",
                                },
                            ],
                        },
                        {
                            number: "3.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Messages are not end-to-end encrypted. Message content is held in the canisters which host the relevant chat.",
                                },
                            ],
                        },
                        {
                            number: "3.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Deleting a message removes its content from the canister which holds it. Data which has already been replicated, copied or archived elsewhere - including by other users, by node providers, or in the case of public content by anyone who has read it - cannot be recalled by us. Where content is preserved as evidence under section 5, deletion is deferred for the period described there.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "4",
            title: "Why we process it, and on what legal basis",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "4.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**To provide the Platform** - delivering your messages, maintaining your account, groups and memberships, and processing Diamond membership and wallet operations you initiate. Legal basis: performance of our contract with you (Article 6(1)(b) UK GDPR).",
                                },
                            ],
                        },
                        {
                            number: "4.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**To keep the Platform working and secure** - preventing abuse, spam and attacks on the service. Legal basis: our legitimate interests in the security and integrity of the Platform (Article 6(1)(f)).",
                                },
                            ],
                        },
                        {
                            number: "4.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**To understand usage and fix problems** - usage analytics and error reporting, as described in section 6. Legal basis: our legitimate interests in operating and improving the Platform (Article 6(1)(f)).",
                                },
                            ],
                        },
                        {
                            number: "4.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**To meet our safety obligations** - the moderation, evidence preservation and authority reporting described in section 5. Legal basis: compliance with legal obligations to which OpenChat Labs is subject (Article 6(1)(c)), including the UK Online Safety Act 2023.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "5",
            title: "Safety, moderation and automated decisions",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "5.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Classification.** Messages sent to public groups and channels, including text and media, are subject to automated classification for safety purposes. Private messages are never proactively scanned; the content of a private message is classified only if a recipient reports it. What is sent to the classification provider is the message content - the text and the addresses of any attached media; we do not attach account, chat or message identifiers to the request.",
                                },
                            ],
                        },
                        {
                            number: "5.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**The logic involved.** The classifier returns a set of content categories and a confidence score for each. Where content is classified as child sexual abuse material, it is removed immediately and the sending account is suspended, before any human sees it, and the case is then put to a human moderator. Where content is classified in any other prohibited category above a configured confidence threshold, it is referred to a human moderator and no sanction is applied to the content or the account unless that moderator upholds the referral. A moderator can uphold a case, uphold it as child sexual abuse material, or dismiss it.",
                                },
                            ],
                        },
                        {
                            number: "5.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Consequences.** The consequences of an upheld case are removal of the content and suspension of the account - for a fixed period, or indefinitely for child sexual abuse material or repeated violations. A dismissed case is reversed in full: the content is restored, the suspension is lifted, and you are told the decision and why.",
                                },
                            ],
                        },
                        {
                            number: "5.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Your right to human review.** Where a decision affecting your account was made by an automated system, you have the right under Article 22 UK GDPR not to be subject to it: you may contest it and require that a person reviews it. The means to do so is provided with the sanction notice and remains available while your account is suspended.",
                                },
                            ],
                        },
                        {
                            number: "5.5)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Criminal offence data.** Moderation necessarily involves processing data relating to suspected criminal offences. OpenChat Labs processes this under Article 10 UK GDPR and the substantial public interest conditions in Schedule 1 to the Data Protection Act 2018, in particular the prevention and detection of unlawful acts and the protection of children.",
                                },
                            ],
                        },
                        {
                            number: "5.6)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Evidence preservation.** Where suspected child sexual abuse material is detected, a copy of the media is preserved as evidence in access-restricted storage. Access to it is limited to a small number of specifically designated reviewers, every access is recorded in a tamper-evident log which identifies the reviewer, and the recorded content is never served publicly.",
                                },
                            ],
                        },
                        {
                            number: "5.7)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Moderation records.** A record of each case is kept: the identifiers of the sender and of anyone who reported it, an excerpt of any text concerned, what the classifier returned, what a moderator decided and when, whether the decision was contested, and whether a report was made to an authority. Reports asserting child sexual abuse material which a moderator dismisses are recorded against the person who made them.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "6",
            title: "Who your data is shared with",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "6.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Other users.** Anyone in a group, community or channel you post to; and, for public spaces, the general public.",
                                },
                            ],
                        },
                        {
                            number: "6.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Internet Computer node providers**, who host the replicated canister state as described in section 3.",
                                },
                            ],
                        },
                        {
                            number: "6.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Safety processors.** Text classification is currently performed by OpenAI; message media is not sent to OpenAI. Media attachments posted to public groups and to public channels of public communities are checked against databases of known child sexual abuse material using PhotoDNA technology licensed by Microsoft at no cost. The matching service receives only a non-reversible perceptual hash of the media, never the media itself, and where media does not match, nothing is retained from the check. Microsoft's handling of the matching service's own records is described in the Microsoft privacy statement.",
                                },
                            ],
                        },
                        {
                            number: "6.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Feature service providers.** Some features are delivered using third-party services, which receive the data needed to provide the feature, together with network data such as your IP address. In particular: video and voice calls are provided by a specialist video-calling service, which receives your username and the call's audio and video; message translation, when you request it, sends the message text to a translation service (currently Google Translate); GIF search sends your search terms to the GIF provider; sign-in emails are delivered via our email provider; push notifications are delivered through your device platform's notification service, which processes the notification content in order to display it; connecting a crypto wallet involves the relevant wallet and blockchain services; establishing calls and direct-chat connections uses connection-relay services; and we use an IP-geolocation service to determine your approximate country in order to apply regional restrictions.",
                                },
                            ],
                        },
                        {
                            number: "6.5)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Analytics and error reporting.** The OpenChat Platform uses an analytics service running on the Internet Computer (Usergeek), which receives pseudonymous usage events, and the website uses an error-reporting service (currently Rollbar), which receives technical data about errors, including IP addresses.",
                                },
                            ],
                        },
                        {
                            number: "6.6)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Bots.** If you interact with a third-party bot, your command and your OpenChat user identifier are sent to that bot's operator.",
                                },
                            ],
                        },
                        {
                            number: "6.7)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**Authorities.** Detected child sexual exploitation and abuse content, together with associated account data, is reported to the relevant authorities, including the UK National Crime Agency and, where applicable, the US National Center for Missing and Exploited Children, as required by law. We may also disclose data in response to a lawful request, so far as we hold it - see section 2 for what we do not hold.",
                                },
                            ],
                        },
                        {
                            number: "6.8)",
                            body: [
                                {
                                    kind: "para",
                                    text: "**International transfers.** Internet Computer nodes and the service providers described above are located in a number of countries, including the United States. Where data leaves the UK, transfers are made under the safeguards required by data protection law, such as the UK International Data Transfer Agreement or Addendum.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "7",
            title: "How long it is kept",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "7.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Account data is kept while your account exists. Message content is kept until it is deleted, subject to section 3.",
                                },
                            ],
                        },
                        {
                            number: "7.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Preserved child sexual abuse material evidence is kept for the period required by law - typically one year from the report to an authority - and is then deleted automatically. Where a legal preservation request applies, deletion is suspended until that request is lifted; where an authority requires destruction, the evidence is destroyed on request. The access log, which contains no content, survives the evidence it records.",
                                },
                            ],
                        },
                        {
                            number: "7.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Moderation records and records of reports made to authorities are kept for as long as needed to evidence compliance with our safety duties.",
                                },
                            ],
                        },
                        {
                            number: "7.4)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Content which is quarantined pending a moderation decision, or preserved in connection with a report to an authority, is exempt from deletion requests while those obligations require its retention (Article 17(3)(b) UK GDPR). Where media is checked against child sexual abuse material databases and does not match, nothing is retained from the check.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "8",
            title: "Your rights",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "8.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "You have the right to ask for access to your personal data, to have inaccurate data corrected, to have data erased, to restrict or object to processing, to data portability, and not to be subject to solely automated decisions with significant effects. To exercise any of these, contact **safety@openchatlabs.org**.",
                                },
                            ],
                        },
                        {
                            number: "8.2)",
                            body: [
                                {
                                    kind: "para",
                                    text: "Some of these rights are limited in ways you should understand before relying on them. We cannot erase data which has already been replicated across node providers, copied by other users, or published publicly. We cannot erase or restrict preserved evidence or moderation records where doing so would breach our legal obligations. Where a matter has been reported to an authority, we may be prevented by law from confirming that fact to you.",
                                },
                            ],
                        },
                        {
                            number: "8.3)",
                            body: [
                                {
                                    kind: "para",
                                    text: "If you are unhappy with how your data has been handled, you may complain to us at **safety@openchatlabs.org** or to the UK Information Commissioner's Office at [ico.org.uk](https://ico.org.uk).",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "9",
            title: "Changes to this notice",
            blocks: [
                {
                    kind: "clauses",
                    items: [
                        {
                            number: "9.1)",
                            body: [
                                {
                                    kind: "para",
                                    text: "We may update this notice. Where a change materially affects how your data is processed, we will bring it to your attention in the OpenChat Platform.",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};
