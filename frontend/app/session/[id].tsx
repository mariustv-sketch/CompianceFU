import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from '../../services/api';
import { Job, Session, SubtaskConfig, ExecutionTask, AnswerRecord } from '../../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

// ---- Helpers ----
function buildExecutionList(
  tasks: SubtaskConfig[],
  answersMap: Record<string, AnswerRecord>
): ExecutionTask[] {
  const result: ExecutionTask[] = [];
  function addTasks(items: SubtaskConfig[], level: number, parentId: string | null) {
    for (const task of items) {
      result.push({ config: task, level, parent_id: parentId });
      const answer = answersMap[task.id];
      if (answer) {
        const action = answer.answer === 'ja' ? task.yes_action : task.no_action;
        const subtasks = answer.answer === 'ja' ? task.yes_subtasks : task.no_subtasks;
        if (action === 'create_subtasks' && subtasks.length > 0) {
          addTasks(subtasks, level + 1, task.id);
        }
      }
    }
  }
  addTasks(tasks, 0, null);
  return result;
}

function collectDescendants(taskId: string, list: ExecutionTask[]): string[] {
  const directChildren = list.filter((t) => t.parent_id === taskId).map((t) => t.config.id);
  const all = [...directChildren];
  directChildren.forEach((childId) => {
    all.push(...collectDescendants(childId, list));
  });
  return all;
}

function buildPDFHtml(
  session: Session,
  executionList: ExecutionTask[],
  answers: Record<string, AnswerRecord>
): string {
  const now = new Date().toLocaleString('nb-NO');
  const started = new Date(session.started_at).toLocaleString('nb-NO');
  const completed = session.completed_at
    ? new Date(session.completed_at).toLocaleString('nb-NO')
    : now;

  const tasksHtml = executionList
    .map((item) => {
      const a = answers[item.config.id];
      const indent = item.level * 22;
      const answerColor = a?.answer === 'ja' ? '#16A34A' : '#DC2626';
      const answerLabel = a?.answer === 'ja' ? 'JA ✓' : a?.answer === 'nei' ? 'NEI ✗' : null;
      const answeredAt = a ? new Date(a.answered_at).toLocaleString('nb-NO') : null;
      return `
      <div style="margin-left:${indent}px; padding:10px 12px; border:1.5px solid #CBD5E1; border-radius:7px; margin-bottom:8px; background:#fff;">
        <div style="font-size:13px; font-weight:700; color:#0F172A;">${escapeHtml(item.config.question)}</div>
        ${answerLabel
          ? `<div style="font-size:13px; font-weight:800; color:${answerColor}; margin-top:4px;">${answerLabel}</div>
             <div style="font-size:11px; color:#64748B; margin-top:2px;">${answeredAt}</div>`
          : `<div style="font-size:12px; color:#94A3B8; margin-top:4px; font-style:italic;">Ikke besvart</div>`
        }
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; background:#F8FAFC; }
</style></head>
<body>
  <div style="background:#00407F; color:white; padding:24px 28px;">
    <div style="font-size:20px; font-weight:900; letter-spacing:3px;">GEOMATIKK</div>
    <div style="font-size:13px; margin-top:4px; opacity:0.8;">Arbeidsflyt-rapport</div>
    <div style="font-size:11px; margin-top:6px; opacity:0.65;">Generert: ${now}</div>
  </div>
  <div style="padding:20px 24px;">
    <div style="font-size:19px; font-weight:800; color:#0F172A; margin-bottom:4px;">${escapeHtml(session.job_name)}</div>
    <div style="font-size:12px; color:#64748B; margin-bottom:20px;">
      Startet: ${started} &nbsp;•&nbsp; Fullført: ${completed}
    </div>
    ${tasksHtml}
  </div>
  <div style="margin:16px 24px 28px; padding-top:14px; border-top:1px solid #CBD5E1;">
    <div style="font-size:10px; color:#94A3B8;">Geomatikk Arbeidsflyt-kontroll • ${new Date().getFullYear()}</div>
  </div>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Task card component ----
interface TaskCardProps {
  item: ExecutionTask;
  answer: AnswerRecord | undefined;
  onAnswer: (taskId: string, answer: 'ja' | 'nei') => void;
}

function TaskCard({ item, answer, onAnswer }: TaskCardProps) {
  const isAnswered = !!answer;
  const indentLeft = item.level * 14;

  return (
    <View
      testID={`task-card-${item.config.id}`}
      style={[styles.taskCard, { marginLeft: indentLeft }]}
    >
      {item.level > 0 && <View style={styles.levelBar} />}
      <View style={styles.taskContent}>
        <View style={styles.taskLevelBadge}>
          <Text style={styles.taskLevelText}>
            {item.level === 0 ? 'Oppgave' : 'Deloppgave'}
          </Text>
        </View>
        <Text style={styles.taskQuestion}>{item.config.question}</Text>
        <View style={styles.answerRow}>
          <TouchableOpacity
            testID={`task-ja-${item.config.id}`}
            style={[
              styles.answerBtn,
              styles.jaBtn,
              answer?.answer === 'ja' && styles.jaBtnActive,
              isAnswered && answer?.answer !== 'ja' && styles.btnFaded,
            ]}
            onPress={() => onAnswer(item.config.id, 'ja')}
          >
            <Text
              style={[
                styles.answerBtnText,
                answer?.answer === 'ja' && styles.answerBtnTextActive,
              ]}
            >
              Ja
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`task-nei-${item.config.id}`}
            style={[
              styles.answerBtn,
              styles.neiBtn,
              answer?.answer === 'nei' && styles.neiBtnActive,
              isAnswered && answer?.answer !== 'nei' && styles.btnFaded,
            ]}
            onPress={() => onAnswer(item.config.id, 'nei')}
          >
            <Text
              style={[
                styles.answerBtnText,
                answer?.answer === 'nei' && styles.answerBtnTextActive,
              ]}
            >
              Nei
            </Text>
          </TouchableOpacity>
        </View>
        {isAnswered && (
          <Text style={styles.answeredAt}>
            {new Date(answer!.answered_at).toLocaleString('nb-NO')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ---- Main screen ----
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [executionList, setExecutionList] = useState<ExecutionTask[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastTaskCount, setLastTaskCount] = useState(0);

  // Load on mount
  useEffect(() => {
    async function load() {
      try {
        const sess: Session = await api.getSession(id);
        const j: Job = await api.getJob(sess.job_id);
        setSession(sess);
        setJob(j);
        const answersMap: Record<string, AnswerRecord> = {};
        sess.answers.forEach((a: AnswerRecord) => { answersMap[a.task_id] = a; });
        setAnswers(answersMap);
        const list = buildExecutionList(j.tasks, answersMap);
        setExecutionList(list);
        setLastTaskCount(list.length);
      } catch {
        Alert.alert('Feil', 'Kunne ikke laste økt');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Scroll to bottom when new subtasks appear
  useEffect(() => {
    if (executionList.length > lastTaskCount) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      setLastTaskCount(executionList.length);
    }
  }, [executionList.length]);

  // Back handler
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => handler.remove();
  }, [answers]);

  function handleBack() {
    Alert.alert(
      'Avslutte jobb?',
      'Fremdriften din er lagret. Du kan starte en ny økt senere.',
      [
        { text: 'Fortsett', style: 'cancel' },
        { text: 'Avslutt', style: 'destructive', onPress: () => router.back() },
      ]
    );
  }

  const saveToBackend = useCallback(
    async (newAnswers: Record<string, AnswerRecord>, status?: string) => {
      if (!session) return;
      try {
        const completed_at =
          status === 'completed' ? new Date().toISOString() : undefined;
        await api.updateSession(session.id, {
          answers: Object.values(newAnswers),
          status,
          completed_at,
        });
        if (status === 'completed') {
          setSession((s) => s ? { ...s, status: 'completed', completed_at: completed_at || null } : s);
        }
      } catch {
        // Silent save failure - data is in state
      }
    },
    [session]
  );

  function handleAnswer(taskId: string, answer: 'ja' | 'nei') {
    const task = executionList.find((t) => t.config.id === taskId);
    if (!task) return;

    const descendantIds = collectDescendants(taskId, executionList);
    let newList = executionList.filter((t) => !descendantIds.includes(t.config.id));
    const newAnswers = { ...answers };
    descendantIds.forEach((did) => delete newAnswers[did]);

    newAnswers[taskId] = {
      task_id: taskId,
      question: task.config.question,
      answer,
      answered_at: new Date().toISOString(),
      level: task.level,
      parent_id: task.parent_id,
    };

    const action = answer === 'ja' ? task.config.yes_action : task.config.no_action;
    const subtasks = answer === 'ja' ? task.config.yes_subtasks : task.config.no_subtasks;

    if (action === 'create_subtasks' && subtasks.length > 0) {
      const idx = newList.findIndex((t) => t.config.id === taskId);
      const newTasks: ExecutionTask[] = subtasks.map((st) => ({
        config: st,
        level: task.level + 1,
        parent_id: taskId,
      }));
      newList = [...newList.slice(0, idx + 1), ...newTasks, ...newList.slice(idx + 1)];
    }

    setExecutionList(newList);
    setAnswers(newAnswers);
    saveToBackend(newAnswers);
  }

  async function handleFerdig() {
    if (!session || !job) return;
    setGenerating(true);
    try {
      const updatedSession = {
        ...session,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
      };
      await saveToBackend(answers, 'completed');
      const html = buildPDFHtml(updatedSession, executionList, answers);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${session.job_name} - Rapport`,
        });
      } else {
        Alert.alert('PDF lagret', `Rapport lagret til: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Feil', 'Kunne ikke generere PDF');
    } finally {
      setGenerating(false);
    }
  }

  const allAnswered =
    executionList.length > 0 && executionList.every((t) => !!answers[t.config.id]);
  const answeredCount = Object.keys(answers).length;
  const progress =
    executionList.length > 0 ? answeredCount / executionList.length : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Laster jobb...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header info */}
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderLeft}>
          <Text style={styles.jobHeaderTitle} numberOfLines={1}>{session?.job_name}</Text>
          <Text style={styles.jobHeaderSub}>
            {answeredCount}/{executionList.length} besvart
          </Text>
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>

      {/* Task list */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {executionList.length === 0 ? (
          <View style={styles.noTasksWrap}>
            <Text style={styles.noTasksText}>Ingen oppgaver i denne jobben.</Text>
          </View>
        ) : (
          executionList.map((item) => (
            <TaskCard
              key={item.config.id}
              item={item}
              answer={answers[item.config.id]}
              onAnswer={handleAnswer}
            />
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky Ferdig button */}
      <View style={styles.ferdigWrap}>
        {!allAnswered && executionList.length > 0 && (
          <Text style={styles.ferdigHint}>
            Besvar alle oppgaver for å fullføre
          </Text>
        )}
        <TouchableOpacity
          testID="ferdig-btn"
          style={[
            styles.ferdigBtn,
            (!allAnswered || generating) && styles.ferdigBtnDisabled,
          ]}
          onPress={handleFerdig}
          disabled={!allAnswered || generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color={COLORS.textInverse} />
          ) : (
            <Text style={styles.ferdigBtnText}>Ferdig — Generer PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },

  // Job header
  jobHeader: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  jobHeaderLeft: { flex: 1 },
  jobHeaderTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  jobHeaderSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressWrap: { alignItems: 'flex-end', gap: 4 },
  progressBg: {
    width: 80,
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressPct: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md },

  noTasksWrap: { alignItems: 'center', padding: SPACING.xl },
  noTasksText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },

  // Task card
  taskCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  levelBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.primary + '55',
  },
  taskContent: { padding: SPACING.md, paddingLeft: SPACING.md + 4 },
  taskLevelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginBottom: 8,
  },
  taskLevelText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskQuestion: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  answerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  answerBtn: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jaBtn: { borderColor: COLORS.success, backgroundColor: 'transparent' },
  jaBtnActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  neiBtn: { borderColor: COLORS.danger, backgroundColor: 'transparent' },
  neiBtnActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  btnFaded: { opacity: 0.35 },
  answerBtnText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  answerBtnTextActive: { color: COLORS.textInverse },
  answeredAt: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 8,
  },

  // Ferdig
  ferdigWrap: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 6,
  },
  ferdigHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  ferdigBtn: {
    backgroundColor: COLORS.primary,
    height: 60,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ferdigBtnDisabled: { backgroundColor: COLORS.textMuted },
  ferdigBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
