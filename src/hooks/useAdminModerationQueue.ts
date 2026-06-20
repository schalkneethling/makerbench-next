import { useEffect, useState, useTransition } from "react";

import {
  getModerationQueue,
  reviewModerationItem,
  type ModerationEntityType,
  type ModerationItem,
} from "../api/admin";

export type ModerationFilter = ModerationEntityType | "all";

export const moderationTypes = Object.freeze([
  { type: "all", label: "All" },
  { type: "tool", label: "Tools" },
  { type: "resource", label: "Resources" },
  { type: "stack", label: "Stacks" },
  { type: "stack-item", label: "Stack items" },
] satisfies ReadonlyArray<{ type: ModerationFilter; label: string }>);

export const moderationTypeLabels = Object.freeze({
  tool: "Tool",
  resource: "Resource",
  stack: "Stack",
  "stack-item": "Stack item",
} satisfies Record<ModerationEntityType, string>);

interface UseAdminModerationQueueOptions {
  accessToken: string | null;
  isAdmin: boolean;
}

export function useAdminModerationQueue({
  accessToken,
  isAdmin,
}: UseAdminModerationQueueOptions) {
  const [activeType, setActiveType] = useState<ModerationFilter>("all");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPendingViewTransition, startViewTransition] = useTransition();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      return;
    }

    const queueAccessToken = accessToken;
    const controller = new AbortController();

    async function loadQueue() {
      setIsLoading(true);
      setError(null);

      try {
        const nextItems = await getModerationQueue(
          queueAccessToken,
          activeType === "all" ? undefined : activeType,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          startViewTransition(() => {
            setItems(nextItems);
          });
        }
      } catch (queueError) {
        if (!controller.signal.aborted) {
          setError(
            queueError instanceof Error
              ? queueError.message
              : "Could not load moderation queue.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      controller.abort();
    };
  }, [accessToken, activeType, isAdmin]);

  async function reviewItem(
    item: ModerationItem,
    action: "approve" | "reject",
  ) {
    if (!accessToken) {
      return;
    }

    setPendingActionId(item.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const rejectionReason = rejectionReasons[item.id]?.trim();
      await reviewModerationItem(accessToken, {
        id: item.id,
        type: item.type,
        action,
        rejectionReason: action === "reject" ? rejectionReason : undefined,
      });
      startViewTransition(() => {
        setItems((currentItems) =>
          currentItems.filter((currentItem) => currentItem.id !== item.id),
        );
      });
      setRejectionReasons((currentReasons) => {
        const remainingReasons = { ...currentReasons };
        delete remainingReasons[item.id];
        return remainingReasons;
      });
      setSuccessMessage(
        `${moderationTypeLabels[item.type]} ${action === "approve" ? "approved" : "rejected"}.`,
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Could not update moderation item.",
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return {
    activeType,
    error,
    isLoading: isLoading || isPendingViewTransition,
    items,
    pendingActionId,
    rejectionReasons,
    setActiveType,
    setError,
    setRejectionReasons,
    setSuccessMessage,
    successMessage,
    reviewItem,
  };
}
