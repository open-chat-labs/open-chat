<script lang="ts">
    import Link from "../Link.svelte";
    import BlogScreenshot from "./BlogScreenshot.svelte";
</script>

<section>
    <h2>Introduction</h2>

    <p>
        Communities have arrived! I explained the motivation for building the Communities feature in
        a <Link path="blog/communities">previous post</Link>. In this post I want to introduce you
        to the real thing and try to cover some common use cases and anticipate some questions that
        you may have about the feature.
    </p>
</section>

<section>
    <h2>Orientation</h2>

    <div class="pic-row">
        <img class="left" src="/assets/blog/communities/desktop_nav.png" />

        <div class="right">
            <p>
                While a lot has changed, things should feel still feel quite familiar. You will
                notice that you now see a new navigation bar on the left of the screen. Let's first
                run through what is available from this new navigation interface.
            </p>
            <p>
                At the top, you will see a root level menu (1). This will provide access to items
                that don't relate to specific communities, groups or channels. This includes a full
                breakdown of all of our landing pages which were not easily accessible from within
                the app before.
            </p>

            <p>
                Next you will see your own avatar (2). Click here to navigate to you user profile
                which will open to the right as before.
            </p>

            <p>
                Below your avatar you will see three new icons representing direct chats (3), global
                group chats (4) and favourites (5). Direct chats are all the chats where you are
                having a one to one converstation with another user. Global group chats are exactly
                like group chats were before. They are simply groups that do not belong inside a
                Community. It's perfectly ok for groups to remain global and not form part of a new
                community. And finally we have favourite chats. This is a place where you can add <em
                    >any</em> chat. Then if you would prefer to just have a single view with all of your
                favourite chats without worrying about the new categories you can set it up that way.
                By default you should see that any chat you previously had pinned will now automatically
                appear in your favourites list. It is still possible to pin chats within any of these
                three lists.
            </p>
        </div>
    </div>

    <div class="pic-row inverted">
        <div class="left">
            <p>
                Below the top level chat lists, you will see an avatar for each community that you
                belong to. A community <em>also</em> acts as a list of chats - when you select a community
                you will see those chats that belong to it. Chats within communities are referred to
                as "Channels" to make it clear that they are part of a community. Just like direct and
                group chats, channels can also be added to favourites so you can still have everything
                you're interested in in one place.
            </p>
            <p>
                Finally, at the bottom of the navigation panel you will see a link to explore
                communities. This is a good place to get started to find out what is on offer. In
                addition, there is a link to expand and collapse the navigation panel which will
                show labels next to each item making it clear exactly what everything is. You may
                find that you don't need to expand this panel after getting used to the new
                features.
            </p>
        </div>
        <img src="/assets/blog/communities/desktop_nav_communities.png" class="right" />
    </div>
</section>

<section>
    <h2>Finding Communities</h2>

    <p>
        To explore public communities, click on the icon in the left hand navigation panel. Here you
        can search for communities. User the filters to restrict the results to communities with
        specific primary languages or to communities that have been given particular flags.
    </p>

    <BlogScreenshot
        caption="The Communities explorer"
        desktopUrl={"/assets/blog/communities/desktop_explore.png"}
        mobileUrl={"/assets/blog/communities/mobile_explore.png"} />

    <p>
        We expect to expand the system of tagging of communities in the future to make it even
        easier to find exactly what you're looking for.
    </p>

    <p>
        To select a community, simply click on the result in the explorer. You can then preview the
        community's default channels and make a decision about whether you would like to join or
        not.
    </p>

    <p>
        When you join a community you will be automatically enlisted in that community's default
        channels. There may of course be <em>other</em> channels that you are not automatically enlisted
        in. There are a couple of different ways to find the other channels that you might be interested
        in within the community.
    </p>

    <p>
        First, you can click the "Browse other channels" item in the left hand panel. This will open
        the channel browser in the right hand panel. From here you can search and click on any
        channel that interests you to preview and / or join it.
    </p>

    <p>
        Alternatively, if you know the name of the channel that you're looking for, you can just
        search for it using the search box in the left hand panel.
    </p>

    <h3>Seeing community details</h3>

    <p>
        When you have a community selected you can access the full details of the community from the
        menu in the header of the left hand panel. This will open up the community details in the
        right hand panel (similar to viewing the details of a group). From there, you can also
        access the community's channels and its members.
    </p>
</section>

<section>
    <div class="pic-row equal">
        <div class="left">
            <h2>Creating Communities</h2>

            <p>
                What about if you want to create a community of your own? There are a couple of
                common scenarios...
            </p>
            <h3>Create a community from scratch</h3>
            <p>
                To create a community from scratch, simply navigate to the Community explorer and
                click the Create Community button to launch the wizard.
            </p>
            <p>
                The wizard should be relatively easy to understand and offers many similar choices
                to the existing group creation process. There are some key decisions that will need
                to be made. Do you want to create a public community which anyone can discover and
                join or would you prefer it to be private so that only those invited or provided
                with an invite link can join? Will you apply an access gate that users must pass?
            </p>
            <p>
                You will also need to set up permissions for the community to control what your
                users can do.
            </p>

            <p>
                You will also have an opportunity to quickly define one or more default channels.
                You will be able to further configure these channels later after the community has
                been created.
            </p>
        </div>
        <div class="right">
            <img class="gif" src="/assets/blog/communities/create_community.gif" />
        </div>
    </div>

    <h3>Convert a group to a community</h3>
    <p>
        It's possible that you are already the owner of a group and you would like to promote this
        group to a community. This will allow you to have more fine-grained channels leading to more
        focused conversations.
    </p>
    <p>
        To convert a group to a community, simply select the group and then choose "Convert to
        community" from the group chat's menu and we will take care of the rest. Note that you must
        be a group owner to perform this operation.
    </p>

    <BlogScreenshot
        caption="Convert a group to a community"
        desktopUrl={"/assets/blog/communities/desktop_convert.png"}
        mobileUrl={"/assets/blog/communities/mobile_convert.png"} />

    <p>
        The conversion process will create a new community with the same name as your group, then
        create a single default channel, again with the same name as your original group. All
        members of the old group will then be added to the community and all messages will be copied
        across to the new channel. Finally, the existing group will be deleted.
    </p>

    <p>
        Keep in mind that for a large group, this process might take a little while so be patient.
    </p>

    <h3>Importing groups</h3>

    <p>
        Alternatively, you may wish to create the community yourself manually (giving you more
        control over the name, description and imagery etc) and then import your existing group into
        that community afterwards.
    </p>

    <p>
        To do that, again simply select the group you wish to import and select "Import to
        community" from the group chat's menu. You will then be asked to choose from a list of
        communities that you own as the target into which you wish to import the group. Note that
        you must be an owner of both the source group and the target community to perform this
        operation.
    </p>

    <p>
        Once your community has been created, you can invite users, send messages, create more
        channels or import more groups and get the word out.
    </p>
</section>

<section>
    <h2>The future</h2>

    <p>
        This is an important step in getting our structure right for the future but it is only the
        beginning.
    </p>

    <p>
        Having got this foundation in place we can iterate fast and add more and more community
        building features.
    </p>

    <p>This important step will also form the basis for community based integrations.</p>

    <p>
        Let us know what you think. Let us know what you would like to see next. And please also let
        us know if you find the odd bug!
    </p>
</section>

<style lang="scss">
    .gif {
        width: 100%;
    }
    .pic-row {
        display: flex;
        gap: $sp8;
        margin-bottom: $sp7;

        @include mobile() {
            flex-direction: column;
            margin-bottom: $sp4;
            gap: 0;
        }

        .left {
            flex: 1;
            width: 33%;
        }

        .right {
            flex: 2;
            width: 66%;
        }

        &.inverted {
            .right {
                flex: 1;
                width: 33%;
            }

            .left {
                flex: 2;
                width: 66%;
            }
        }

        &.equal {
            .right {
                flex: 1;
                width: 50%;
            }

            .left {
                flex: 1;
                width: 50%;
            }
        }

        @include mobile() {
            .left,
            .right {
                flex: 1 !important;
                width: 100% !important;
            }
        }
    }
</style>
