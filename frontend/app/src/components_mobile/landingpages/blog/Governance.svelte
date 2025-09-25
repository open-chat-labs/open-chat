<script lang="ts">
    import ExternalLink from "../ExternalLink.svelte";
    import Link from "../Link.svelte";
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <h2>Introduction</h2>
    <p>
        Now that OpenChat is controlled by an SNS you might be wondering how to take part in the
        governance of OpenChat and earn voting rewards. In this blog post we'll summarise the key
        concepts and also give some step by step guides.
    </p>
    <p>
        A good place to start to understand more about SNS DAOs is the article <ExternalLink
            href="https://internetcomputer.org/sns/faq"
            >What you need to know about SNS DAOs</ExternalLink
        >.
    </p>
    <p>
        The dev team beacon neuron id is<br />
        <code>9adf350c7388dfe7277213a5fc8d817c2d5bc6ff6be5870f0d33d9d6dab01fc6</code>
    </p>
</section>
<section>
    <h2>Neurons</h2>
    <p>
        CHAT neurons are very similar in their function to ICP neurons. They allow users to
        “time-lock” their CHAT tokens to gain voting power, which can be used to vote on proposals
        submitted to the SNS. Neurons can be made to follow each other in various ways such that
        they vote automatically, representing a form of <ExternalLink
            href="https://en.wikipedia.org/wiki/Liquid_democracy">liquid democracy</ExternalLink
        >.
    </p>
    <p>
        Users can also <em>dissolve</em> their neurons to release the CHAT tokens inside the neuron.
    </p>
    <BlogScreenshot
        caption="Your CHAT neurons in the NNS dApp"
        desktopUrl={"/assets/blog/desktop_neurons.png"}
        mobileUrl={"/assets/blog/mobile_neurons.png"} />
</section>

<section>
    <h2>Proposals</h2>
    <p>
        Changes to the OpenChat SNS, which include the SNS treasury of ICP and CHAT tokens, the
        various tokenomic parameters, and the OpenChat dapp itself, can only be made by the OpenChat
        SNS governance canister upon successful execution of <em>proposals</em>.
    </p>
    <p>
        Other than "Motion" proposals all other types result in some automatic action by the SNS
        such as...
    </p>
    <ul>
        <li>Transfer ICP or CHAT out of the treasury</li>
        <li>Upgrade an OpenChat canister</li>
        <li>Change SNS meta data such as the "proposal rejection cost"</li>
        <li>Call a custom SNS function for example to add a "platform moderator"</li>
    </ul>
    <p>
        Join <Link path="nsbx4-4iaaa-aaaar-afusa-cai">this group</Link> to view, discuss, and vote on
        OpenChat SNS proposals. Press the filter icon to see the full list of proposal types and to filter
        by them.
    </p>
    <p>
        Anyone who owns a neuron can use it to make proposals although this currently requires
        knowledge of the command line tools <ExternalLink href="https://github.com/dfinity/sdk"
            >dfx</ExternalLink> and <ExternalLink
            href="https://github.com/dfinity/quill/blob/master/docs/cli-reference/sns/quill-sns-make-proposal.md"
            >quill</ExternalLink
        >. In time this process should become easier. If a proposal is rejected then 10 CHAT tokens
        are subtracted from the proposing neuron and burned to discourage spam.
    </p>
    <BlogScreenshot
        caption="Governance proposals in OpenChat"
        desktopUrl={"/assets/blog/desktop_voting.png"}
        mobileUrl={"/assets/blog/mobile_voting.png"} />
</section>
<section>
    <h2>Dev team proposals</h2>
    <p>
        Before working on a substantial new feature or other change to OpenChat the dev team will
        describe their plan as a message in the <Link path="n2qig-viaaa-aaaar-ahviq-cai"
            >OpenChat Governance</Link> group. This is gated to CHAT neuron holders and we invite anyone
        who plans to submit a proposal, to introduce it here first for discussion.
    </p>
    <p>
        Having talked through the feature and explored different options we can then use a poll
        message with the various options and members can vote. Once some sort of consensus has been
        reached we will make a motion proposal describing the change and the SNS DAO can decide
        whether we should go ahead with it. Later on when the feature/change has been coded we will
        make an upgrade proposal for each canister affected.
    </p>
    <p>
        Alongside <em>substantial</em> features/changes the dev team will also work on smaller features/fixes/code
        improvements/changes on our own initiative without necessarily go through the above procedure.
        Of course all changes to the dapp ulitmately need to be made using upgrade proposals.
    </p>
</section>
<section>
    <h2>Voting</h2>
    <p>
        You can vote to "adopt" or "reject" any proposals with any eligible neurons you own. This
        allows you take part in the governance of OpenChat and help steer it in a direction of your
        choosing while also earning voting rewards - see bottom section. To be eligible to vote on a
        given proposal a neuron must exist and have a dissolve delay of at least 1 month at the time
        the proposal was made.
    </p>
    <p>
        For any given proposal, your percentage vote contribution is calculated as the ratio of the <em
            >voting power</em>
        of your neurons compared to all other eligible neurons. Voting power for a neuron is calculated
        as (stake x dissolve delay bonus x age bonus). The dissolve delay bonus starts at 1 for a neuron
        with 0 dissolve delay and rises linerarly to 2 for neurons with a dissolve delay of 1 year. The
        age bonus starts at 1 for neurons with 0 age, climbing to 1.25 for neurons with an age of 6 months.
        To <em>age</em> a neuron must be kept in the undissolving state but as soon it starts dissolving
        the age resets to 0. For example if you have a neuron with a stake of 1000 CHAT tokens, a dissolve
        delay of 1 year, and an age of 6 months its voting power will be 2500.
    </p>
    <p>
        For a proposal to be adopted the sum of the voting power of the “adopt” votes must exceed
        the sum of the voting power of the “reject” votes after 4 days or after a period of quiet.
        Also the “adopt” votes must have at least 3% of the total voting power. The vote will end
        immediately if either the “adopt” or “reject” votes exceed 50% of available voting power. It
        is possible to participate in a vote for a proposal if still within the 4 day period even if
        it has already been resolved. This is so the neuron can still be a beneficiary of voting
        rewards.
    </p>
</section>
<section>
    <h2>Vote using OpenChat</h2>
    <p>
        At the time of writing the easiest way to vote is from within OpenChat. Coming soon it will
        also be possible to vote from the NNS dapp. If you took part in the decentralization sale
        using the NNS dapp your CHAT neurons will be controlled by your <em>NNS dapp principal</em>.
        Before you can vote on OpenChat you must first configure your <em>OpenChat User Id</em> as a
        <em>hot-key</em> for your neurons. In the future, if you end up buying more CHAT tokens and staking
        them into new neurons, remember to add the OpenChat User Id as a hot-key to these neurons too.
        To find your OpenChat User Id...
    </p>
    <ul>
        <li><Link path="">Launch the app</Link> and open the main menu</li>
        <li>Select "profile settings"</li>
        <li>
            At the bottom of the your "profile settings" you should find an "Advanced" section
            showing your User Id
        </li>
    </ul>
    <BlogScreenshot
        caption="Finding your userId in OpenChat"
        desktopUrl={"/assets/blog/desktop_finduserid.png"}
        mobileUrl={"/assets/blog/mobile_finduserid.png"} />
    <p>
        If you took part in the decentralization sale your neurons are configured to <em>follow</em>
        the neuron with the longest dissolve delay which means if you vote with that neuron the other
        neurons will implicitly vote the same way. This also means you only need to add your OpenChat
        User Id as a hot-key to this one neuron and the rest will follow.
    </p>
    <ul>
        <li>
            Sign-in to <ExternalLink href="https://nns.ic0.app/neurons">the NNS dapp</ExternalLink> and
            navigate to "My Neuron Staking"
        </li>
        <li>"Select Nervous System" OpenChat</li>
        <li>If your neurons are configured to follow your oldest neuron then select that neuron</li>
        <li>At the bottom of the neuron page press the button "Add Hotkey"</li>
        <li>At the prompt paste in your OpenChat User Id</li>
    </ul>
    <p>
        If your neurons aren't already configured to follow your oldest neuron, then either do that
        first, or instead you can add your OpenChat User Id as a hotkey to each of your neurons.
    </p>
    <BlogScreenshot
        caption="Adding your userId as a hotkey"
        desktopUrl={"/assets/blog/desktop_addhotkey.png"}
        mobileUrl={"/assets/blog/mobile_addhotkey.png"} />
</section>
<section>
    <h2>Following</h2>
    <p>
        You can either vote explicitly on each proposal or you can choose for your neurons to <em
            >follow</em> another neuron. This means your neurons will automatically vote when it does.
    </p>
    <p>
        For a given neuron you can choose to follow different neurons for different topics. You can
        also choose to follow a neuron on the so-called "Unspecified" topic which is a catch-all
        meaning follow this neuron on <em>all</em> topics. It is also possible to follow multiple neurons
        on the same topic. In this case your neuron will vote only when a majority of the neurons you
        follow on that topic vote the same way.
    </p>
    <p>
        It is possible to configure topic <em>exclusions</em> in a slightly quirky manner. This
        allows a neuron to follow another on the catch-all topic but exclude certain topics so that
        the user can vote for themselves. For example a reasonable choice might be to follow the
        OpenChat dev team beacon neuron (see below) on the catch-all but exclude motions, token
        transfers and SNS parameter changes. To exclude a particular topic you can configure your
        neuron to follow <em>itself</em> on this topic. This works because the explicit following relationship
        overrides the implicit catch-all and by using your own neuron id you ensure you are following
        no other neuron.
    </p>
    <p>
        Going forwards we hope that rather than every SNS "action" being mapped 1-1 to a topic, the
        actions can be grouped into topics. This will make it easier to configure following. We also
        hope it will be possible to have something like "named" neurons in the NNS.
    </p>
    <p>
        As mentioned earlier, if you have multiple neurons it is good practice to set the younger
        ones (in this case meaning lower dissolve delay) to follow your eldest. The easiest way to
        do this is to use the catch-all topic. Then you only need to setup a more nuanced following
        scheme on your eldest neuron.
    </p>
    <BlogScreenshot
        caption="Setting up following in the NNS"
        desktopUrl={"/assets/blog/desktop_following.png"}
        mobileUrl={"/assets/blog/mobile_following.png"} />
</section>
<section>
    <h2>Dev team beacon neuron</h2>
    <p>
        The dev team have configured a small neuron to be a "beacon" which anyone is welcome to
        follow on any topic. This beacon neuron will itself follow the neurons of each member of the
        dev team and so will implicitly vote when a majority of the dev team vote the same way. The
        dev team will vote on every proposal so if you are happy to follow their lead you will
        implicitly participate in every vote and so maximise your voting rewards.
    </p>
    <p>
        The dev team beacon neuron id is<br />
        <code>9adf350c7388dfe7277213a5fc8d817c2d5bc6ff6be5870f0d33d9d6dab01fc6</code>
    </p>
    <p>
        Having set the beacon neuron to follow the dev team neurons we removed its controller making
        it immutable and unable to vote itself.
    </p>
</section>
<section>
    <h2>Voting rewards</h2>
    <p>
        Voting rewards are generated by the SNS and accumulate in neurons that have participated in
        voting as <em>maturity</em>. For a given proposal ballot, the voting reward earned by a
        given neuron is in proportion to its voting power compared to the overall voting power of
        participating neurons. This encourages token holders to lock-up their tokens and take a long
        term interest in the success of OpenChat.
    </p>
    <p>
        Maturity can be <em>disbursed</em> causing the SNS to mint CHAT into the given account
        according to <ExternalLink href="https://wiki.internetcomputer.org/wiki/Maturity_modulation"
            >maturity modulation</ExternalLink
        >. Alternatively it can be staked or auto-staked to grow the value of the neuron.
    </p>
    <p>
        Voting rewards are distributed daily and take into account all of the ballots that ended on
        that day. If there are no proposal ballots on a given day the rewards are carried over to
        the following day. 2.5% of the total token supply is generated annually for voting rewards.
        In practice, given that much of the supply will not be in voting neurons, a neuron with a 1
        year dissolve delay would expect to receive a voting reward significantly higher than this
        figure.
    </p>
    <p>
        Note that if you fail to vote on any proposal you will not earn voting rewards for that
        proposal so if you anticipate you won't be able to vote manually on every proposal it is
        worth configuring your neurons to follow other neurons you can trust.
    </p>
</section>
