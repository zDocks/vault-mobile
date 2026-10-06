import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, ActivityIndicator, View, Text, TextInput } from 'react-native';
import {
  useFonts,
  Exo_300Light,
  Exo_400Regular,
  Exo_500Medium,
  Exo_600SemiBold,
  Exo_700Bold,
  Exo_800ExtraBold,
  Exo_900Black,
} from '@expo-google-fonts/exo';

import { enableFreeze } from 'react-native-screens';

// Bloqueia a escala de fonte do sistema operativo (Android & iOS)
// Impede que as definições de acessibilidade do utilizador aumentem ou deformem o layout
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.allowFontScaling = false;
(Text as any).defaultProps.maxFontSizeMultiplier = 1;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;

// Desativa o congelamento de ecrãs no blur para evitar que o React 19 desmonte o conteúdo durante transições de saída
enableFreeze(false);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Exo_300Light,
    Exo_400Regular,
    Exo_500Medium,
    Exo_600SemiBold,
    Exo_700Bold,
    Exo_800ExtraBold,
    Exo_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'default',
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="email" options={{ animation: 'default' }} />
          <Stack.Screen name="otp" options={{ animation: 'default' }} />
          <Stack.Screen name="home" options={{ animation: 'default' }} />
          <Stack.Screen name="statistics" options={{ animation: 'default' }} />
          <Stack.Screen name="advisor" options={{ animation: 'default' }} />
          <Stack.Screen name="assistant" options={{ animation: 'default' }} />
          <Stack.Screen name="management" options={{ animation: 'default' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
