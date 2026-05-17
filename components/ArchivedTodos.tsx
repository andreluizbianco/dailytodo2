import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TodoList from "./TodoList";
import TodoItemNote from "./TodoItemNote";
import { Todo, CalendarEntry } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { softHaptic } from "../utils/haptics";
import { useTheme } from "../utils/theme";
import { filterArchivedTodos } from "../utils/archiveSearch";
import { getArchivePreviewText } from "../utils/archivePreview";

interface SearchResult {
  type: "todo" | "archived" | "calendar";
  item: Todo | CalendarEntry;
  matchField: "text" | "note";
}

interface ArchivedTodosProps {
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  isExpanded?: boolean;
  onNoteBodyDragChange?: (isDragging: boolean) => void;
  onNoteBodyDragMove?: (pageY: number) => number;
  hiddenArchivedTodoIds?: number[];
}

const ArchivedTodos: React.FC<ArchivedTodosProps> = ({
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  todos,
  setTodos,
  updateTodo,
  isExpanded = false,
  onNoteBodyDragChange,
  onNoteBodyDragMove,
  hiddenArchivedTodoIds = [],
}) => {
  const { theme } = useTheme();
  const searchScrollRef = useRef<ScrollView>(null);
  const searchScrollYRef = useRef(0);
  const searchScrollPageYRef = useRef(0);
  const searchViewportHeightRef = useRef(0);
  const searchContentHeightRef = useRef(0);
  const [selectedArchivedTodo, setSelectedArchivedTodo] = useState<Todo | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveTitleQuery, setArchiveTitleQuery] = useState("");
  const [archiveBodyQuery, setArchiveBodyQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [expandedSearchResults, setExpandedSearchResults] = useState<
    SearchResult[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpandedSearching, setIsExpandedSearching] = useState(false);
  const [isSearchNoteDragging, setIsSearchNoteDragging] = useState(false);
  const hasExpandedSearch =
    archiveTitleQuery.trim().length > 0 || archiveBodyQuery.trim().length > 0;
  const archivedTodosForDisplay = archivedTodos.filter((todo) => {
    if (hiddenArchivedTodoIds.includes(todo.id)) return false;
    if (!isExpanded && todo.projectId) return false;
    return true;
  });
  const visibleArchivedTodos = isExpanded
    ? filterArchivedTodos(archivedTodosForDisplay, {
        titleQuery: archiveTitleQuery,
        bodyQuery: archiveBodyQuery,
      })
    : archivedTodosForDisplay;

  const handleExpandedSearch = useCallback(
    async (titleQuery: string, bodyQuery: string) => {
      setArchiveTitleQuery(titleQuery);
      setArchiveBodyQuery(bodyQuery);

      const lowerTitleQuery = titleQuery.trim().toLowerCase();
      const lowerBodyQuery = bodyQuery.trim().toLowerCase();

      if (!lowerTitleQuery && !lowerBodyQuery) {
        setExpandedSearchResults([]);
        setIsExpandedSearching(false);
        return;
      }

      setIsExpandedSearching(true);
      const matchesTodo = (todo: Todo) => {
        const matchesTitle =
          !lowerTitleQuery || todo.text.toLowerCase().includes(lowerTitleQuery);
        const matchesBody =
          !lowerBodyQuery ||
          getArchivePreviewText(todo.note)
            .toLowerCase()
            .includes(lowerBodyQuery);

        return matchesTitle && matchesBody;
      };

      const results: SearchResult[] = [];

      todos.forEach((todo) => {
        if (matchesTodo(todo)) {
          results.push({
            type: "todo",
            item: todo,
            matchField: lowerTitleQuery ? "text" : "note",
          });
        }
      });

      archivedTodos.forEach((todo) => {
        if (matchesTodo(todo)) {
          results.push({
            type: "archived",
            item: todo,
            matchField: lowerTitleQuery ? "text" : "note",
          });
        }
      });

      try {
        const savedEntries = await AsyncStorage.getItem("calendarEntries");
        if (savedEntries) {
          const calendarEntries: CalendarEntry[] = JSON.parse(savedEntries);
          calendarEntries.forEach((entry) => {
            if (matchesTodo(entry.todo)) {
              results.push({
                type: "calendar",
                item: entry,
                matchField: lowerTitleQuery ? "text" : "note",
              });
            }
          });
        }
      } catch (error) {
        console.error("Error searching calendar entries:", error);
      }

      setExpandedSearchResults(results);
      setIsExpandedSearching(false);
    },
    [archivedTodos, todos],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const results: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      // Search in current todos
      todos.forEach((todo) => {
        if (todo.text.toLowerCase().includes(lowerQuery)) {
          results.push({ type: "todo", item: todo, matchField: "text" });
        }
        if (todo.note.toLowerCase().includes(lowerQuery)) {
          results.push({ type: "todo", item: todo, matchField: "note" });
        }
      });

      // Search in archived todos
      archivedTodos.forEach((todo) => {
        if (todo.text.toLowerCase().includes(lowerQuery)) {
          results.push({ type: "archived", item: todo, matchField: "text" });
        }
        if (todo.note.toLowerCase().includes(lowerQuery)) {
          results.push({ type: "archived", item: todo, matchField: "note" });
        }
      });

      // Search in calendar entries
      try {
        const savedEntries = await AsyncStorage.getItem("calendarEntries");
        if (savedEntries) {
          const calendarEntries: CalendarEntry[] = JSON.parse(savedEntries);
          calendarEntries.forEach((entry) => {
            if (entry.todo.text.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: "calendar",
                item: entry,
                matchField: "text",
              });
            }
            if (entry.todo.note.toLowerCase().includes(lowerQuery)) {
              results.push({
                type: "calendar",
                item: entry,
                matchField: "note",
              });
            }
          });
        }
      } catch (error) {
        console.error("Error searching calendar entries:", error);
      }

      setSearchResults(results);
      setIsSearching(false);
    },
    [todos, archivedTodos],
  );

  const handleUpdateNote = async (result: SearchResult, newNote: string) => {
    const updatedTodo = {
      ...(result.type === "calendar"
        ? (result.item as CalendarEntry).todo
        : (result.item as Todo)),
      note: newNote,
    };

    try {
      switch (result.type) {
        case "todo":
          updateTodo(updatedTodo.id, { note: newNote });
          break;

        case "archived":
          updateArchivedTodo(updatedTodo.id, { note: newNote });
          break;

        case "calendar":
          const savedEntries = await AsyncStorage.getItem("calendarEntries");
          if (savedEntries) {
            const entries: CalendarEntry[] = JSON.parse(savedEntries);
            const updatedEntries = entries.map((entry) =>
              entry.id === (result.item as CalendarEntry).id
                ? { ...entry, todo: { ...entry.todo, note: newNote } }
                : entry,
            );
            await AsyncStorage.setItem(
              "calendarEntries",
              JSON.stringify(updatedEntries),
            );

            setSearchResults((prev) =>
              prev.map((searchResult) =>
                searchResult === result
                  ? {
                      ...searchResult,
                      item: {
                        ...(searchResult.item as CalendarEntry),
                        todo: {
                          ...(searchResult.item as CalendarEntry).todo,
                          note: newNote,
                        },
                      },
                    }
                  : searchResult,
              ),
            );
          }
          break;
      }
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const handleSearchNoteDragChange = (isDragging: boolean) => {
    setIsSearchNoteDragging(isDragging);
    onNoteBodyDragChange?.(isDragging);

    if (isDragging) {
      searchScrollRef.current &&
        (
          searchScrollRef.current as unknown as {
            measureInWindow: (
              callback: (
                x: number,
                y: number,
                width: number,
                height: number,
              ) => void,
            ) => void;
          }
        ).measureInWindow((_, pageY, __, height) => {
          searchScrollPageYRef.current = pageY;
          searchViewportHeightRef.current = height;
        });
    }
  };

  const handleSearchNoteDragMove = (pageY: number) => {
    const viewportHeight = searchViewportHeightRef.current;
    if (viewportHeight <= 0) return 0;

    const maxScrollY = Math.max(
      0,
      searchContentHeightRef.current - viewportHeight,
    );
    const edgeSize = 72;
    const distanceFromTop = pageY - searchScrollPageYRef.current;
    const distanceFromBottom =
      searchScrollPageYRef.current + viewportHeight - pageY;
    let delta = 0;

    if (distanceFromTop < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromTop) / edgeSize;
      delta = -Math.max(2, Math.round(pressure * 6));
    } else if (distanceFromBottom < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromBottom) / edgeSize;
      delta = Math.max(2, Math.round(pressure * 6));
    }

    const outerDelta = onNoteBodyDragMove?.(pageY) ?? 0;

    if (delta === 0) return outerDelta;

    const nextY = Math.max(
      0,
      Math.min(maxScrollY, searchScrollYRef.current + delta),
    );
    const appliedDelta = nextY - searchScrollYRef.current;

    if (appliedDelta === 0) return outerDelta;

    searchScrollYRef.current = nextY;
    searchScrollRef.current?.scrollTo({ y: nextY, animated: false });
    return appliedDelta + outerDelta;
  };

  const renderSearchResults = () => {
    if (!searchQuery.trim() && !hasExpandedSearch) {
      return null;
    }

    const resultsToRender = isExpanded ? expandedSearchResults : searchResults;
    const searchInProgress = isExpanded ? isExpandedSearching : isSearching;

    if (searchInProgress) {
      return (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>
          Searching...
        </Text>
      );
    }

    if (resultsToRender.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>
          No results found
        </Text>
      );
    }

    const getItemText = (result: SearchResult): string => {
      if (result.type === "calendar") {
        return (result.item as CalendarEntry).todo.text || "Untitled Note";
      }
      return (result.item as Todo).text || "Untitled Note";
    };

    const getTodoForNote = (result: SearchResult): Todo => {
      if (result.type === "calendar") {
        return (result.item as CalendarEntry).todo;
      }
      return result.item as Todo;
    };

    const handleUnarchive = async (result: SearchResult) => {
      if (result.type === "archived") {
        unarchiveTodo((result.item as Todo).id);
        setSearchResults((prev) =>
          prev.filter(
            (r) =>
              !(
                r.type === "archived" &&
                (r.item as Todo).id === (result.item as Todo).id
              ),
          ),
        );
        setExpandedSearchResults((prev) =>
          prev.filter(
            (r) =>
              !(
                r.type === "archived" &&
                (r.item as Todo).id === (result.item as Todo).id
              ),
          ),
        );
      } else if (result.type === "calendar") {
        const calendarEntry = result.item as CalendarEntry;

        // Check if entry is from past or future/today
        const entryDate = new Date(calendarEntry.printedAt)
          .toISOString()
          .split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        const isFutureOrToday = entryDate >= today;

        // Generate new unique ID
        const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

        // Create a new todo from the calendar entry
        const newTodo: Todo = {
          ...calendarEntry.todo,
          id: uniqueId,
          isEditing: false,
          color: calendarEntry.todo.color || "blue",
          noteType: calendarEntry.todo.noteType || "text",
          text: calendarEntry.todo.text || "",
          note: calendarEntry.todo.note || "",
          createdAt: calendarEntry.printedAt,
          restoredFrom: {
            type: "calendar",
            originalId: calendarEntry.id,
            timestamp: new Date().toISOString(),
          },
        };

        // Update todos with duplicate checking
        setTodos((currentTodos) => {
          const isDuplicate = currentTodos.some(
            (todo: Todo) =>
              todo.text === newTodo.text &&
              todo.note === newTodo.note &&
              Math.abs(
                new Date(todo.createdAt || 0).getTime() -
                  new Date(calendarEntry.printedAt).getTime(),
              ) < 1000,
          );

          if (isDuplicate) {
            console.warn("Duplicate todo detected, skipping...");
            return currentTodos;
          }

          return [...currentTodos, newTodo];
        });

        try {
          // Only remove from calendar entries and search results if it's a future/today entry
          if (isFutureOrToday) {
            const savedEntries = await AsyncStorage.getItem("calendarEntries");
            if (savedEntries) {
              const entries: CalendarEntry[] = JSON.parse(savedEntries);
              const updatedEntries = entries.filter(
                (entry) => entry.id !== calendarEntry.id,
              );
              await AsyncStorage.setItem(
                "calendarEntries",
                JSON.stringify(updatedEntries),
              );

              // Remove from search results only if it's a future/today entry
              setSearchResults((prev) =>
                prev.filter(
                  (r) =>
                    !(
                      r.type === "calendar" &&
                      (r.item as CalendarEntry).id === calendarEntry.id
                    ),
                ),
              );
            }
          }

          // Always update AsyncStorage for todos
          const savedData = await AsyncStorage.getItem("todosData");
          const currentData = savedData
            ? JSON.parse(savedData)
            : { todos: [], archivedTodos: [] };

          const isDuplicateInStorage = currentData.todos.some(
            (todo: Todo) =>
              todo.text === newTodo.text &&
              todo.note === newTodo.note &&
              Math.abs(
                new Date(todo.createdAt || 0).getTime() -
                  new Date(calendarEntry.printedAt).getTime(),
              ) < 1000,
          );

          if (!isDuplicateInStorage) {
            currentData.todos.push(newTodo);
            await AsyncStorage.setItem(
              "todosData",
              JSON.stringify(currentData),
            );
          }
        } catch (error) {
          console.error("Error handling calendar unarchive:", error);
        }
      }
    };

    return (
      <ScrollView
        ref={searchScrollRef}
        style={styles.searchResults}
        scrollEnabled={!isSearchNoteDragging}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          searchViewportHeightRef.current = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_, height) => {
          searchContentHeightRef.current = height;
        }}
        onScroll={(event) => {
          searchScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {resultsToRender.map((result, index) => (
          <View
            key={index}
            style={[styles.searchResult, { backgroundColor: theme.elevated }]}
          >
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleContainer}>
                <Text
                  style={[styles.resultText, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {" "}
                  {/* Changed to 2 lines */}
                  {getItemText(result)}
                </Text>
              </View>
              <View style={styles.headerActions}>
                {(result.type === "archived" || result.type === "calendar") && (
                  <TouchableOpacity
                    onLongPress={() => {
                      softHaptic();
                      handleUnarchive(result);
                    }}
                    delayLongPress={650}
                    style={styles.unarchiveButton}
                  >
                    <Ionicons
                      name="archive-outline"
                      size={20}
                      color={theme.mutedText}
                      style={{ transform: [{ rotate: "180deg" }] }}
                    />
                  </TouchableOpacity>
                )}
                <View
                  style={[
                    styles.resultType,
                    {
                      backgroundColor: theme.control,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {result.type === "archived" && (
                    <Text style={[styles.typeText, { color: theme.mutedText }]}>
                      Archived
                    </Text>
                  )}
                  {result.type === "calendar" && (
                    <Text style={[styles.dateText, { color: theme.mutedText }]}>
                      {new Date(
                        (result.item as CalendarEntry).printedAt,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <TodoItemNote
              todo={getTodoForNote(result)}
              updateNote={(note) => handleUpdateNote(result, note)}
              onStartEditing={() => {}}
              onEndEditing={() => handleSearchNoteDragChange(false)}
              onListDragChange={handleSearchNoteDragChange}
              onListDragMove={handleSearchNoteDragMove}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, isExpanded && styles.expandedContainer]}>
      <Text
        style={[
          styles.title,
          isExpanded && styles.expandedTitle,
          { color: theme.text },
        ]}
      >
        {isExpanded ? "Archive and Search" : "Archived Notes"}
      </Text>

      {isExpanded ? (
        <View style={styles.expandedSearchRow}>
          <TextInput
            style={[
              styles.searchInput,
              styles.expandedSearchInput,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Title"
            placeholderTextColor={theme.subtleText}
            value={archiveTitleQuery}
            onChangeText={(query) =>
              handleExpandedSearch(query, archiveBodyQuery)
            }
            autoCapitalize="none"
          />
          <TextInput
            style={[
              styles.searchInput,
              styles.expandedSearchInput,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Body"
            placeholderTextColor={theme.subtleText}
            value={archiveBodyQuery}
            onChangeText={(query) =>
              handleExpandedSearch(archiveTitleQuery, query)
            }
            autoCapitalize="none"
          />
        </View>
      ) : (
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.elevated,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Search in all notes..."
            placeholderTextColor={theme.subtleText}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
        </View>
      )}

      {isExpanded && hasExpandedSearch ? (
        renderSearchResults()
      ) : !isExpanded && searchQuery ? (
        renderSearchResults()
      ) : visibleArchivedTodos.length > 0 ? (
        <TodoList
          todos={visibleArchivedTodos}
          setTodos={setArchivedTodos}
          updateTodo={updateArchivedTodo}
          selectedTodo={selectedArchivedTodo}
          setSelectedTodo={setSelectedArchivedTodo}
          isArchiveView={true}
          unarchiveTodo={unarchiveTodo}
          columns={isExpanded ? 2 : 1}
          onNoteBodyDragChange={onNoteBodyDragChange}
          onNoteBodyDragMove={onNoteBodyDragMove}
        />
      ) : (
        <Text style={[styles.emptyText, { color: theme.mutedText }]}>
          {archivedTodos.length > 0
            ? "No matching archived notes"
            : "No archived notes"}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 4,
    padding: 10,
  },
  expandedContainer: {
    paddingHorizontal: 0,
    paddingTop: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1f2937",
  },
  expandedTitle: {
    marginBottom: 12,
    textAlign: "center",
  },
  searchContainer: {
    marginBottom: 20,
  },
  expandedSearchRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    paddingLeft: 4,
    paddingRight: 8,
  },
  expandedSearchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  searchInput: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 15,
  },
  searchResults: {
    flex: 1,
  },
  searchResult: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // Changed from 'center' to allow multiline
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  resultTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginRight: 8,
  },
  resultText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
    flexShrink: 1, // Allows text to shrink if needed
  },
  resultType: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#6b7280",
    textAlign: "center",
    marginTop: 20,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0, // Prevents shrinking of buttons and date
  },
  unarchiveButton: {
    padding: 4,
  },
  calendarInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 4,
  },
});

export default ArchivedTodos;
