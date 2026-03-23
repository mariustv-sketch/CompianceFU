import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { api } from '../../services/api';
import { Job } from '../../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

export default function AdminIndex() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch {
      Alert.alert('Feil', 'Kunne ikke laste jobber');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function confirmDelete(job: Job) {
    Alert.alert(
      'Slette jobb?',
      `Er du sikker på at du vil slette "${job.name}"? Alle tilknyttede økter slettes også.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => deleteJob(job.id),
        },
      ]
    );
  }

  async function deleteJob(jobId: string) {
    setDeleting(jobId);
    try {
      await api.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch {
      Alert.alert('Feil', 'Kunne ikke slette jobb');
    } finally {
      setDeleting(null);
    }
  }

  function renderJob({ item }: { item: Job }) {
    const isDeleting = deleting === item.id;
    return (
      <View testID={`admin-job-card-${item.id}`} style={styles.jobCard}>
        <View style={styles.jobInfo}>
          <Text style={styles.jobName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.jobDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <Text style={styles.jobMeta}>
            {item.tasks?.length || 0} oppgave{(item.tasks?.length || 0) !== 1 ? 'r' : ''}
          </Text>
        </View>
        <View style={styles.jobActions}>
          <TouchableOpacity
            testID={`edit-job-btn-${item.id}`}
            style={styles.editBtn}
            onPress={() => router.push(`/admin/job/${item.id}`)}
          >
            <Text style={styles.editBtnText}>Rediger</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`delete-job-btn-${item.id}`}
            style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
            onPress={() => confirmDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Text style={styles.deleteBtnText}>Slett</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
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
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          testID="new-job-btn"
          style={styles.primaryBtn}
          onPress={() => router.push('/admin/job/new')}
        >
          <Text style={styles.primaryBtnText}>+ Ny jobb</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="config-btn"
          style={styles.secondaryBtn}
          onPress={() => router.push('/admin/config')}
        >
          <Text style={styles.secondaryBtnText}>JSON Konfig</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>⚙️</Text>
          <Text style={styles.emptyTitle}>Ingen jobber ennå</Text>
          <Text style={styles.emptySubtitle}>Opprett din første jobb ovenfor</Text>
        </View>
      ) : (
        <FlatList
          testID="admin-jobs-list"
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}
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
  toolbar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  listContent: { padding: SPACING.md },
  jobCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  jobInfo: { flex: 1 },
  jobName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  jobDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: 2 },
  jobMeta: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  jobActions: { flexDirection: 'row', gap: SPACING.xs + 2 },
  editBtn: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
  },
  editBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: COLORS.danger + '12',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    minWidth: 52,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { color: COLORS.danger, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, textAlign: 'center' },
});
