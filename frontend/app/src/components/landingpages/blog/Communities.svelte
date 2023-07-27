<script lang="ts">
    import Link from "../Link.svelte";
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <h2>Introduction</h2>

    <p>
        In <Link path="roadmap">our roadmap</Link> we introduce the idea of Communities. We hope you
        will agree that this is an important and exciting evolution of OpenChat. In this post, we'll
        do a deeper dive into the feature and explain what it's all about.
    </p>
    <p>
        When we began the development of OpenChat we had in mind something along the lines of
        WhatsApp or Signal. One very important difference was the support for public groups. We
        initially underestimated the significance of this feature. It took OpenChat out of the
        realms of a chat tool used largely between small groups of friends and family, and closer to
        the territory of communication platforms like Discord or Slack.
    </p>

    <p>
        We noticed that large public groups started to emerge revolving around certain communities
        of users that shared some commonality. That commonality could be anything: perhaps they all
        use the same language, or they all relate to a particular area of interest, or they all
        relate to a particular <em>project</em>. In this sense, these informal communities are a bit
        like Discord servers.
    </p>

    <p>
        Furthermore, a community may wish to restict and control its membership creating <em
            >private</em>
        communities. We see this as an important step for the future monetization of OpenChat as it enables
        us to easily support its use as an internal communication tool
        <em>within a corporate setting.</em> In that sense, communities can also be thought of like Slack
        workspaces.
    </p>
</section>

<section>
    <h2>The problem</h2>

    <p>
        Public groups are great for communities up to a point, but as the community grows we notice
        that the groups become unfocused. This in turn makes them difficult for the owners and
        admins to moderate. And this in turn tends to reduce the <em>quality</em> of the discourse in
        the groups.
    </p>

    <p>
        If a community leader wishes to address this at the moment they might choose to create
        multiple groups with more targeted topics. But then nothing binds these groups together,
        nothing unites their members, and there is no tooling that helps us see these groups as part
        of a larger whole.
    </p>

    <p>
        What's missing is another level in the hierarchy and that is what we are calling <em
            >Communities</em
        >.
    </p>
</section>

<h2>How will it work?</h2>

<section>
    <h3>Navigation</h3>
    <p>
        Essentially, this will just be another organisational layer above the existing level of
        groups. Let's try to visualise this with some proposed designs. Keep in mind that these
        designs are provisional and represent our current thinking. Things can and no doubt will
        change.
    </p>

    <BlogScreenshot
        caption="Home screen with community selected"
        desktopUrl={"/assets/blog/desktop.png"}
        mobileUrl={"/assets/blog/mobile.png"} />

    <p>
        As you can see there will be a new navigation panel on the left that will allow the
        selection of a community. From that point on things remain much as they currently are. A
        community will contain a list of groups and you will also still be able to access the
        threads related to that community's groups.
    </p>

    <p>
        Of course, everything we do must also work well on mobile. It's a little more challenging
        but we think it can work in much the same way.
    </p>
</section>

<section>
    <h3>Exploration</h3>

    <p>
        It's important that people are able to categorise and find communities that they might be
        interested in. As such, our current "What's hot" page will be replaced by a much more
        feature rich community exploration page.
    </p>

    <p>
        Communities should be tagged with keywords making it easy both for community owners to reach
        an audience and for users to find communities of interest to them.
    </p>

    <BlogScreenshot
        caption="Exploring communities"
        desktopUrl={"/assets/blog/desktop_explore.png"}
        mobileUrl={"/assets/blog/mobile_explore.png"} />

    <p>
        Once you have found a community of interest you will be able to see the details of the
        community including all of the public groups that it contains.
    </p>
</section>

<BlogScreenshot
    caption="Exploring a specific community"
    desktopUrl={"/assets/blog/desktop_selected.png"}
    mobileUrl={"/assets/blog/mobile_selected.png"} />

<section>
    <h2>Private Communities</h2>

    <p>
        Keep in mind that communities need not be public. The idea of a <em>private</em> community with
        controlled user access might be something that aligns more closely to corporate usage (perhaps
        more similar to a Slack workspace).
    </p>

    <p>
        The ability to create a private community is very likely to be a paid feature and offers
        OpenChat another important revenue stream.
    </p>
</section>

<section>
    <h2>Migration</h2>

    <p>
        There are many questions that remain around how we get from where we are to where we want to
        be. Lots of details will still need to be discussed and decided. What will happen to
        existing public groups? What about private groups and direct chats? In general, our vision
        is that <em>all</em> public groups will be converted to communities. The community can then be
        built and sub-divided from there by the owners and admins of the original group as they see fit.
        Private groups and direct chats will remain global.
    </p>
</section>

<section>
    <h2>The future</h2>

    <p>
        This is just a glimpse of this new feature and we hope that it gets you as excited about the
        future as we are.
    </p>

    <p>
        We feel like this is an important structural change to OpenChat which will open up a huge
        amount of opportunity for us. It will form the bedrock of our roadmap going forward and help
        us to support powerful community building on the platform in addition to preserving our
        roots as a simple chat app.
    </p>
</section>
