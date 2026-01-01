import { useState, useMemo, useCallback } from "react";

import { SearchInput } from "../components/search";
import { TagCloud, type Tag } from "../components/tags";
import { ToolGrid } from "../components/bookmarks";
import { ResultCount, LoadMoreButton, Alert } from "../components/ui";
import { useBookmarks, useSearch } from "../hooks";
import type { Bookmark } from "../api";

import "./HomePage.css";

/**
 * Extracts unique tags from bookmarks for the tag cloud.
 */
function extractTags(bookmarks: Bookmark[]): Tag[] {
  const tagMap = new Map<string, Tag>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      if (!tagMap.has(tag.id)) {
        tagMap.set(tag.id, { id: tag.id, label: tag.name });
      }
    }
  }

  return Array.from(tagMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Transforms bookmarks to ToolCard props format.
 */
function toToolCardProps(bookmarks: Bookmark[]) {
  return bookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? undefined,
    imageUrl: b.imageUrl ?? undefined,
    url: b.url,
    tags: b.tags.map((t) => ({ id: t.id, name: t.name })),
  }));
}

/**
 * Home page - displays tool grid with search and filtering.
 */
export function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch all bookmarks on mount
  const {
    bookmarks,
    pagination: bookmarksPagination,
    isLoading: bookmarksLoading,
    error: bookmarksError,
    loadMore: loadMoreBookmarks,
  } = useBookmarks();

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
  const isFiltering = searchQuery.trim() !== "" || selectedTags.length > 0;

  // Current data depends on mode
  const currentBookmarks = isFiltering ? searchResults : bookmarks;
  const currentPagination = isFiltering ? searchPagination : bookmarksPagination;
  const isLoading = isFiltering ? searchLoading : bookmarksLoading;
  const error = isFiltering ? searchError : bookmarksError;

  // Extract unique tags from all loaded bookmarks
  const availableTags = useMemo(() => extractTags(bookmarks), [bookmarks]);

  // Convert to ToolCard format
  const tools = useMemo(
    () => toToolCardProps(currentBookmarks),
    [currentBookmarks]
  );

  /**
   * Handles search input changes.
   * Requires minimum 3 characters to trigger search (unless tags selected).
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      const trimmed = value.trim();
      const hasTags = selectedTags.length > 0;

      // Reset if empty and no tags
      if (trimmed === "" && !hasTags) {
        resetSearch();
        return;
      }

      // Require 3+ chars for text search (skip if only filtering by tags)
      if (trimmed.length > 0 && trimmed.length < 3 && !hasTags) {
        return;
      }

      // Convert tag IDs to names for search API
      const tagNames: string[] = [];
      for (const id of selectedTags) {
        const tag = availableTags.find((t) => t.id === id);
        if (tag) {
          tagNames.push(tag.label);
        }
      }

      search({
        q: trimmed.length >= 3 ? trimmed : undefined,
        tags: tagNames.length > 0 ? tagNames : undefined,
      });
    },
    [selectedTags, availableTags, search, resetSearch]
  );

  /**
   * Handles tag selection toggle
   */
  const handleTagToggle = useCallback(
    (tagId: string) => {
      setSelectedTags((prev) => {
        const newTags = prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId];

        // Convert tag IDs to names for search API
        const tagNames: string[] = [];
        for (const id of newTags) {
          const tag = availableTags.find((t) => t.id === id);
          if (tag) {
            tagNames.push(tag.label);
          }
        }

        if (newTags.length === 0 && searchQuery.trim() === "") {
          resetSearch();
        } else {
          search({
            q: searchQuery.trim() || undefined,
            tags: tagNames.length > 0 ? tagNames : undefined,
          });
        }

        return newTags;
      });
    },
    [availableTags, searchQuery, search, resetSearch]
  );

  /**
   * Clears all selected tags
   */
  const handleClearTags = useCallback(() => {
    setSelectedTags([]);

    if (searchQuery.trim() === "") {
      resetSearch();
    } else {
      search({ q: searchQuery.trim() });
    }
  }, [searchQuery, search, resetSearch]);

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
  const total = currentPagination?.total ?? 0;

  return (
    <div className="HomePage">
      <header className="HomePage-hero">
        <h1 className="HomePage-title">Discover Tools</h1>
        <p className="HomePage-subtitle">
          Browse curated tools and resources for makers.
        </p>
      </header>

      <div className="HomePage-search">
        <SearchInput
          id="tool-search"
          label="Search tools"
          value={searchQuery}
          onSearchChange={handleSearchChange}
          placeholder="Search by name or description..."
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
