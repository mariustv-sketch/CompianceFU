import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { SubtaskConfig } from '../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';

// ---- Helpers ----
function newTask(question = ''): SubtaskConfig {
  return {
    id: Math.random().toString(36).slice(2),
    question,
    yes_action: 'complete',
    yes_subtasks: [],
    no_action: 'complete',
    no_subtasks: [],
  };
}

function updateTaskInTree(
  tasks: SubtaskConfig[],
  taskId: string,
  updater: (t: SubtaskConfig) => SubtaskConfig
): SubtaskConfig[] {
  return tasks.map((task) => {
    if (task.id === taskId) return updater(task);
    return {
      ...task,
      yes_subtasks: updateTaskInTree(task.yes_subtasks, taskId, updater),
      no_subtasks: updateTaskInTree(task.no_subtasks, taskId, updater),
    };
  });
}

function addSubtaskInTree(
  tasks: SubtaskConfig[],
  parentId: string,
  answerType: 'yes' | 'no',
  newSubtask: SubtaskConfig
): SubtaskConfig[] {
  return tasks.map((task) => {
    if (task.id === parentId) {
      if (answerType === 'yes') {
        return { ...task, yes_subtasks: [...task.yes_subtasks, newSubtask] };
      } else {
        return { ...task, no_subtasks: [...task.no_subtasks, newSubtask] };
      }
    }
    return {
      ...task,
      yes_subtasks: addSubtaskInTree(task.yes_subtasks, parentId, answerType, newSubtask),
      no_subtasks: addSubtaskInTree(task.no_subtasks, parentId, answerType, newSubtask),
    };
  });
}

function removeTaskFromTree(tasks: SubtaskConfig[], taskId: string): SubtaskConfig[] {
  return tasks
    .filter((t) => t.id !== taskId)
    .map((t) => ({
      ...t,
      yes_subtasks: removeTaskFromTree(t.yes_subtasks, taskId),
      no_subtasks: removeTaskFromTree(t.no_subtasks, taskId),
    }));
}

// ---- Edit modal ----
interface EditModalProps {
  visible: boolean;
  task: SubtaskConfig;
  onSave: (updated: SubtaskConfig) => void;
  onClose: () => void;
}

function EditModal({ visible, task, onSave, onClose }: EditModalProps) {
  const [question, setQuestion] = useState(task.question);
  const [yesAction, setYesAction] = useState<'complete' | 'create_subtasks'>(task.yes_action);
  const [noAction, setNoAction] = useState<'complete' | 'create_subtasks'>(task.no_action);

  function handleSave() {
    if (!question.trim()) {
      Alert.alert('Feil', 'Spørsmål kan ikke være tomt');
      return;
    }
    onSave({
      ...task,
      question: question.trim(),
      yes_action: yesAction,
      no_action: noAction,
      // If switching from create_subtasks to complete, clear subtasks
      yes_subtasks: yesAction === 'complete' ? [] : task.yes_subtasks,
      no_subtasks: noAction === 'complete' ? [] : task.no_subtasks,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={modal.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Rediger oppgave</Text>

            <Text style={modal.label}>SPØRSMÅL</Text>
            <TextInput
              testID="edit-task-question-input"
              style={modal.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="F.eks. Er sikkerhetsutstyr på plass?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <Text style={modal.label}>VED JA-SVAR</Text>
            <View style={modal.toggleRow}>
              <TouchableOpacity
                testID="yes-complete-toggle"
                style={[modal.toggleBtn, yesAction === 'complete' && modal.toggleBtnActive]}
                onPress={() => setYesAction('complete')}
              >
                <Text style={[modal.toggleBtnText, yesAction === 'complete' && modal.toggleBtnTextActive]}>
                  Fullfør
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="yes-subtasks-toggle"
                style={[modal.toggleBtn, yesAction === 'create_subtasks' && modal.toggleBtnActiveGreen]}
                onPress={() => setYesAction('create_subtasks')}
              >
                <Text style={[modal.toggleBtnText, yesAction === 'create_subtasks' && modal.toggleBtnTextActive]}>
                  Deloppgaver
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={modal.label}>VED NEI-SVAR</Text>
            <View style={modal.toggleRow}>
              <TouchableOpacity
                testID="no-complete-toggle"
                style={[modal.toggleBtn, noAction === 'complete' && modal.toggleBtnActive]}
                onPress={() => setNoAction('complete')}
              >
                <Text style={[modal.toggleBtnText, noAction === 'complete' && modal.toggleBtnTextActive]}>
                  Fullfør
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="no-subtasks-toggle"
                style={[modal.toggleBtn, noAction === 'create_subtasks' && modal.toggleBtnActiveRed]}
                onPress={() => setNoAction('create_subtasks')}
              >
                <Text style={[modal.toggleBtnText, noAction === 'create_subtasks' && modal.toggleBtnTextActive]}>
                  Deloppgaver
                </Text>
              </TouchableOpacity>
            </View>

            <View style={modal.btnRow}>
              <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
                <Text style={modal.cancelBtnText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-task-btn" style={modal.saveBtn} onPress={handleSave}>
                <Text style={modal.saveBtnText}>Lagre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ---- Task node (recursive) ----
interface TaskNodeProps {
  task: SubtaskConfig;
  level: number;
  onUpdate: (taskId: string, updated: SubtaskConfig) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string, answerType: 'yes' | 'no') => void;
}

function TaskNode({ task, level, onUpdate, onDelete, onAddSubtask }: TaskNodeProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const [editVisible, setEditVisible] = useState(false);

  const indent = level * 12;

  return (
    <View style={{ marginLeft: indent }}>
      {level > 0 && <View style={node.levelLine} />}
      <View testID={`task-node-${task.id}`} style={node.card}>
        {/* Header */}
        <TouchableOpacity
          testID={`task-expand-${task.id}`}
          style={node.header}
          onPress={() => setExpanded(!expanded)}
        >
          <View style={node.headerLeft}>
            <Text style={node.questionText} numberOfLines={expanded ? undefined : 2}>
              {task.question || '(tomt spørsmål)'}
            </Text>
            <View style={node.badges}>
              <View style={[node.badge, { backgroundColor: COLORS.success + '22' }]}>
                <Text style={[node.badgeText, { color: COLORS.success }]}>
                  Ja → {task.yes_action === 'complete' ? 'Fullfør' : `${task.yes_subtasks.length} del`}
                </Text>
              </View>
              <View style={[node.badge, { backgroundColor: COLORS.danger + '18' }]}>
                <Text style={[node.badgeText, { color: COLORS.danger }]}>
                  Nei → {task.no_action === 'complete' ? 'Fullfør' : `${task.no_subtasks.length} del`}
                </Text>
              </View>
            </View>
          </View>
          <Text style={node.chevron}>{expanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Actions */}
        {expanded && (
          <View>
            <View style={node.actionBar}>
              <TouchableOpacity
                testID={`edit-task-${task.id}`}
                style={node.editBtn}
                onPress={() => setEditVisible(true)}
              >
                <Text style={node.editBtnText}>Rediger</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`delete-task-${task.id}`}
                style={node.deleteBtn}
                onPress={() =>
                  Alert.alert('Slett oppgave?', 'Alle deloppgaver slettes også.', [
                    { text: 'Avbryt', style: 'cancel' },
                    { text: 'Slett', style: 'destructive', onPress: () => onDelete(task.id) },
                  ])
                }
              >
                <Text style={node.deleteBtnText}>Slett</Text>
              </TouchableOpacity>
            </View>

            {/* YES subtasks */}
            {task.yes_action === 'create_subtasks' && (
              <View style={node.subtaskSection}>
                <View style={[node.subtaskHeader, { backgroundColor: COLORS.success + '10' }]}>
                  <Text style={[node.subtaskLabel, { color: COLORS.success }]}>
                    Deloppgaver ved Ja
                  </Text>
                </View>
                {task.yes_subtasks.map((sub) => (
                  <TaskNode
                    key={sub.id}
                    task={sub}
                    level={level + 1}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddSubtask={onAddSubtask}
                  />
                ))}
                <TouchableOpacity
                  testID={`add-yes-subtask-${task.id}`}
                  style={[node.addSubBtn, { borderColor: COLORS.success + '80' }]}
                  onPress={() => onAddSubtask(task.id, 'yes')}
                >
                  <Text style={[node.addSubBtnText, { color: COLORS.success }]}>
                    + Legg til deloppgave (Ja)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* NO subtasks */}
            {task.no_action === 'create_subtasks' && (
              <View style={node.subtaskSection}>
                <View style={[node.subtaskHeader, { backgroundColor: COLORS.danger + '10' }]}>
                  <Text style={[node.subtaskLabel, { color: COLORS.danger }]}>
                    Deloppgaver ved Nei
                  </Text>
                </View>
                {task.no_subtasks.map((sub) => (
                  <TaskNode
                    key={sub.id}
                    task={sub}
                    level={level + 1}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddSubtask={onAddSubtask}
                  />
                ))}
                <TouchableOpacity
                  testID={`add-no-subtask-${task.id}`}
                  style={[node.addSubBtn, { borderColor: COLORS.danger + '80' }]}
                  onPress={() => onAddSubtask(task.id, 'no')}
                >
                  <Text style={[node.addSubBtnText, { color: COLORS.danger }]}>
                    + Legg til deloppgave (Nei)
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Edit modal */}
      {editVisible && (
        <EditModal
          visible={editVisible}
          task={task}
          onSave={(updated) => {
            onUpdate(task.id, updated);
            setEditVisible(false);
          }}
          onClose={() => setEditVisible(false)}
        />
      )}
    </View>
  );
}

// ---- Main export ----
interface TaskTreeEditorProps {
  tasks: SubtaskConfig[];
  onTasksChange: (tasks: SubtaskConfig[]) => void;
}

export function TaskTreeEditor({ tasks, onTasksChange }: TaskTreeEditorProps) {
  function handleUpdate(taskId: string, updated: SubtaskConfig) {
    onTasksChange(updateTaskInTree(tasks, taskId, () => updated));
  }

  function handleDelete(taskId: string) {
    onTasksChange(removeTaskFromTree(tasks, taskId));
  }

  function handleAddSubtask(parentId: string, answerType: 'yes' | 'no') {
    const sub = newTask('Ny deloppgave');
    onTasksChange(addSubtaskInTree(tasks, parentId, answerType, sub));
  }

  function addTopLevelTask() {
    onTasksChange([...tasks, newTask('Ny oppgave')]);
  }

  return (
    <View style={tree.container}>
      {tasks.length === 0 && (
        <View style={tree.emptyWrap}>
          <Text style={tree.emptyText}>Ingen oppgaver ennå. Legg til en oppgave nedenfor.</Text>
        </View>
      )}
      {tasks.map((task) => (
        <TaskNode
          key={task.id}
          task={task}
          level={0}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddSubtask={handleAddSubtask}
        />
      ))}
      <TouchableOpacity
        testID="add-top-task-btn"
        style={tree.addBtn}
        onPress={addTopLevelTask}
      >
        <Text style={tree.addBtnText}>+ Legg til oppgave</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Styles ----
const node = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.sm + 4,
    gap: SPACING.sm,
  },
  headerLeft: { flex: 1, gap: 6 },
  questionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 21,
  },
  badges: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  chevron: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  actionBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm + 4,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.sm,
  },
  editBtn: {
    flex: 1,
    backgroundColor: COLORS.primary + '14',
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: COLORS.danger + '12',
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  subtaskSection: {
    marginHorizontal: SPACING.sm + 4,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  subtaskHeader: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 1,
  },
  subtaskLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addSubBtn: {
    margin: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addSubBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  levelLine: {
    position: 'absolute',
    left: -8,
    top: 0,
    bottom: SPACING.sm,
    width: 2,
    backgroundColor: COLORS.border,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    paddingBottom: 32,
    gap: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleBtnActiveGreen: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  toggleBtnActiveRed: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  toggleBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  toggleBtnTextActive: {
    color: COLORS.textInverse,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
});

const tree = StyleSheet.create({
  container: { gap: SPACING.xs },
  emptyWrap: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  addBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary + '60',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
    backgroundColor: COLORS.primary + '06',
  },
  addBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
