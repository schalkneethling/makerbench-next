import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { Resource } from "../api";
import { ResourceGrid } from "../components/resources";
import { SearchInput } from "../components/search";
import { TagCloud, type Tag } from "../components/tags";
import { Alert, LoadMoreButton, ResultCount } from "../components/ui";
import { useResourceSearch, useResources } from "../hooks";

import "./ResourcesPage.css";

type ResourceSort = "newest" | "oldest" | "alpha-asc" | "alpha-desc";

const RESOURCE_SORTS = new Set<ResourceSort>([
  "newest",
  "oldest",
  "alpha-asc",
  "alpha-desc",
]);
const TAG_PARAM_PATTERN = /^[a-z0-9][a-z0-9+.#-]{0,49}$/i;

function parseResourceSort(value: string | null): ResourceSort {
  return value && RESOURCE_SORTS.has(value as ResourceSort)
    ? value as ResourceSort
    : "newest";
}

function parseTagParam(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((tagName) => tagName.trim().toLowerCase())
    .filter((tagName) => TAG_PARAM_PATTERN.test(tagName));
}

function getSortedResources(
  resources: Resource[],
  sortBy: ResourceSort,
): Resource[] {
  return [...resources].sort((left, right) => {
    if (sortBy === "oldest") {
      return (
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
    }

    if (sortBy === "alpha-asc") {
      return left.title.localeCompare(right.title);
    }

    if (sortBy === "alpha-desc") {
      return right.title.localeCompare(left.title);
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function getResourceTags(resources: Resource[]): Tag[] {
  const tagNames = new Set<string>();

  for (const resource of resources) {
    for (const tag of resource.tags) {
      tagNames.add(tag.name);
    }

    for (const child of resource.children ?? []) {
      for (const tag of child.tags) {
        tagNames.add(tag.name);
      }
    }
  }

  return [...tagNames].sort().map((tagName) => ({
    id: tagName,
    label: tagName,
  }));
}

export function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [sortBy, setSortBy] = useState<ResourceSort>(
    () => parseResourceSort(searchParams.get("sort")),
  );
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>(() => {
    return parseTagParam(searchParams.get("tags"));
  });
  const initialSearchTriggered = useRef(false);

  const {
    resources,
    pagination: resourcesPagination,
    isLoading: resourcesLoading,
    error: resourcesError,
    loadMore: loadMoreResources,
  } = useResources();

  const {
    results,
    pagination: searchPagination,
    isLoading: searchLoading,
    error: searchError,
    search,
    loadMore: loadMoreSearch,
    reset: resetSearch,
  } = useResourceSearch();

  const isFiltering =
    searchQuery.trim() !== "" || selectedTagNames.length > 0;
  const currentResources = isFiltering ? results : resources;
  const currentPagination = isFiltering
    ? searchPagination
    : resourcesPagination;
  const isLoading = isFiltering ? searchLoading : resourcesLoading;
  const error = searchError ?? resourcesError;
  const availableTags = useMemo(
    () => getResourceTags(currentResources.length > 0 ? currentResources : resources),
    [currentResources, resources],
  );
  const selectedTags = useMemo(
    () =>
      selectedTagNames.filter((tagName) =>
        availableTags.some((tag) => tag.id === tagName),
      ),
    [availableTags, selectedTagNames],
  );
  const sortedResources = useMemo(
    () => getSortedResources(currentResources, sortBy),
    [currentResources, sortBy],
  );

  const updateUrlParams = useCallback(
    (query: string, tagNames: string[], nextSort: ResourceSort) => {
      const params = new URLSearchParams();

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (tagNames.length > 0) {
        params.set("tags", tagNames.join(","));
      }

      if (nextSort !== "newest") {
        params.set("sort", nextSort);
      }

      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const runSearch = useCallback(
    (
      query: string,
      tagNames: string[],
      options: { immediate?: boolean } = {},
    ) => {
      const trimmed = query.trim();

      if (!trimmed && tagNames.length === 0) {
        resetSearch();
        return;
      }

      if (trimmed.length > 0 && trimmed.length < 3 && tagNames.length === 0) {
        return;
      }

      void search(
        {
          q: trimmed.length >= 3 ? trimmed : undefined,
          tags: tagNames.length > 0 ? tagNames : undefined,
        },
        options,
      );
    },
    [resetSearch, search],
  );

  useEffect(() => {
    if (initialSearchTriggered.current) {
      return;
    }

    initialSearchTriggered.current = true;
    runSearch(searchQuery, selectedTagNames, { immediate: true });
    // initialSearchTriggered intentionally makes this a one-time URL hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      updateUrlParams(value, selectedTagNames, sortBy);
      runSearch(value, selectedTagNames);
    },
    [runSearch, selectedTagNames, sortBy, updateUrlParams],
  );

  const handleTagToggle = useCallback(
    (tagName: string) => {
      const nextTagNames = selectedTagNames.includes(tagName)
        ? selectedTagNames.filter((selectedTagName) => selectedTagName !== tagName)
        : [...selectedTagNames, tagName];

      setSelectedTagNames(nextTagNames);
      updateUrlParams(searchQuery, nextTagNames, sortBy);
      runSearch(searchQuery, nextTagNames, { immediate: true });
    },
    [runSearch, searchQuery, selectedTagNames, sortBy, updateUrlParams],
  );

  const handleClearTags = useCallback(() => {
    setSelectedTagNames([]);
    updateUrlParams(searchQuery, [], sortBy);
    runSearch(searchQuery, [], { immediate: true });
  }, [runSearch, searchQuery, sortBy, updateUrlParams]);

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextSort = event.target.value as ResourceSort;
      setSortBy(nextSort);
      updateUrlParams(searchQuery, selectedTagNames, nextSort);
    },
    [searchQuery, selectedTagNames, updateUrlParams],
  );

  const handleLoadMore = useCallback(() => {
    if (isFiltering) {
      void loadMoreSearch();
      return;
    }

    void loadMoreResources();
  }, [isFiltering, loadMoreResources, loadMoreSearch]);

  return (
    <div className="ResourcesPage">
      <header className="ResourcesPage-hero">
        <h1 className="ResourcesPage-title heading-3xl">Resources</h1>
        <p className="ResourcesPage-subtitle body-lg">
          Browse articles, references, and public stacks from the MakerBench
          collection.
        </p>
      </header>

      <div className="ResourcesPage-toolbar">
        <SearchInput
          id="resource-search"
          label="Search resources"
          value={searchQuery}
          onSearchChange={handleSearchChange}
          placeholder="Search resources"
        />

        <label className="ResourcesPage-sort">
          <span className="ResourcesPage-sortLabel ui-caption">Sort</span>
          <select
            className="ResourcesPage-sortSelect"
            value={sortBy}
            onChange={handleSortChange}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha-asc">A-Z</option>
            <option value="alpha-desc">Z-A</option>
          </select>
        </label>
      </div>

      {availableTags.length > 0 && (
        <TagCloud
          tags={availableTags}
          selectedIds={selectedTags}
          onTagToggle={handleTagToggle}
          onClearAll={handleClearTags}
          label="Filter resources by tag"
          className="ResourcesPage-tags"
        />
      )}

      {error && (
        <Alert variant="error">
          <strong>Error loading resources.</strong> {error.message}
        </Alert>
      )}

      <div className="ResourcesPage-results">
        <ResultCount
          count={sortedResources.length}
          total={currentPagination?.total}
        />
      </div>

      <ResourceGrid
        resources={sortedResources}
        isLoading={isLoading && sortedResources.length === 0}
        onTagClick={handleTagToggle}
      />

      <div className="ResourcesPage-loadMore">
        <LoadMoreButton
          hasMore={currentPagination?.hasMore ?? false}
          isLoading={isLoading && sortedResources.length > 0}
          onClick={handleLoadMore}
        />
      </div>
    </div>
  );
}
