import React from "react";
import { useSelector } from "react-redux";
import { Grid, makeStyles, Theme, Typography } from "@material-ui/core";
import { fade } from "@material-ui/core/styles/colorManipulator";
import { RootState } from "../../reducers";
import UserAvatar from "../UserAvatar";
import * as chatFunctions from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import * as setFunctions from "../../utils/setFunctions";
import * as stateFunctions from "../../domain/stateFunctions";
import { getSelectedChat } from "../../domain/stateFunctions";
import { MyProfile, UserSummary } from "../../domain/model/users";
import ParticipantsTyping from "../ParticipantsTyping";
import ThemTyping from "../ThemTyping";
import DirectChatMenu from "./DirectChatMenu";
import GroupChatMenu from "./GroupChatMenu";
import DefaultGroupChatIcon from "../DefaultGroupChatIcon";
import LastOnline from "../LastOnline";

export default React.memo(Header);

const useStyles = makeStyles((theme: Theme) => ({
    header: theme.header,
    titles: {
        lineHeight: "normal",
        padding: "0 18px"
    },
    subtitle: {
        color: fade(theme.palette.text.primary, 0.6)
    }
}));

function Header() {
    const me: Option<MyProfile> = useSelector((state: RootState) => state.usersState.me);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    if (chat === null) {
        return <div></div>;
    }

    let icon: JSX.Element;
    let chatName: string = "";
    let subTitle: Option<JSX.Element> = null;
    let chatMenu: Option<JSX.Element> = null;

    if (chatFunctions.isDirectChat(chat)) {
        chatMenu = <DirectChatMenu />;
        let imageId = null;
        let isOnline = false;
        if (userDictionary.hasOwnProperty(chat.them)) {
            const userSummary = userDictionary[chat.them] as UserSummary;
            imageId = userSummary.imageId;
            chatName = userSummary.username;
            isOnline = userSummary.minutesSinceLastOnline < 2;
            subTitle = chatFunctions.isConfirmedChat(chat) && chat.themTyping
                ? <ThemTyping variant="caption" />
                : <LastOnline variant="caption" minutesSinceLastOnline={userSummary.minutesSinceLastOnline} />;
        }
        icon = <UserAvatar
            userId={chat.them}
            imageId={imageId}
            isUserOnline={isOnline}
            size="sm" />;
    } else {
        icon = <DefaultGroupChatIcon size="sm" />;
        chatName = chat.subject;

        if (chatFunctions.isConfirmedChat(chat) && me) {
            chatMenu = <GroupChatMenu />;
            if (chat.participantsTyping.length) {
                const usernames = stateFunctions
                    .getUsers(chat.participantsTyping, userDictionary)
                    .map(u => u.username);

                subTitle = <ParticipantsTyping usernames={usernames} />;
            } else {
                const allButMe = setFunctions.except(chat.participants, [me.userId]);
                const participants = stateFunctions
                    .getUsers(allButMe, userDictionary)
                    .map(u => u.username)
                    .concat(["You"])
                    .join(", ");

                subTitle = <Typography variant="caption">{participants}</Typography>
            }
        }
    }

    const classes = useStyles();

    return (
        <Grid container justify="space-between" className={classes.header} alignItems="center">
            <Grid item>
                <Grid container alignItems="center">
                    <Grid item>
                        {icon}
                    </Grid>
                    <Grid item>
                        <Grid container direction="column" className={"header-titles " + classes.titles}>
                            <Grid item>
                                <Typography variant="body1">{chatName}</Typography>
                            </Grid>
                            <Grid item className={classes.subtitle}>
                                {subTitle}
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
            {chatMenu
                ? <Grid item>{chatMenu}</Grid>
                : null}
        </Grid>
    );
}
