import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { Job, LocationData } from '../types';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';

async function getLocationData(): Promise<LocationData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo.length > 0) {
        const g = geo[0];
        const parts = [g.street, g.streetNumber, g.postalCode, g.city, g.country].filter(Boolean);
        if (parts.length > 0) address = parts.join(' ');
      }
    } catch { /* keep coordinate fallback */ }
    return { lat: latitude, lon: longitude, address };
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  // Name modal state
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pendingJob, setPendingJob] = useState<Job | null>(null);
  const [sessionName, setSessionName] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      await api.seedData().catch(() => {});
      const data = await api.getJobs();
      setJobs(data);
    } catch {
      Alert.alert('Feil', 'Kunne ikke laste jobber. Sjekk tilkoblingen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  async function startJob(job: Job) {
    // Show name modal instead of starting directly
    setPendingJob(job);
    setSessionName(job.name);
    setNameModalVisible(true);
  }

  async function confirmStart() {
    if (!pendingJob) return;
    const name = sessionName.trim() || pendingJob.name;
    setNameModalVisible(false);
    setStarting(pendingJob.id);
    try {
      const location = await getLocationData();
      const session = await api.createSession({
        job_id: pendingJob.id,
        job_name: name,
        start_location: location,
      });
      router.push(`/session/${session.id}`);
    } catch {
      Alert.alert('Feil', 'Kunne ikke starte jobb');
    } finally {
      setStarting(null);
      setPendingJob(null);
    }
  }

  function renderJob({ item }: { item: Job }) {
    const isStarting = starting === item.id;
    return (
      <View testID={`job-card-${item.id}`} style={styles.jobCard}>
        <View style={styles.jobInfo}>
          <View style={styles.jobIconBg}>
            <Text style={styles.jobIconText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.jobTextWrap}>
            <Text style={styles.jobName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.jobDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <Text style={styles.jobMeta}>
              {item.tasks?.length || 0} oppgave{(item.tasks?.length || 0) !== 1 ? 'r' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          testID={`start-job-btn-${item.id}`}
          style={[styles.startBtn, isStarting && styles.startBtnDisabled]}
          onPress={() => startJob(item)}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color={COLORS.textInverse} />
          ) : (
            <Text style={styles.startBtnText}>Start</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Laster jobber...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Name modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={modal.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Gi jobben et navn</Text>
            <Text style={modal.subtitle}>
              Dette blir overskriften i PDF-rapporten
            </Text>
            <TextInput
              testID="session-name-input"
              style={modal.input}
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="F.eks. Storgata 15 – 24.03.2026"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={confirmStart}
            />
            <View style={modal.btnRow}>
              <TouchableOpacity
                style={modal.cancelBtn}
                onPress={() => { setNameModalVisible(false); setPendingJob(null); }}
              >
                <Text style={modal.cancelText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-start-btn"
                style={[modal.startBtn, starting && modal.startBtnDisabled]}
                onPress={confirmStart}
                disabled={!!starting}
              >
                {starting ? (
                  <ActivityIndicator size="small" color={COLORS.textInverse} />
                ) : (
                  <Text style={modal.startText}>Start jobb</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin button */}
      <View style={styles.adminBar}>
        <Text style={styles.sectionTitle}>
          {jobs.length} jobb{jobs.length !== 1 ? 'er' : ''} tilgjengelig
        </Text>
        <TouchableOpacity
          testID="admin-panel-btn"
          style={styles.adminBtn}
          onPress={() => router.push('/admin')}
        >
          <Text style={styles.adminBtnText}>Konfigurer</Text>
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Ingen jobber ennå</Text>
          <Text style={styles.emptySubtitle}>
            Gå til Konfigurer for å opprette den første jobben
          </Text>
          <TouchableOpacity
            testID="go-to-admin-btn"
            style={styles.emptyBtn}
            onPress={() => router.push('/admin')}
          >
            <Text style={styles.emptyBtnText}>Åpne Konfigurer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="jobs-list"
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
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
    gap: 12,
  },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  adminBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  adminBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.xl,
  },
  adminBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.sm,
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
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  jobInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  jobIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobIconText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
  },
  jobTextWrap: { flex: 1 },
  jobName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  jobDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: 4,
    lineHeight: 18,
  },
  jobMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    minWidth: 72,
    alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: COLORS.primaryLight },
  startBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.sm },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  emptyBtnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
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
    paddingBottom: 36,
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
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
    marginTop: 4,
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
  cancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  startBtn: {
    flex: 2,
    height: 52,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  startBtnDisabled: { backgroundColor: COLORS.textMuted },
  startText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
});
