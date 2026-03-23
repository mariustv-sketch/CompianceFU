import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { api } from '../../services/api';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

export default function ConfigScreen() {
  const [exportJson, setExportJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await api.exportConfig();
      setExportJson(JSON.stringify(data, null, 2));
    } catch {
      Alert.alert('Feil', 'Kunne ikke eksportere konfigurasjon');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!importJson.trim()) {
      Alert.alert('Feil', 'Lim inn JSON-konfigurasjon først');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(importJson.trim());
    } catch {
      Alert.alert('Ugyldig JSON', 'Sjekk at JSON-formatet er korrekt');
      return;
    }
    Alert.alert(
      'Importer konfigurasjon?',
      'Eksisterende jobber med samme ID vil bli overskrevet.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Importer',
          onPress: async () => {
            setImporting(true);
            try {
              const result = await api.importConfig(parsed);
              Alert.alert('Importert!', result.message || 'Konfigurasjon importert');
              setImportJson('');
            } catch {
              Alert.alert('Feil', 'Kunne ikke importere konfigurasjon');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  }

  const exampleJson = JSON.stringify(
    {
      jobs: [
        {
          name: 'Eksempeljobb',
          description: 'Beskrivelse av jobben',
          tasks: [
            {
              id: 'task-1',
              question: 'Er utstyr på plass?',
              yes_action: 'complete',
              yes_subtasks: [],
              no_action: 'create_subtasks',
              no_subtasks: [
                {
                  id: 'task-1-1',
                  question: 'Er utstyr bestilt?',
                  yes_action: 'complete',
                  yes_subtasks: [],
                  no_action: 'complete',
                  no_subtasks: [],
                },
              ],
            },
          ],
        },
      ],
    },
    null,
    2
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* EXPORT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Eksporter konfigurasjon</Text>
          <Text style={styles.cardSubtitle}>
            Last ned alle jobber og oppgaver som JSON
          </Text>
          <TouchableOpacity
            testID="export-btn"
            style={[styles.btn, styles.primaryBtn]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.btnText}>Hent konfigurasjon</Text>
            )}
          </TouchableOpacity>
          {exportJson ? (
            <View style={styles.jsonBox}>
              <Text style={styles.jsonLabel}>Kopier JSON nedenfor:</Text>
              <TextInput
                testID="export-json-output"
                style={styles.jsonInput}
                value={exportJson}
                multiline
                editable={false}
                selectTextOnFocus
              />
            </View>
          ) : null}
        </View>

        {/* IMPORT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importer konfigurasjon</Text>
          <Text style={styles.cardSubtitle}>
            Lim inn JSON for å importere jobber
          </Text>
          <TextInput
            testID="import-json-input"
            style={[styles.jsonInput, { marginTop: 8 }]}
            value={importJson}
            onChangeText={setImportJson}
            placeholder="Lim inn JSON her..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <TouchableOpacity
            testID="import-btn"
            style={[styles.btn, styles.successBtn, importing && styles.btnDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color={COLORS.textInverse} />
            ) : (
              <Text style={styles.btnText}>Importer</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* EXAMPLE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Eksempel JSON-format</Text>
          <Text style={styles.cardSubtitle}>
            Bruk dette formatet for å konfigurere jobber manuelt
          </Text>
          <TextInput
            testID="example-json"
            style={styles.jsonInput}
            value={exampleJson}
            multiline
            editable={false}
            selectTextOnFocus
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  btn: {
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtn: { backgroundColor: COLORS.primary },
  successBtn: { backgroundColor: COLORS.success },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: COLORS.textInverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  jsonBox: { gap: 4 },
  jsonLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textMuted },
  jsonInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: 12,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
