import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAnimatedIcon } from '../src/components/SafeAnimatedIcon';
import { Colors } from '../src/theme/colors';
import { authApi } from '../src/services/api';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const evaluateSessionAndNavigate = async () => {
      // Pequena pausa para visualização da animação fluida da safe (mínimo 1.8s)
      const splashDelay = new Promise((resolve) => setTimeout(resolve, 1800));

      const [sessionStatus] = await Promise.all([
        authApi.checkSession(),
        splashDelay,
      ]);

      if (!isMounted) return;

      if (sessionStatus.isValid) {
        // Sessão segura guardada e válida -> Entra direto no Home sem pedir login
        router.replace('/home');
      } else {
        // Primeira vez ou sessão expirada -> Vai para o ecrã de login
        router.replace('/login');
      }
    };

    evaluateSessionAndNavigate();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.iconWrapper}>
        <SafeAnimatedIcon size={140} color={Colors.splashIcon} strokeWidth={5.5} animated />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.splashBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
