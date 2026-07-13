import { useEffect, useState, useTransition } from "react";

import {
  createSubmissionBlocklistRule,
  deleteSubmissionBlocklistRule,
  getSubmissionBlocklist,
  type BlocklistEntry,
  type BlocklistEvent,
  type BlocklistMatchType,
} from "../api/admin";

interface UseAdminBlocklistOptions {
  accessToken: string | null;
  isAdmin: boolean;
}

/** Loads and mutates private blocklist rules for the admin moderation page. */
export function useAdminBlocklist({
  accessToken,
  isAdmin,
}: UseAdminBlocklistOptions) {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [recentEvents, setRecentEvents] = useState<BlocklistEvent[]>([]);
  const [matchType, setMatchType] = useState<BlocklistMatchType>("domain");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      return;
    }

    const controller = new AbortController();
    const blocklistAccessToken = accessToken;

    async function loadBlocklist() {
      setIsLoading(true);
      setError(null);

      try {
        const blocklistState = await getSubmissionBlocklist(
          blocklistAccessToken,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          startTransition(() => {
            setEntries(blocklistState.entries);
            setRecentEvents(blocklistState.recentEvents);
          });
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load blocklist rules.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBlocklist();

    return () => controller.abort();
  }, [accessToken, isAdmin]);

  async function addEntry() {
    if (!accessToken || !value.trim()) {
      return;
    }

    setPendingEntryId("new");
    setError(null);
    setSuccessMessage(null);
    try {
      const entry = await createSubmissionBlocklistRule(accessToken, {
        matchType,
        value: value.trim(),
      });
      startTransition(() => setEntries((current) => [entry, ...current]));
      setValue("");
      setSuccessMessage("Blocklist rule added.");
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "Could not add blocklist rule.",
      );
    } finally {
      setPendingEntryId(null);
    }
  }

  async function removeEntry(entry: BlocklistEntry) {
    if (!accessToken) {
      return;
    }

    setPendingEntryId(entry.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteSubmissionBlocklistRule(accessToken, entry.id);
      startTransition(() => {
        setEntries((current) => current.filter(({ id }) => id !== entry.id));
      });
      setSuccessMessage("Blocklist rule removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove blocklist rule.",
      );
    } finally {
      setPendingEntryId(null);
    }
  }

  return {
    addEntry,
    entries,
    error,
    isLoading: isLoading || isPendingTransition,
    matchType,
    pendingEntryId,
    recentEvents,
    removeEntry,
    setError,
    setMatchType,
    setSuccessMessage,
    setValue,
    successMessage,
    value,
  };
}
