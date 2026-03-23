import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

function GeomatikkLogo() {
  return (
    <View style={styles.logoWrap}>
      <Text style={styles.logoText}>GEOMATIKK</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: COLORS.textInverse },
          contentStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Arbeidsflyt',
            headerLeft: () => <GeomatikkLogo />,
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="session/[id]"
          options={{ title: 'Utførelse', headerTitleAlign: 'center' }}
        />
        <Stack.Screen
          name="admin/index"
          options={{ title: 'Admin', headerTitleAlign: 'center' }}
        />
        <Stack.Screen
          name="admin/job/new"
          options={{ title: 'Ny jobb', headerTitleAlign: 'center' }}
        />
        <Stack.Screen
          name="admin/job/[id]"
          options={{ title: 'Rediger jobb', headerTitleAlign: 'center' }}
        />
        <Stack.Screen
          name="admin/config"
          options={{ title: 'Konfigurasjon', headerTitleAlign: 'center' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  logoWrap: { paddingLeft: 4 },
  logoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
});
