// The chat channel the user is looking at right now (null when none is open), so a new message in it
// doesn't also raise a notification toast / unread dot.
let activeChannelId: string | null = null;
export const getActiveChat = () => activeChannelId;
export const setActiveChat = (id: string | null) => {
  activeChannelId = id;
};
