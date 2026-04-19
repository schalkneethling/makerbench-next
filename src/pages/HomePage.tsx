import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { SearchInput } from "../components/search";
import { TagCloud, type Tag } from "../components/tags";
import { ToolGrid } from "../components/bookmarks";
import { ResultCount, LoadMoreButton, Alert } from "../components/ui";
import { useBookmarks, useSearch, useTags } from "../hooks";
import type { Bookmark } from "../api";

import "./HomePage.css";

const HOMEPAGE_TAG_LIMIT = 10;
const IDLE_TAG_LOAD_FALLBACK_MS = 1;

function scheduleAfterMainUiReady(onReady: () => void): () => void {
  if (typeof globalThis.requestIdleCallback === "function") {
    const idleCallbackId = globalThis.requestIdleCallback(() => {
      onReady();
    });

    return () => {
      globalThis.cancelIdleCallback?.(idleCallbackId);
    };
  }

  const timeoutId = globalThis.setTimeout(() => {
    onReady();
  }, IDLE_TAG_LOAD_FALLBACK_MS);

  return () => {
    globalThis.clearTimeout(timeoutId);
  };
}

/**
 * Transforms bookmarks to ToolCard props format.
 */
function toToolCardProps(bookmarks: Bookmark[]) {
  return bookmarks.map((bookmark) => ({
    id: bookmark.id,
    title: bookmark.title,
    description: bookmark.description ?? undefined,
    imageUrl: bookmark.imageUrl ?? undefined,
    submitterName: bookmark.submitterName ?? undefined,
    submitterGithubUrl: bookmark.submitterGithubUrl ?? undefined,
    url: bookmark.url,
    tags: bookmark.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  }));
}

type FilterMode = "search" | "filter" | "search-filter";

/**
 * Determines URL mode parameter based on active query/tag filters.
 */
function getFilterMode(query: string, tagNames: string[]): FilterMode | undefined {
  const hasQuery = query.trim() !== "";
  const hasTags = tagNames.length > 0;

  if (hasQuery && hasTags) {
    return "search-filter";
  }

  if (hasQuery) {
    return "search";
  }

  if (hasTags) {
    return "filter";
  }

  return undefined;
}

/**
 * Home page - displays tool grid with search and filtering.
 */
export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [shouldLoadTags, setShouldLoadTags] = useState(false);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>(() => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  });

  // Track if initial URL-based search has been triggered
  const initialSearchTriggered = useRef(false);
  const hasInitialFilters =
    searchQuery.trim() !== "" || selectedTagNames.length > 0;

  // Fetch all bookmarks on mount
  const {
    bookmarks,
    pagination: bookmarksPagination,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    fetch: fetchBookmarks,
    loadMore: loadMoreBookmarks,
  } = useBookmarks({ fetchOnMount: !hasInitialFilters });

  const {
    tags: homepageTags,
    error: tagsError,
  } = useTags({ enabled: shouldLoadTags, limit: HOMEPAGE_TAG_LIMIT });

  // Search hook for filtered results
  const {
    results: searchResults,
    pagination: searchPagination,
    isLoading: searchLoading,
    error: searchError,
    search,
    loadMore: loadMoreSearch,
    reset: resetSearch,
  } = useSearch();

  // Determine if we're in search/filter mode
  const isFiltering =
    searchQuery.trim() !== "" || selectedTagNames.length > 0;

  // Current data depends on mode
  const currentBookmarks = isFiltering ? searchResults : bookmarks;
  const currentPagination = isFiltering ? searchPagination : bookmarksPagination;
  const isLoading = isFiltering ? searchLoading : bookmarksLoading;
  const error = searchError ?? bookmarksError ?? tagsError;

  const availableTags = useMemo<Tag[]>(
    () =>
      homepageTags.map((tag) => ({
        id: tag.id,
        label: tag.name,
      })),
    [homepageTags],
  );

  // Convert selected tag names to IDs for TagCloud
  const selectedTags = useMemo(() => {
    return selectedTagNames
      .map((name) => availableTags.find((tag) => tag.label === name)?.id)
      .filter((id): id is string => id !== undefined);
  }, [selectedTagNames, availableTags]);

  // Convert to ToolCard format
  const tools = useMemo(
    () => toToolCardProps(currentBookmarks),
    [currentBookmarks]
  );

  /**
   * Updates URL search params. Uses replace to avoid polluting history.
   */
  const updateUrlParams = useCallback(
    (query: string, tagNames: string[]) => {
      const params = new URLSearchParams();
      const mode = getFilterMode(query, tagNames);

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (tagNames.length > 0) {
        params.set("tags", tagNames.join(","));
      }

      if (mode) {
        params.set("mode", mode);
      }

      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  /**
   * Trigger search from URL params on initial load.
   */
  useEffect(() => {
    return scheduleAfterMainUiReady(() => {
      setShouldLoadTags(true);
    });
  }, []);

  useEffect(() => {
    if (initialSearchTriggered.current) {
      return;
    }

    const hasUrlFilters =
      searchQuery.trim() !== "" || selectedTagNames.length > 0;

    if (!hasUrlFilters) {
      initialSearchTriggered.current = true;
      return;
    }

    initialSearchTriggered.current = true;

    const trimmed = searchQuery.trim();
    search(
      {
        q: trimmed.length >= 3 ? trimmed : undefined,
        tags: selectedTagNames.length > 0 ? selectedTagNames : undefined,
      },
      { immediate: true },
    );
  }, [searchQuery, selectedTagNames, availableTags, search]);

  /**
   * Handles search input changes.
   * Requires minimum 3 characters to trigger search (unless tags selected).
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      const trimmed = value.trim();
      const hasTags = selectedTagNames.length > 0;

      // Reset if empty and no tags
      if (trimmed === "" && !hasTags) {
        resetSearch();
        updateUrlParams("", []);
        if (bookmarks.length === 0 && !bookmarksLoading) {
          void fetchBookmarks();
        }
        return;
      }

      // Update URL immediately for shareability
      updateUrlParams(value, selectedTagNames);

      // Require 3+ chars for text search (skip if only filtering by tags)
      if (trimmed.length > 0 && trimmed.length < 3 && !hasTags) {
        return;
      }

      search({
        q: trimmed.length >= 3 ? trimmed : undefined,
        tags: hasTags ? selectedTagNames : undefined,
      });
    },
    [selectedTagNames, search, resetSearch, updateUrlParams, bookmarks.length, bookmarksLoading, fetchBookmarks]
  );

  /**
   * Handles tag selection toggle
   */
  const handleTagToggle = useCallback(
    (tagId: string) => {
      // Find tag name from ID
      const tag = availableTags.find((availableTag) => availableTag.id === tagId);
      if (!tag) {
        return;
      }

      const tagName = tag.label;
      const newTagNames = selectedTagNames.includes(tagName)
        ? selectedTagNames.filter((name) => name !== tagName)
        : [...selectedTagNames, tagName];

      setSelectedTagNames(newTagNames);
      updateUrlParams(searchQuery, newTagNames);

      if (newTagNames.length === 0 && searchQuery.trim() === "") {
        resetSearch();
        if (bookmarks.length === 0 && !bookmarksLoading) {
          void fetchBookmarks();
        }
      } else {
        search(
          {
            q: searchQuery.trim() || undefined,
            tags: newTagNames.length > 0 ? newTagNames : undefined,
          },
          { immediate: true },
        );
      }
    },
    [availableTags, selectedTagNames, searchQuery, search, resetSearch, updateUrlParams, bookmarks.length, bookmarksLoading, fetchBookmarks]
  );

  /**
   * Clears all selected tags
   */
  const handleClearTags = useCallback(() => {
    setSelectedTagNames([]);
    updateUrlParams(searchQuery, []);

    if (searchQuery.trim() === "") {
      resetSearch();
      if (bookmarks.length === 0 && !bookmarksLoading) {
        void fetchBookmarks();
      }
    } else {
      search({ q: searchQuery.trim() }, { immediate: true });
    }
  }, [searchQuery, search, resetSearch, updateUrlParams, bookmarks.length, bookmarksLoading, fetchBookmarks]);

  /**
   * Handles load more button click
   */
  const handleLoadMore = useCallback(() => {
    if (isFiltering) {
      loadMoreSearch();
    } else {
      loadMoreBookmarks();
    }
  }, [isFiltering, loadMoreSearch, loadMoreBookmarks]);

  const hasMore = currentPagination?.hasMore ?? false;
  const total = currentPagination?.total;

  return (
    <div className="HomePage">
      <header className="HomePage-hero">
        <h1 className="HomePage-title heading-3xl">Discover Tools</h1>
        <p className="HomePage-subtitle body-lg">
          Browse curated tools and resources for makers.
        </p>
      </header>

      <div className="HomePage-search">
        <SearchInput
          id="tool-search"
          label="Search by title or tag"
          value={searchQuery}
          onSearchChange={handleSearchChange}
          placeholder="Search by title or tag"
        />
      </div>

      {availableTags.length > 0 && (
        <TagCloud
          tags={availableTags}
          selectedIds={selectedTags}
          onTagToggle={handleTagToggle}
          onClearAll={handleClearTags}
          label="Filter by tag"
          className="HomePage-tags"
        />
      )}

      {error && (
        <Alert variant="error">
          <strong>Error loading tools.</strong> {error.message}
        </Alert>
      )}

      <div className="HomePage-results">
        <ResultCount count={tools.length} total={total} />
      </div>

      <ToolGrid
        tools={tools}
        onTagClick={handleTagToggle}
        isLoading={isLoading && tools.length === 0}
        emptyTitle={isFiltering ? "No matching tools" : "No tools yet"}
        emptyDescription={
          isFiltering
            ? "Try adjusting your search or filters."
            : "Be the first to submit a tool!"
        }
      />

      <div className="HomePage-loadMore">
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isLoading && tools.length > 0}
          onClick={handleLoadMore}
        />
      </div>
    </div>
  );
}
