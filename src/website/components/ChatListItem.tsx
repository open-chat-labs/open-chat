import React from "react";
import { useDispatch } from "react-redux";
import { alpha, ListItem, ListItemIcon, makeStyles, Theme, Typography, useTheme } from "@material-ui/core";

import selectChat from "../actions/chats/selectChat";
import { Option } from "../domain/model/common";
import { UserId } from "../domain/model/users";
import { formatMessageDate } from "../formatters/date";
import ParticipantsTyping from "./ParticipantsTyping";
import TextContent from "./TextContent";
import ThemTyping from "./ThemTyping";
import DefaultGroupChatIcon from "./DefaultGroupChatIcon";
import UserAvatar from "./UserAvatar";

type Props = {
    name: string,
    date?: Date,
    index: number,
    selected: boolean,
    latestMessage: string,
    isGroup: boolean,
    userId: Option<UserId>,
    userImageId: Option<string>,
    unreadCount: number,
    themTyping: boolean,
    userOnline: boolean,
    participantsTyping: string[]
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    selectable: theme.selectableListItem,
    chatSummary: {
        paddingLeft: 10,
        width: "100%"
    },
    chatName: {
        color: theme.customColors.textColor,
        visibility: props => props.name.length ? "visible" : "hidden"
    },
    latestMessage: {
        color: alpha(theme.customColors.textColor, 0.6),
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 450
    },
    date: {
        color: alpha(theme.customColors.textColor, 0.6),
        float: "right"
    },
    unreadCount: {
        fontSize: "0.75rem",
        float: "right",
        backgroundColor: theme.customColors.green.main,
        color: theme.customColors.green.contrast,
        lineHeight: "20px",
        borderRadius: 10,
        textAlign: "center",
        verticalAlign: "middle",
        minWidth: 20,
        padding: "0 4px"
    }
}));

export default React.memo(ChatListItem);

function ChatListItem(props: Props) {
    const dispatch = useDispatch();
    const classes = useStyles(props);
    const theme = useTheme();

    const icon = props.isGroup
        ? <DefaultGroupChatIcon size="md" />
        : <UserAvatar
            isUserOnline={props.userOnline}
            userId={props.userId}
            imageId={props.userImageId}
            size="md"
            parentBackgroundColor={theme.customColors.sidePanelBackgroundColor} />;

    let snippet: JSX.Element;
    if (props.themTyping) {
        snippet = <ThemTyping variant="body2" />;
    } else if (props.participantsTyping.length) {
        snippet = <ParticipantsTyping usernames={props.participantsTyping} />
    } else {
        snippet = <TextContent text={props.latestMessage} insertLineBreaks={false} variant="body2" />;
    }

    return (
        <ListItem selected={props.selected} onClick={() => dispatch(selectChat(props.index))} className={classes.selectable} divider>
            <ListItemIcon>
                {icon}
            </ListItemIcon>
            <div className={classes.chatSummary}>
                <div>
                    <Typography variant="caption" className={classes.date}>{props.date ? formatMessageDate(props.date) : null}</Typography>
                    <Typography variant="body1" className={classes.chatName}>{props.name.length ? props.name : "Loading"}</Typography>
                </div>
                <div>
                    {props.unreadCount > 0 ? <div className={classes.unreadCount}>{props.unreadCount}</div> : null}
                    <div className={classes.latestMessage}>
                        {snippet}
                    </div>
                </div>
            </div>
        </ListItem>
    );
}
