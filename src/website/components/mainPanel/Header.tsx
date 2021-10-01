import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { RootState } from "../../reducers";
import UserAvatar from "../shared/UserAvatar";
import * as chatFunctions from "../../domain/model/chats";
import { Option } from "../../domain/model/common";
import * as stateFunctions from "../../domain/stateFunctions";
import { getSelectedChat } from "../../domain/stateFunctions";
import { compareUsersOnlineFirst, fromUserSummary, isUserOnline, MyProfile, UserSummary } from "../../domain/model/users";
import ParticipantsTyping from "../shared/ParticipantsTyping";
import ThemTyping from "../shared/ThemTyping";
import BackButton from "../shared/BackButton";
import GroupChatMenu from "./GroupChatMenu";
import DefaultGroupChatIcon from "../shared/DefaultGroupChatIcon";
import LastOnline from "./LastOnline";
import { changeRightPanel } from "../../actions/app/changeSidePanel";
import { LeftPanelType, RightPanelType } from "../../domain/model/panels";
import DirectChatMenu from "./DirectChatMenu";

export default React.memo(Header);

const useStyles = makeStyles((theme: Theme) => ({
    titles: {
        color: theme.colors.header.primaryTextColor,
        lineHeight: "normal",
        paddingLeft: 18
    },
    subtitle: {
        color: theme.colors.header.secondaryTextColor,
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    closeButton: {
        color: alpha(theme.colors.header.primaryTextColor, 0.6),
        marginLeft: -6,
        marginRight: 6,
    }
}));

function Header() {
    const dispatch = useDispatch();

    const me: Option<MyProfile> = useSelector((state: RootState) => state.usersState.me);
    const userDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));
    const leftPanelState = useSelector((state: RootState) => state.appState.panelState.leftPanel);

    if (chat === null) {
        return <div></div>;
    }

    let icon: JSX.Element;
    let chatName: string = "";
    let subTitle: Option<JSX.Element> = null;
    let chatMenu: Option<JSX.Element> = null;

    const any_unread = chatFunctions.getUnreadMessageCount(chat) > 0;

    if (chatFunctions.isDirectChat(chat)) {
        let muted = false;
        if (chatFunctions.isConfirmedChat(chat)) {
            muted = chat.muted;
        }
        chatMenu = <DirectChatMenu chatId={chat.chatId} userId={chat.them} muted={muted} any_unread={any_unread} />;
        let imageId = null;
        let isOnline = false;
        if (userDictionary.hasOwnProperty(chat.them)) {
            const userSummary = userDictionary[chat.them] as UserSummary;
            imageId = userSummary.imageId;
            chatName = userSummary.username;
            isOnline = isUserOnline(userSummary);
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
            chatMenu = <GroupChatMenu chatId={chat.chatId} muted={chat.muted} any_unread={any_unread} />;
            if (chat.participantsTyping.length) {
                const usernames = stateFunctions
                    .getUsers(chat.participantsTyping, userDictionary)
                    .map(u => u.username);

                subTitle = <ParticipantsTyping usernames={usernames} />;
            } else {                                
                const participants = stateFunctions.getUsers(chat.participants, userDictionary);

                let text = "";
                if (participants.length > 5) {
                    const onlineCount = participants.filter(p => isUserOnline(p)).length;
                    text = `${chat.participants.length} members (${onlineCount + 1} online) `;
                } else {                
                    const sortedParticipants = participants
                        .map(fromUserSummary)
                        .sort(compareUsersOnlineFirst);

                    text = sortedParticipants
                        .map(u => u.username)
                        .concat(["You"])
                        .join(", ");
                }

                subTitle = 
                    <Typography variant="caption">
                        <span className="text-link" onClick={() => (dispatch(changeRightPanel(RightPanelType.Participants)))}>
                            {text}
                        </span>
                    </Typography>;
            }
        }
    }

    const classes = useStyles();

    return (
        <Grid component="header" flexWrap="nowrap" container alignItems="center">
            {
                leftPanelState === LeftPanelType.None ? 
                <Grid item>
                    <BackButton onClick={() => history.back()} className={classes.closeButton} />
                </Grid> : null
            }
            <Grid item>
                {icon}
            </Grid>
            <Grid item flexGrow={1} overflow="hidden">
                <Grid container direction="column" className={"header-titles " + classes.titles}>
                    <Grid item>
                        <Typography variant="body1">{chatName}</Typography>
                    </Grid>
                    <Grid item className={classes.subtitle} whiteSpace="nowrap">
                        {subTitle}
                    </Grid>
                </Grid>
            </Grid>
            {chatMenu
                ? <Grid item>{chatMenu}</Grid>
                : null}
        </Grid>
    );
}
