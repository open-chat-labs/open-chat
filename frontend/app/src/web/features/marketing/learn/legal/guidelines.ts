import type { LearnDoc } from "@openchat/ui/src/pages/learnContent";

// The OpenChat Guidelines, converted word for word from the old GuidelinesContent.svelte. The one copy of the
// guidelines: the web's /guidelines shows it (MarketingScreen), and so does the old desktop page
// (components/landingpages/GuidelinesContent.svelte). A section's id is its old `?section=` id:
// /guidelines?section=3 is the platform rules, which the backend's report replies link to.
export const guidelines: LearnDoc = {
    kicker: "Legal",
    title: "OpenChat Guidelines",
    sections: [
        {
            id: "1",
            title: "Introduction",
            blocks: [
                {
                    kind: "para",
                    text: "OpenChat aims to be an open, productive, enjoyable and safe place for everyone to come together, create and share content and chat. To preserve these values we ask that users of the system comply with a set of common sense guidelines.",
                },
                {
                    kind: "para",
                    text: "All content posted by users on OpenChat is user-generated content, and OpenChat does not control or endorse the content posted by users. Content that does not comply with our guidelines may be removed by platform moderators and the users that post such content may be suspended.",
                },
            ],
        },
        {
            id: "2",
            title: "High level guidance",
            blocks: [
                {
                    kind: "para",
                    text: "OpenChat is governed by its DAO, and our rules revolve around protecting the service and protecting the users, as well as meeting the legal obligations that apply to a messaging platform (see the [terms](/terms) for details). Ask yourself - does my post threaten the existence of the system itself (e.g. would it be considered illegal in most jurisdictions)? Or is my post harmful to other users (e.g. does it promote a scam or invite harassment). These are the high level principles that will be applied to moderation.",
                },
                {
                    kind: "para",
                    text: "These rules apply to all groups whether public or private but we also take the privacy of our users extremely seriously and therefore cannot perform active moderation on content in private groups.",
                },
            ],
        },
        {
            id: "3",
            title: "Content Standards",
            blocks: [
                {
                    kind: "bullets",
                    items: [
                        "**Do not threaten to harm another individual or group of people.** This includes direct, indirect, and suggestive threats.",
                        "**Do not solicit, share, or make attempts to distribute content that depicts, promotes, or attempts to normalize child sexual abuse.** Also, do not post content that in any way sexualizes children.",
                        "**Do not share sexually explicit or sexually suggestive content of other people without the subject’s knowledge and consent, otherwise known as “revenge porn.”** This includes the non-consensual distribution of intimate media that was created either with or without an individual’s consent.",
                        "**Do not share content that glorifies, promotes, or normalizes suicide or other acts of physical self-harm.** This includes content that encourages others to cut, burn, or starve themselves, as well as content that normalizes eating disorders, such as anorexia and bulimia. Self-harm acts or threats used as a form of emotional manipulation or coercion are also prohibited.",
                        "**Do not share real media depicting gore, excessive violence, or animal harm, especially with the intention to harass or shock others.**",
                        "**Do not use OpenChat to promote, coordinate, or execute financial scams.** Promoting a particular crypto token or NFT does not break this rule in general.",
                        "**Do not persistently send spam messages.** This includes repeatedly sending the same or meaningless messages, either in the same chat or across multiple chats.",
                    ],
                },
            ],
        },
        {
            id: "4",
            title: "Account creation and usage",
            blocks: [
                {
                    kind: "para",
                    text: "It is against the platform guidelines to buy or sell accounts, or to create multiple accounts:",
                },
                {
                    kind: "bullets",
                    items: [
                        "that you aren't actively using",
                        "to squat on usernames with the intention of selling them",
                        "to farm tokens",
                        "to give the appearance of activity in a group/community",
                        "to DoS the platform or otherwise drain platform resources",
                        "any other nefarious purpose",
                    ],
                },
                {
                    kind: "para",
                    text: "Breaking these rules will likely result in the multiple accounts being suspended.",
                },
            ],
        },
        {
            id: "5",
            title: "Group rules",
            blocks: [
                {
                    kind: "para",
                    text: "In addition to the platform content standards rules, we urge group owners to enable group rules and make it very clear what standards you expect to be upheld in your group. When you join a group, please read those rules carefully and keep in mind that they will be consulted in moderation decisions.",
                },
                {
                    kind: "para",
                    text: "Group owners are also encouraged to create a trusted team of admins and moderators who are prepared to help to moderate the group.",
                },
                {
                    kind: "para",
                    text: '**Adult material is not permitted on OpenChat. Pornographic or otherwise sexually explicit content is against our platform rules everywhere on the platform - in public and private groups and communities and in direct chats - for all users, regardless of how a group is labelled or what its rules say.** This also applies to all other "primary priority content" as defined by the UK Online Safety Act 2023: content encouraging, promoting or providing instructions for suicide, deliberate self-injury, or eating disorders.',
                },
                {
                    kind: "para",
                    text: "Such content will be removed, and repeat or serious breaches will lead to account suspension. If your group or community previously carried adult material under the old labelling guidance, you must remove that content. Owners of previously adult-labelled communities will be notified when the updated terms take effect and will have 28 days to remove such content or close the community.",
                },
            ],
        },
        {
            id: "6",
            title: "Content moderation process",
            blocks: [
                {
                    kind: "para",
                    text: "If you see content in a public group which you think violates the group's rules then your first option should be to appeal to the group owners. If you feel like content violates the platform's content standards, you should report the content to the platform moderators via the message’s context menu.",
                },
                {
                    kind: "para",
                    text: "The message content will then be referred to the platform moderators for review.",
                },
                {
                    kind: "para",
                    text: "In addition, content sent to public groups and channels is subject to automated classification for the most serious categories of harmful content, with human review and a right to contest any automated decision, as described in the [terms](/terms).",
                },
                {
                    kind: "para",
                    text: "The platform moderators will refer to the platform content standards and group rules and make a decision on the action to take as a group. The action taken may be one or more of the following:",
                },
                {
                    kind: "bullets",
                    items: [
                        "Delete the content",
                        "Freeze the group",
                        "Delete the group",
                        "Suspend the user who posted the content",
                    ],
                },
                {
                    kind: "para",
                    text: "We rely significantly on judgement and good intentions of those involved at this stage. In the future we hope and plan to further align incentives through tokenization. For example, a report which is upheld could be rewarded with tokens. Also platform moderators who vote with the consensus should be rewarded with tokens.",
                },
                {
                    kind: "para",
                    text: "We can also envisage using tokenization to disincentivize spurious reports.",
                },
            ],
        },
        {
            id: "7",
            title: "Governance",
            blocks: [
                {
                    kind: "para",
                    text: "An alternative view is that content moderation should only be done via SNS proposal. Our view is that an SNS proposal is designed to (agree to) change the system in some way. Moderation does not require a change to the system. It merely requires the use of existing tools and mechanisms. The exact nature of those tools and mechanisms should of course be under the control of the SNS and managed by SNS proposal. For example, it would be appropriate to make a proposal to change these guidelines or to appoint a new platform moderator.",
                },
                {
                    kind: "para",
                    text: "Furthermore, to attempt to perform moderation via proposal would force everyone to be a moderator and that is not a job that everyone wants or should be expected to perform. As such we believe that it is better to have a clear set of guidelines so that platform moderators can make quick and fair decisions.",
                },
            ],
        },
        {
            id: "8",
            title: "Full terms",
            blocks: [
                {
                    kind: "para",
                    text: "You can view the full terms of use of OpenChat [here](/terms).",
                },
            ],
        },
    ],
};
