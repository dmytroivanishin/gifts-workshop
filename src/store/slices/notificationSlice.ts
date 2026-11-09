import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  messageKey: string; // The i18n translation key
  details?: string;   // Optional raw details (e.g. dynamic field names)
}

interface NotificationState {
  queue: NotificationItem[];
}

const initialState: NotificationState = {
  queue: [],
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotification: (
      state,
      action: PayloadAction<Omit<NotificationItem, "id">>
    ) => {
      state.queue.push({
        ...action.payload,
        id: crypto.randomUUID(),
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((notification) => notification.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.queue = [];
    },
  },
});

export const { addNotification, removeNotification, clearNotifications } =
  notificationSlice.actions;

export default notificationSlice.reducer;
