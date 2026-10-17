"use client";

import { useEffect } from "react";
import { Toaster, toast } from "@/components/ui/sonner";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { removeNotification } from "@/store/slices/notificationSlice";
import { useTranslation } from "@/i18n";

export function GlobalToaster() {
  const dispatch = useDispatch();
  const { queue } = useSelector((state: RootState) => state.notifications);
  const { t } = useTranslation();

  useEffect(() => {
    if (queue.length > 0) {
      queue.forEach((notification) => {
        // Find translation, fallback to details or key
        let message = t(notification.messageKey);
        if (message === notification.messageKey && notification.details) {
          message = notification.details;
        }

        switch (notification.type) {
          case "success":
            toast.success(message);
            break;
          case "error":
            toast.error(message);
            break;
          case "warning":
            toast.warning(message);
            break;
          case "info":
          default:
            toast.info(message);
            break;
        }

        // Remove from queue immediately so it doesn't fire again
        dispatch(removeNotification(notification.id));
      });
    }
  }, [queue, dispatch, t]);

  return (
    <Toaster 
      position="top-center" 
      richColors 
      expand={true}
    />
  );
}
