import React, { useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import TodoItemNote from "./TodoItemNote";
import TodoSettings from "./TodoSettings";
import TimerView from "./TimerView";
import ArchivedTodos from "./ArchivedTodos";
import AppSettings from "./AppSettings";
import ProjectSettings from "./ProjectSettings";
import {
  CalendarEntry,
  CalendarProjectionRange,
  DateFormatPreference,
  PhotoScanFormat,
  Project,
  Todo,
  TrashedTodo,
  TrashRetention,
  TodayTodoItem,
  VoiceLanguagePreference,
} from "../types";
import { getNoteBackgroundColor, useTheme } from "../utils/theme";
import {
  getArchiveActionForSelection,
  shouldUnarchiveSelection,
} from "../utils/archiveAction";
import { appendTranscriptionToNote } from "../utils/voiceNotes";
import { getNativeVoiceLanguageTag } from "../utils/voicePreferences";
import {
  appendPhotoAttachment,
  removePhotoAttachment,
} from "../utils/photoAttachments";
import { formatPhotoScanText } from "../utils/photoTextFormat";

const { TimerModule, VoiceModule, PhotoTextModule } = NativeModules;

const clampColorChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string) => {
  const normalizedHex = hex.replace("#", "");
  if (normalizedHex.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: parseInt(normalizedHex.slice(0, 2), 16),
    g: parseInt(normalizedHex.slice(2, 4), 16),
    b: parseInt(normalizedHex.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (value: number) =>
    clampColorChannel(value).toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHexColors = (from: string, to: string, amount: number) => {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);

  return rgbToHex({
    r: fromRgb.r + (toRgb.r - fromRgb.r) * amount,
    g: fromRgb.g + (toRgb.g - fromRgb.g) * amount,
    b: fromRgb.b + (toRgb.b - fromRgb.b) * amount,
  });
};

const getReadableIconColor = (backgroundColor: string) => {
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.56 ? "#111827" : "#FFFFFF";
};

const getAttachmentFileName = (name: string | null | undefined, uri: string) => {
  const sourceName = name || uri.split("/").pop() || "photo.jpg";
  const extensionMatch = sourceName.match(/\.[a-z0-9]+$/i);
  const extension = extensionMatch?.[0] ?? ".jpg";
  return `photo-${Date.now()}-${Math.floor(Math.random() * 1000)}${extension}`;
};

type SettingsOpenTarget =
  | { type: "daily"; todoId: number }
  | { type: "archive"; todoId: number }
  | { type: "calendar"; entryId: number };

interface TodoNoteColumnProps {
  selectedTodo: Todo | null;
  selectedTodoSource:
    | { type: "todo" }
    | { type: "archive" }
    | { type: "calendar"; entryId: number };
  selectedProject: Project | null;
  activeView:
    | "notes"
    | "projects"
    | "timer"
    | "settings"
    | "archive"
    | "calendar";
  isNoteFullscreen: boolean;
  updateTodo: (id: number, updates: Partial<Todo>) => void;
  createSubproject: (project: Project) => void;
  updateCalendarEntryTodo: (
    entryId: number,
    updates: Partial<Todo>,
  ) => Promise<void>;
  updateProject: (id: number, updates: Partial<Project>) => void;
  removeProject: (id: number) => void;
  removeTodo: (id: number) => Todo | null;
  archiveTodo: (id: number) => Todo | null;
  archivedTodos: Todo[];
  setArchivedTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  unarchiveTodo: (id: number) => void;
  updateArchivedTodo: (id: number, updates: Partial<Todo>) => void;
  selectTodo: (
    todo: Todo | null,
    source?: { type: "todo" } | { type: "archive" } | { type: "calendar"; entryId: number },
  ) => void;
  showSettings: boolean;
  trashedTodos: TrashedTodo[];
  trashRetention: TrashRetention;
  restoreTrashedTodo: (id: number) => void;
  deleteTrashedTodo: (id: number) => void;
  emptyTrash: () => void;
  setTrashRetention: (retention: TrashRetention) => void;
  calendarAutoScrollToNow: boolean;
  calendarProjectionRange: CalendarProjectionRange;
  dateFormat: DateFormatPreference;
  voiceAutoStop: boolean;
  voiceEnabled: boolean;
  voiceLanguage: VoiceLanguagePreference;
  photoAttachmentsEnabled: boolean;
  photoScanEnabled: boolean;
  photoScanFormat: PhotoScanFormat;
  setCalendarAutoScrollToNow: (enabled: boolean) => void;
  setCalendarProjectionRange: (range: CalendarProjectionRange) => void;
  setDateFormat: (format: DateFormatPreference) => void;
  setVoiceAutoStop: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceLanguage: (language: VoiceLanguagePreference) => void;
  setPhotoAttachmentsEnabled: (enabled: boolean) => void;
  setPhotoScanEnabled: (enabled: boolean) => void;
  setPhotoScanFormat: (format: PhotoScanFormat) => void;
  printOnCalendar: (todo: Todo) => void;
  exportData: () => void;
  importData: () => void;
  onOpenTodoFromSettings: (target: SettingsOpenTarget) => void;
  onOpenCalendarEntry: (entryId: number) => void;
  todos: Todo[];
  calendarEntries: CalendarEntry[];
  projects: Project[];
  todayItems?: TodayTodoItem[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>; // Add this line
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

type SelectedTodoSource = TodoNoteColumnProps["selectedTodoSource"];
type ProjectTodoSource = TodoNoteColumnProps["selectedTodoSource"];
type ProjectDossierRow = {
  todo: Todo;
  source: ProjectTodoSource;
};

const getTodoNoteRenderKey = (
  activeView: TodoNoteColumnProps["activeView"],
  todo: Todo,
  source: SelectedTodoSource,
) => {
  const sourceKey =
    source.type === "calendar" ? `${source.type}-${source.entryId}` : source.type;

  return `${activeView}-${sourceKey}-${todo.id}-${todo.noteType ?? "text"}`;
};

const TodoNoteColumn: React.FC<TodoNoteColumnProps> = ({
  selectedTodo,
  selectedTodoSource,
  selectedProject,
  activeView,
  isNoteFullscreen,
  updateTodo,
  createSubproject,
  updateCalendarEntryTodo,
  updateProject,
  removeProject,
  removeTodo,
  archiveTodo,
  archivedTodos,
  setArchivedTodos,
  unarchiveTodo,
  updateArchivedTodo,
  selectTodo,
  showSettings,
  trashedTodos,
  trashRetention,
  restoreTrashedTodo,
  deleteTrashedTodo,
  emptyTrash,
  setTrashRetention,
  calendarAutoScrollToNow,
  calendarProjectionRange,
  dateFormat,
  voiceAutoStop,
  voiceEnabled,
  voiceLanguage,
  photoAttachmentsEnabled,
  photoScanEnabled,
  photoScanFormat,
  setCalendarAutoScrollToNow,
  setCalendarProjectionRange,
  setDateFormat,
  setVoiceAutoStop,
  setVoiceEnabled,
  setVoiceLanguage,
  setPhotoAttachmentsEnabled,
  setPhotoScanEnabled,
  setPhotoScanFormat,
  printOnCalendar,
  exportData,
  importData,
  onOpenTodoFromSettings,
  onOpenCalendarEntry,
  todos,
  calendarEntries,
  projects,
  todayItems = [],
  setTodos,
  setShowSettings,
}) => {
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollFrameViewRef = useRef<View>(null);
  const settingsTopRef = useRef(0);
  const scrollYRef = useRef(0);
  const scrollFrameRef = useRef({ pageY: 0, height: 0 });
  const scrollContentHeightRef = useRef(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isListDragging, setIsListDragging] = useState(false);
  const [expandedProjectNoteIds, setExpandedProjectNoteIds] = useState<
    number[]
  >([]);
  const projectDossierRefs = useRef<Record<string, View | null>>({});
  const [localSelectedTodo, setLocalSelectedTodo] = useState<Todo | null>(
    selectedTodo,
  );
  const [isListeningToVoice, setIsListeningToVoice] = useState(false);
  const isListeningToVoiceRef = useRef(false);

  React.useEffect(() => {
    setLocalSelectedTodo(selectedTodo);
  }, [selectedTodo]);

  React.useEffect(() => {
    if (
      activeView !== "projects" ||
      !selectedProject ||
      !expandedProjectNoteIds.includes(selectedProject.id) ||
      !selectedTodo
    ) {
      return;
    }

    const sourceKey =
      selectedTodoSource.type === "calendar"
        ? `calendar-${selectedTodoSource.entryId}`
        : `${selectedTodoSource.type}-${selectedTodo.id}`;

    const scrollTimeout = setTimeout(() => {
      const targetRef = projectDossierRefs.current[sourceKey];
      const scrollRef = scrollViewRef.current;
      const scrollNode = scrollRef ? findNodeHandle(scrollRef) : null;
      if (!targetRef || !scrollRef || !scrollNode) return;

      targetRef.measureLayout(
        scrollNode,
        (_x, y) => {
          scrollRef.scrollTo({ y: Math.max(0, y - 8), animated: true });
        },
        () => undefined,
      );
    }, 120);

    return () => clearTimeout(scrollTimeout);
  }, [
    activeView,
    expandedProjectNoteIds,
    selectedProject,
    selectedTodo,
    selectedTodoSource,
  ]);

  React.useEffect(() => {
    if (!showSettings || (activeView !== "notes" && activeView !== "projects")) {
      return;
    }

    const scrollTimeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: settingsTopRef.current,
        animated: true,
      });
    }, 80);

    return () => clearTimeout(scrollTimeout);
  }, [activeView, selectedTodo?.id, showSettings]);

  const handleTodoUpdate = (updates: Partial<Todo>) => {
    if (localSelectedTodo) {
      const updatedTodo = { ...localSelectedTodo, ...updates };
      setLocalSelectedTodo(updatedTodo);

      if (selectedTodoSource.type === "archive") {
        updateArchivedTodo(updatedTodo.id, updates);
      } else if (selectedTodoSource.type === "calendar") {
        updateCalendarEntryTodo(selectedTodoSource.entryId, updates);
      } else {
        updateTodo(updatedTodo.id, updates);
      }
    }
  };

  const requestMicrophonePermission = async () => {
    if (Platform.OS !== "android") return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleVoiceDictation = async () => {
    if (!voiceEnabled || !localSelectedTodo) return;

    if (isListeningToVoiceRef.current) {
      VoiceModule?.stopSpeechRecognition?.();
      return;
    }

    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;

      const isAvailable =
        (await VoiceModule?.isSpeechRecognitionAvailable?.()) !== false;
      if (!isAvailable || !VoiceModule?.startSpeechRecognition) return;

      setIsListeningToVoice(true);
      isListeningToVoiceRef.current = true;
      const transcription = await VoiceModule.startSpeechRecognition(
        getNativeVoiceLanguageTag(voiceLanguage),
        voiceAutoStop,
      );
      const nextNote = appendTranscriptionToNote(
        localSelectedTodo.note,
        String(transcription ?? ""),
        localSelectedTodo.noteType,
      );

      if (nextNote !== localSelectedTodo.note) {
        handleTodoUpdate({ note: nextNote });
      }
    } catch (error) {
      if (!isExpectedVoiceDictationMiss(error)) {
        console.warn("Voice dictation failed:", error);
      }
    } finally {
      setIsListeningToVoice(false);
      isListeningToVoiceRef.current = false;
    }
  };

  const handleAttachPhoto = async () => {
    if (!photoAttachmentsEnabled || !localSelectedTodo) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "image/*",
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const attachmentsDirectory = `${FileSystem.documentDirectory}note-attachments/`;
      await FileSystem.makeDirectoryAsync(attachmentsDirectory, {
        intermediates: true,
      });

      const fileName = getAttachmentFileName(asset.name, asset.uri);
      const destinationUri = `${attachmentsDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: asset.uri,
        to: destinationUri,
      });

      const nextTodo = appendPhotoAttachment(localSelectedTodo, {
        id: `${localSelectedTodo.id}-${Date.now()}`,
        uri: destinationUri,
        name: asset.name ?? fileName,
        createdAt: new Date().toISOString(),
      });

      handleTodoUpdate({ attachments: nextTodo.attachments });
    } catch (error) {
      console.warn("Photo attachment failed:", error);
      Alert.alert("Photo", "Could not attach this photo.");
    }
  };

  const handleTakePhoto = async () => {
    if (!photoAttachmentsEnabled || !localSelectedTodo) return;

    try {
      if (Platform.OS === "android") {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("Camera", "Camera permission is needed to take photos.");
          return;
        }
      }

      if (!PhotoTextModule?.takePhoto) {
        Alert.alert("Camera", "Camera is not available.");
        return;
      }

      const photo = await PhotoTextModule.takePhoto();
      if (!photo?.uri) return;

      const nextTodo = appendPhotoAttachment(localSelectedTodo, {
        id: `${localSelectedTodo.id}-${Date.now()}`,
        uri: photo.uri,
        name: photo.name ?? getAttachmentFileName(null, photo.uri),
        createdAt: photo.createdAt ?? new Date().toISOString(),
      });

      handleTodoUpdate({ attachments: nextTodo.attachments });
    } catch (error) {
      console.warn("Camera photo failed:", error);
      Alert.alert("Camera", "Could not take this photo.");
    }
  };

  const handleRemovePhotoAttachment = async (attachmentId: string) => {
    if (!localSelectedTodo) return;

    const attachment = localSelectedTodo.attachments?.find(
      (item) => item.id === attachmentId,
    );
    const nextTodo = removePhotoAttachment(localSelectedTodo, attachmentId);
    handleTodoUpdate({ attachments: nextTodo.attachments });

    if (attachment?.uri?.startsWith(FileSystem.documentDirectory ?? "")) {
      FileSystem.deleteAsync(attachment.uri, { idempotent: true }).catch(() => {
        // The note state is the source of truth; stale files can be cleaned later.
      });
    }
  };

  const handleScanPhotoAttachment = async (attachmentId: string) => {
    if (!photoScanEnabled || !localSelectedTodo) return;

    const attachment = localSelectedTodo.attachments?.find(
      (item) => item.id === attachmentId,
    );

    if (!attachment || !PhotoTextModule?.recognizeText) {
      Alert.alert("Scan text", "Text scanning is not available.");
      return;
    }

    try {
      const scanResult = await PhotoTextModule.recognizeText(attachment.uri);
      const scannedText = formatPhotoScanText(scanResult, photoScanFormat);
      const nextNote = appendTranscriptionToNote(
        localSelectedTodo.note,
        scannedText,
        localSelectedTodo.noteType,
      );

      if (nextNote === localSelectedTodo.note) {
        Alert.alert("Scan text", "No text was found in this photo.");
        return;
      }

      handleTodoUpdate({ note: nextNote });
    } catch (error) {
      console.warn("Photo text scan failed:", error);
      Alert.alert("Scan text", "Could not scan text from this photo.");
    }
  };

  const renderVoiceButton = () => {
    if (
      !voiceEnabled ||
      !localSelectedTodo ||
      activeView === "timer" ||
      activeView === "settings"
    ) {
      return null;
    }

    const noteColor = getNoteBackgroundColor(localSelectedTodo.color, theme);
    const voiceButtonBackground = isListeningToVoice
      ? mixHexColors(noteColor, theme.primary, theme.mode === "dark" ? 0.2 : 0.12)
      : mixHexColors(noteColor, theme.elevated, theme.mode === "dark" ? 0.28 : 0.18);
    const voiceButtonBorder = mixHexColors(
      noteColor,
      theme.text,
      theme.mode === "dark" ? 0.26 : 0.2,
    );
    const voiceIconColor = isListeningToVoice
      ? getReadableIconColor(voiceButtonBackground)
      : mixHexColors(getReadableIconColor(voiceButtonBackground), theme.mutedText, 0.18);

    return (
      <TouchableOpacity
        onPress={handleVoiceDictation}
        activeOpacity={0.75}
        style={[
          styles.voiceButton,
          {
            backgroundColor: voiceButtonBackground,
            borderColor: voiceButtonBorder,
          },
        ]}
      >
        <Ionicons
          name={isListeningToVoice ? "stop" : "mic-outline"}
          size={16}
          color={voiceIconColor}
        />
      </TouchableOpacity>
    );
  };

  const renderPhotoButton = () => {
    if (
      !photoAttachmentsEnabled ||
      !localSelectedTodo ||
      activeView === "timer" ||
      activeView === "settings"
    ) {
      return null;
    }

    const noteColor = getNoteBackgroundColor(localSelectedTodo.color, theme);
    const backgroundColor = mixHexColors(
      noteColor,
      theme.elevated,
      theme.mode === "dark" ? 0.28 : 0.18,
    );
    const borderColor = mixHexColors(
      noteColor,
      theme.text,
      theme.mode === "dark" ? 0.26 : 0.2,
    );

    return (
      <TouchableOpacity
        onPress={handleAttachPhoto}
        activeOpacity={0.75}
        style={[
          styles.voiceButton,
          {
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <Ionicons
          name="image-outline"
          size={16}
          color={mixHexColors(getReadableIconColor(backgroundColor), theme.mutedText, 0.18)}
        />
      </TouchableOpacity>
    );
  };

  const renderCameraButton = () => {
    if (
      !photoAttachmentsEnabled ||
      !localSelectedTodo ||
      activeView === "timer" ||
      activeView === "settings"
    ) {
      return null;
    }

    const noteColor = getNoteBackgroundColor(localSelectedTodo.color, theme);
    const backgroundColor = mixHexColors(
      noteColor,
      theme.elevated,
      theme.mode === "dark" ? 0.28 : 0.18,
    );
    const borderColor = mixHexColors(
      noteColor,
      theme.text,
      theme.mode === "dark" ? 0.26 : 0.2,
    );

    return (
      <TouchableOpacity
        onPress={handleTakePhoto}
        activeOpacity={0.75}
        style={[
          styles.voiceButton,
          {
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <Ionicons
          name="camera-outline"
          size={16}
          color={mixHexColors(getReadableIconColor(backgroundColor), theme.mutedText, 0.18)}
        />
      </TouchableOpacity>
    );
  };

  const renderNoteFooterActions = () => {
    const photoButton = renderPhotoButton();
    const cameraButton = renderCameraButton();
    const voiceButton = renderVoiceButton();

    if (!photoButton && !cameraButton && !voiceButton) return null;

    return (
      <View style={styles.noteFooterActions}>
        {photoButton}
        {cameraButton}
        {voiceButton}
      </View>
    );
  };

  const getSelectedTodoArchiveAction = () => {
    return getArchiveActionForSelection(activeView, selectedTodoSource);
  };

  const handleSelectedTodoArchiveAction = () => {
    if (!localSelectedTodo) return;

    if (shouldUnarchiveSelection(activeView, selectedTodoSource)) {
      const nextTodo = { ...localSelectedTodo, isEditing: false };
      unarchiveTodo(localSelectedTodo.id);
      setLocalSelectedTodo(nextTodo);
      selectTodo(nextTodo, { type: "todo" });
      return;
    }

    if (selectedTodoSource.type === "calendar") {
      return;
    }

    const nextTodo = archiveTodo(localSelectedTodo.id);
    setLocalSelectedTodo(nextTodo);
    selectTodo(nextTodo, { type: "todo" });
  };

  const measureScrollFrame = () => {
    scrollFrameViewRef.current?.measureInWindow((_, pageY, __, height) => {
      scrollFrameRef.current = { pageY, height };
    });
  };

  const handleListDragChange = (isDragging: boolean) => {
    setIsListDragging(isDragging);

    if (isDragging) {
      measureScrollFrame();
    }
  };

  const handleListDragMove = (pageY: number) => {
    const frame = scrollFrameRef.current;
    if (frame.height <= 0) return 0;

    const maxScrollY = Math.max(
      0,
      scrollContentHeightRef.current - frame.height,
    );
    const edgeSize = 64;
    const distanceFromTop = pageY - frame.pageY;
    const distanceFromBottom = frame.pageY + frame.height - pageY;
    let delta = 0;

    if (distanceFromTop < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromTop) / edgeSize;
      delta = -Math.max(2, Math.round(pressure * 5));
    } else if (distanceFromBottom < edgeSize) {
      const pressure = Math.max(0, edgeSize - distanceFromBottom) / edgeSize;
      delta = Math.max(2, Math.round(pressure * 5));
    }

    if (delta === 0) return 0;

    const nextY = Math.max(0, Math.min(maxScrollY, scrollYRef.current + delta));
    const appliedDelta = nextY - scrollYRef.current;

    if (appliedDelta === 0) return 0;

    scrollYRef.current = nextY;
    scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
    return appliedDelta;
  };

  const isProjectDossierOpen = (projectId: number) =>
    expandedProjectNoteIds.includes(projectId);

  const toggleProjectDossier = (projectId: number) => {
    setExpandedProjectNoteIds((currentIds) =>
      currentIds.includes(projectId)
        ? currentIds.filter((id) => id !== projectId)
        : [...currentIds, projectId],
    );
  };

  const getProjectRows = (projectId: number): ProjectDossierRow[] => [
    ...todos
      .filter((todo) => todo.projectId === projectId)
      .map((todo) => ({ todo, source: { type: "todo" as const } })),
    ...archivedTodos
      .filter((todo) => todo.projectId === projectId)
      .map((todo) => ({ todo, source: { type: "archive" as const } })),
    ...calendarEntries
      .filter((entry) => entry.todo.projectId === projectId)
      .map((entry) => ({
        todo: entry.todo,
        source: { type: "calendar" as const, entryId: entry.id },
      })),
  ];

  const getProjectRowKey = (row: ProjectDossierRow) =>
    row.source.type === "calendar"
      ? `calendar-${row.source.entryId}`
      : `${row.source.type}-${row.todo.id}`;

  const updateProjectRowTodo = (
    row: ProjectDossierRow,
    updates: Partial<Todo>,
  ) => {
    if (row.source.type === "archive") {
      updateArchivedTodo(row.todo.id, updates);
      return;
    }

    if (row.source.type === "calendar") {
      updateCalendarEntryTodo(row.source.entryId, updates);
      return;
    }

    updateTodo(row.todo.id, updates);
  };

  const getProjectDossierSections = (project: Project) => {
    const sections = [
      {
        project,
        rows: getProjectRows(project.id),
      },
    ];

    if (!project.parentProjectId) {
      projects
        .filter((item) => item.parentProjectId === project.id)
        .forEach((subproject) => {
          sections.push({
            project: subproject,
            rows: getProjectRows(subproject.id),
          });
        });
    }

    return sections;
  };

  const getActiveDossierProject = () => {
    if (selectedProject && isProjectDossierOpen(selectedProject.id)) {
      return selectedProject;
    }

    if (!localSelectedTodo?.projectId) return null;

    const ownerProject = projects.find(
      (project) => project.id === localSelectedTodo.projectId,
    );
    if (!ownerProject) return null;

    if (isProjectDossierOpen(ownerProject.id)) {
      return ownerProject;
    }

    const parentProject = ownerProject.parentProjectId
      ? projects.find((project) => project.id === ownerProject.parentProjectId)
      : null;

    return parentProject && isProjectDossierOpen(parentProject.id)
      ? parentProject
      : null;
  };

  const copyProjectDossier = (project: Project) => {
    const parts: string[] = [];

    parts.push(`# ${project.title || "Untitled"}`);
    if (project.note.trim()) parts.push(project.note.trim());

    getProjectDossierSections(project).forEach((section) => {
      if (section.project.id !== project.id) {
        parts.push(`## ${section.project.title || "Untitled"}`);
        if (section.project.note.trim()) parts.push(section.project.note.trim());
      }

      section.rows.forEach((row) => {
        parts.push(`### ${row.todo.text || "Untitled"}`);
        if (row.todo.note.trim()) parts.push(row.todo.note.trim());
      });
    });

    TimerModule?.copyTextToClipboard?.(parts.join("\n\n"));
  };

  const renderProjectHeaderActions = (project: Project) => {
    const isExpanded = isProjectDossierOpen(project.id);

    return (
      <>
        <TouchableOpacity
          onPress={() => toggleProjectDossier(project.id)}
          style={[styles.projectHeaderButton, { borderColor: theme.border }]}
        >
          <Ionicons
            name={isExpanded ? "albums" : "albums-outline"}
            size={16}
            color={isExpanded ? theme.primary : theme.mutedText}
          />
        </TouchableOpacity>
        {isExpanded ? (
          <TouchableOpacity
            onPress={() => copyProjectDossier(project)}
            style={[styles.projectHeaderButton, { borderColor: theme.border }]}
          >
            <Ionicons name="copy-outline" size={16} color={theme.mutedText} />
          </TouchableOpacity>
        ) : null}
      </>
    );
  };

  const renderProjectNoteCard = (project: Project) => (
    <TodoItemNote
      key={`project-${project.id}`}
      todo={{
        id: project.id,
        text: project.title,
        note: project.note,
        color: project.color,
        isEditing: false,
        noteType: "text",
        createdAt: project.createdAt,
      }}
      headerRight={renderProjectHeaderActions(project)}
      showTitle
      updateNote={(noteText: string) =>
        updateProject(project.id, { note: noteText })
      }
      onStartEditing={() => setIsEditing(true)}
      onEndEditing={() => setIsEditing(false)}
      onListDragChange={handleListDragChange}
      onListDragMove={handleListDragMove}
    />
  );

  const renderProjectDossier = (project: Project) => (
    <>
      {renderProjectNoteCard(project)}
      {getProjectDossierSections(project).map((section) => (
        <View
          key={section.project.id}
          style={
            section.project.id === project.id
              ? styles.projectDossierSection
              : styles.subprojectDossierSection
          }
        >
          {section.project.id !== project.id ? (
            <Text style={[styles.subprojectTitle, { color: theme.mutedText }]}>
              {section.project.title || "Untitled"}
            </Text>
          ) : null}
          {section.rows.map((row) => {
            const rowKey = getProjectRowKey(row);

            return (
              <View
                key={rowKey}
                ref={(ref) => {
                  projectDossierRefs.current[rowKey] = ref;
                }}
                style={styles.projectDossierNote}
              >
                <TodoItemNote
                  todo={row.todo}
                  showTitle
                  titleSize={15}
                  photoAttachmentsEnabled={photoAttachmentsEnabled}
                  photoScanEnabled={false}
                  onRemovePhotoAttachment={(attachmentId) => {
                    const nextTodo = removePhotoAttachment(row.todo, attachmentId);
                    updateProjectRowTodo(row, { attachments: nextTodo.attachments });
                  }}
                  updateNote={(noteText: string) =>
                    updateProjectRowTodo(row, { note: noteText })
                  }
                  onStartEditing={() => {
                    setIsEditing(true);
                    setShowSettings(false);
                  }}
                  onEndEditing={() => setIsEditing(false)}
                  onListDragChange={handleListDragChange}
                  onListDragMove={handleListDragMove}
                />
              </View>
            );
          })}
        </View>
      ))}
      {showSettings && (
        <ProjectSettings
          project={project}
          updateProject={(updates) => updateProject(project.id, updates)}
          createSubproject={() => createSubproject(project)}
          removeProject={() => removeProject(project.id)}
        />
      )}
    </>
  );

  const renderContent = () => {
    if (activeView === "timer") {
      return <TimerView selectedTodo={selectedTodo} updateTodo={updateTodo} />;
    }

    if (activeView === "projects") {
      const activeDossierProject = getActiveDossierProject();

      if (activeDossierProject) {
        return renderProjectDossier(activeDossierProject);
      }

      if (localSelectedTodo) {
        return (
          <>
            <TodoItemNote
              key={getTodoNoteRenderKey(
                activeView,
                localSelectedTodo,
                selectedTodoSource,
              )}
              todo={localSelectedTodo}
              showTitle={isNoteFullscreen}
              photoAttachmentsEnabled={photoAttachmentsEnabled}
              photoScanEnabled={photoScanEnabled}
              onRemovePhotoAttachment={handleRemovePhotoAttachment}
              onScanPhotoAttachment={handleScanPhotoAttachment}
              updateNote={(noteText: string) =>
                handleTodoUpdate({ note: noteText })
              }
              onStartEditing={() => {
                setIsEditing(true);
                setShowSettings(false);
              }}
              onEndEditing={() => setIsEditing(false)}
              onListDragChange={handleListDragChange}
              onListDragMove={handleListDragMove}
              footerRight={renderNoteFooterActions()}
            />
            {showSettings && (
              <View
                style={styles.settingsContainer}
                onLayout={(event) => {
                  settingsTopRef.current = Math.max(
                    0,
                    event.nativeEvent.layout.y - 4,
                  );
                  scrollViewRef.current?.scrollTo({
                    y: settingsTopRef.current,
                    animated: true,
                  });
                }}
              >
                <TodoSettings
                  todo={localSelectedTodo}
                  projects={projects}
                  dateFormat={dateFormat}
                  updateTodo={handleTodoUpdate}
                  removeTodo={() => {
                    if (localSelectedTodo) {
                      const nextTodo = removeTodo(localSelectedTodo.id);
                      setLocalSelectedTodo(nextTodo);
                    }
                  }}
                  archiveAction={getSelectedTodoArchiveAction()}
                  archiveTodo={handleSelectedTodoArchiveAction}
                  printOnCalendar={printOnCalendar}
                />
              </View>
            )}
          </>
        );
      }

      if (!selectedProject) return null;

      return (
        <>
          {renderProjectNoteCard(selectedProject)}
          {showSettings && (
            <ProjectSettings
              project={selectedProject}
              updateProject={(updates) =>
                updateProject(selectedProject.id, updates)
              }
              createSubproject={() => createSubproject(selectedProject)}
              removeProject={() => removeProject(selectedProject.id)}
            />
          )}
        </>
      );
    }

    if (activeView === "settings") {
      return (
        <AppSettings
          archivedTodos={archivedTodos}
          calendarEntries={calendarEntries}
          deleteTrashedTodo={deleteTrashedTodo}
          emptyTrash={emptyTrash}
          exportData={exportData}
          importData={importData}
          onOpenTodo={onOpenTodoFromSettings}
          restoreTrashedTodo={restoreTrashedTodo}
          calendarAutoScrollToNow={calendarAutoScrollToNow}
          calendarProjectionRange={calendarProjectionRange}
          dateFormat={dateFormat}
          voiceAutoStop={voiceAutoStop}
          voiceEnabled={voiceEnabled}
          voiceLanguage={voiceLanguage}
          photoAttachmentsEnabled={photoAttachmentsEnabled}
          photoScanEnabled={photoScanEnabled}
          photoScanFormat={photoScanFormat}
          setCalendarAutoScrollToNow={setCalendarAutoScrollToNow}
          setCalendarProjectionRange={setCalendarProjectionRange}
          setDateFormat={setDateFormat}
          setVoiceAutoStop={setVoiceAutoStop}
          setVoiceEnabled={setVoiceEnabled}
          setVoiceLanguage={setVoiceLanguage}
          setPhotoAttachmentsEnabled={setPhotoAttachmentsEnabled}
          setPhotoScanEnabled={setPhotoScanEnabled}
          setPhotoScanFormat={setPhotoScanFormat}
          setTrashRetention={setTrashRetention}
          todos={todos}
          trashedTodos={trashedTodos}
          trashRetention={trashRetention}
          updateArchivedTodo={updateArchivedTodo}
          updateCalendarEntryTodo={updateCalendarEntryTodo}
          updateTodo={updateTodo}
        />
      );
    }

    if (activeView === "archive") {
      return (
        <ArchivedTodos
          archivedTodos={archivedTodos}
          hiddenArchivedTodoIds={todayItems
            .filter((item) => item.source.type === "archived-repeat")
            .map((item) => item.source.todoId)}
          setArchivedTodos={setArchivedTodos}
          unarchiveTodo={unarchiveTodo}
          updateArchivedTodo={updateArchivedTodo}
          updateTodo={updateTodo}
          todos={todos}
          setTodos={setTodos}
          isExpanded={isNoteFullscreen}
          onNoteBodyDragChange={handleListDragChange}
          onNoteBodyDragMove={handleListDragMove}
          onOpenCalendarEntry={onOpenCalendarEntry}
        />
      );
    }

    return (
      localSelectedTodo && (
        <>
          <TodoItemNote
            key={getTodoNoteRenderKey(
              activeView,
              localSelectedTodo,
              selectedTodoSource,
            )}
            todo={localSelectedTodo}
            showTitle={isNoteFullscreen}
            photoAttachmentsEnabled={photoAttachmentsEnabled}
            photoScanEnabled={photoScanEnabled}
            onRemovePhotoAttachment={handleRemovePhotoAttachment}
            onScanPhotoAttachment={handleScanPhotoAttachment}
            updateNote={(noteText: string) =>
              handleTodoUpdate({ note: noteText })
            }
            onStartEditing={() => {
              setIsEditing(true);
              setShowSettings(false);
            }}
            onEndEditing={() => setIsEditing(false)}
            onListDragChange={handleListDragChange}
            onListDragMove={handleListDragMove}
            footerRight={renderNoteFooterActions()}
          />
          {activeView === "notes" && showSettings && (
            <View
              style={styles.settingsContainer}
              onLayout={(event) => {
                settingsTopRef.current = Math.max(
                  0,
                  event.nativeEvent.layout.y - 4,
                );
                scrollViewRef.current?.scrollTo({
                  y: settingsTopRef.current,
                  animated: true,
                });
              }}
            >
              <TodoSettings
                todo={localSelectedTodo}
                projects={projects}
                dateFormat={dateFormat}
                updateTodo={handleTodoUpdate}
                removeTodo={() => {
                  if (localSelectedTodo) {
                    const nextTodo = removeTodo(localSelectedTodo.id);
                    setLocalSelectedTodo(nextTodo);
                  }
                }}
                archiveAction={getSelectedTodoArchiveAction()}
                archiveTodo={handleSelectedTodoArchiveAction}
                printOnCalendar={printOnCalendar}
              />
            </View>
          )}
        </>
      )
    );
  };

  return (
    <View
      ref={scrollFrameViewRef}
      onLayout={measureScrollFrame}
      style={[
        styles.container,
        isNoteFullscreen &&
          (activeView === "notes" || activeView === "archive") &&
          (activeView === "archive"
            ? styles.archiveFullscreenContainer
            : styles.fullscreenContainer),
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        scrollEnabled={!isListDragging}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={(_, height) => {
          scrollContentHeightRef.current = height;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          !showSettings ? styles.shadowEndPadding : null,
          isNoteFullscreen && activeView === "notes"
            ? styles.fullscreenScrollContent
            : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const isExpectedVoiceDictationMiss = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("No speech was recognized") ||
    message.includes("No speech was heard") ||
    message.includes("speech_error_7") ||
    message.includes("speech_error_6")
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
    paddingRight: 2,
  },
  fullscreenContainer: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 12,
  },
  archiveFullscreenContainer: {
    paddingLeft: 4,
    paddingRight: 4,
    paddingBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingRight: 4,
  },
  shadowEndPadding: {
    paddingBottom: 8,
  },
  fullscreenScrollContent: {
    flexGrow: 1,
  },
  projectDossierNote: {
    marginTop: 8,
  },
  projectDossierSection: {
    marginTop: 8,
  },
  projectHeaderButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  settingsContainer: {
    marginTop: 8,
  },
  subprojectDossierSection: {
    marginLeft: 12,
    marginTop: 12,
  },
  subprojectTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
    marginLeft: 4,
    marginTop: 2,
  },
  voiceButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  noteFooterActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});

export default TodoNoteColumn;
