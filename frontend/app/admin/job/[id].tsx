import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { SubtaskConfig } from '../../../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../../constants/theme';
import { TaskTreeEditor } from '../../../components/TaskTreeEditor';

export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<SubtaskConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const job = await api.getJob(id);
        setName(job.name);
        setDescription(job.description || '');
        setTasks(job.tasks || []);
      } catch {
        Alert.alert('Feil', 'Kunne ikke laste jobb');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function save() {
    if (!name.trim()) {
      Alert.alert('Feil', 'Jobbnavnet kan ikke være tomt');
      return;
    }
    setSaving(true);
    try {
      await api.updateJob(id, { name: name.trim(), description: description.trim(), tasks });
      Alert.alert('Lagret', 'Jobben er oppdatert', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Feil', 'Kunne ikke lagre jobb');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Job fields */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>JOBBNAVN *</Text>
            <TextInput
              testID="edit-job-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BESKRIVELSE</Text>
            <TextInput
              testID="edit-job-description-input"
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Valgfri beskrivelse"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Task tree */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OPPGAVER</Text>
            <TaskTreeEditor
              tasks={tasks}
              onTasksChange={setTasks}
            />
          </View>
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            testID="update-job-btn"
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.saveBtnText}>Lagre endringer</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, gap: 2 },
  section: { marginBottom: SPACING.md },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: COLORS.textMuted },
  saveBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});
