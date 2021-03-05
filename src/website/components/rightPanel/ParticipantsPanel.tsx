import React from "react";
import { useDispatch, useSelector } from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../../reducers";
import * as sortFunctions from "../../utils/sortFunctions";
import { getSelectedChat, getUsers } from "../../domain/stateFunctions";
import { changeRightPanel, RightPanelType } from "../../actions/changeSidePanel";
import UserListItem from "../UserListItem";
import { fromMyProfile, fromUserSummary, UserItem, UserSummary } from "../../domain/model/users";
import { ConfirmedGroupChat } from "../../domain/model/chats";
import gotoUser from "../../actions/chats/gotoUser";
import removeParticipant from "../../actions/chats/removeParticipant";
import Header from "./Header";
import { MenuItem } from "../PopOverMenu";
import CreateGroupChatIcon from "../CreateGroupChatIcon";

export default React.memo(ParticipantsPanel);

const useStyles = makeStyles((theme: Theme) => ({
    listItem: {
        "&:hover": {
            backgroundColor: theme.colors.sidePanel.listItemHoverBackgroundColor,
            cursor: "pointer"
        }
    }
}));

function ParticipantsPanel() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState) as ConfirmedGroupChat);
    const me = useSelector((state: RootState) => state.usersState.me!);
    const _users = useSelector((state: RootState) => getUsers(chat.participants, state.usersState.userDictionary), compareUsers);

    // Sort participants alphabetically by username
    const users = _users.map(fromUserSummary);
    users.sort(sortFunctions.compareBy("username"));

    function closePanel() {
        dispatch(changeRightPanel(RightPanelType.None));
    }

    const handleSelectUser = (user: UserItem) => () => {
        if (user.userId != me.userId) {
            closePanel();
            dispatch(gotoUser(user.userId, user.username));
        }
    }

    function compareUsers(left: UserSummary[], right: UserSummary[]): boolean {
        if (left.length !== right.length)
            return false;

        for (let i = 0; i < left.length; i++) {
            const l = left[i];
            const r = right[i];
            if (l.userId !== r.userId || l.username !== r.username || l.imageId !== r.imageId)  {
                return false;
            }
        }

        return true;
    }

    const classes = useStyles();

    return (
        <>
            <Header title="Participants" onCloseButtonClick={closePanel} />
            <List disablePadding={true}>
                <ListItem onClick={_ => dispatch(changeRightPanel(RightPanelType.AddParticipants))} className={classes.listItem} divider>
                    <ListItemIcon>
                        <CreateGroupChatIcon size="sm" />
                    </ListItemIcon>
                    <Typography variant="body1">Add participant</Typography>
                </ListItem>
                <UserListItem
                    key={me.userId}
                    user={fromMyProfile(me)} />
                {users.map(user => {
                    const userId = user.userId;
                    const buttons: MenuItem[] = [];
                    buttons.push({ text: "Remove", action: () => dispatch(removeParticipant(chat.chatId, userId)) });
                    buttons.push({ text: "Dismiss as admin", action: () => {} });

                    return <UserListItem
                        key={userId}
                        user={user}
                        buttons={buttons}
                        handleSelectUser={handleSelectUser(user)} />
                })}
            </List>
        </>
    );
}
