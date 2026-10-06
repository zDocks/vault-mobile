import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAnimatedIcon } from '../src/components/SafeAnimatedIcon';
import { Colors } from '../src/theme/colors';
import { FontFamily } from '../src/theme/typography';
import { appUpdatesApi, AppVersionInfo, isNewerVersion } from '../src/services/api';
import { AppUpdateModal } from '../src/components/AppUpdateModal';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);

  const localVersion = Constants.expoConfig?.version || '1.0.2';

  useEffect(() => {
    // Verifica atualizações automaticamente no ecrã de login
    const checkUpdatesOnLogin = async () => {
      try {
        const info = await appUpdatesApi.checkVersion();
        if (info && info.success && info.version) {
          if (isNewerVersion(info.version, localVersion)) {
            setAvailableUpdate(info);
            setIsUpdateModalVisible(true);
          }
        }
      } catch {
        // Silencioso em caso de erro de rede no splash/login
      }
    };

    checkUpdatesOnLogin();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Realistic Background Image */}
      <ImageBackground
        source={require('../assets/login_bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Top Logo Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 44) }]}>
          <View style={styles.logoRow}>
            <SafeAnimatedIcon size={34} color="#FFFFFF" strokeWidth={4.5} animated={false} />
            <Text style={styles.logoText}>VAULT</Text>
          </View>
        </View>

        {/* Gradient overlay for readability */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(18, 18, 18, 0.25)',
            'rgba(18, 18, 18, 0.7)',
            'rgba(18, 18, 18, 0.95)',
            '#121212',
          ]}
          locations={[0, 0.35, 0.6, 0.8, 1]}
          style={styles.bottomGradient}
        >
          {/* Headline */}
          <View style={styles.contentSection}>
            <Text style={styles.headline}>
              As tuas despesas.{'\n'}É o teu dinheiro.
            </Text>

            {/* Continue with Email Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.emailButton}
              onPress={() => router.push('/email')}
            >
              <Text style={styles.emailButtonText}>Continuar com Email</Text>
            </TouchableOpacity>

            {/* Terms and Privacy policy notice */}
            <View style={[styles.termsContainer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
              <Text style={styles.termsText}>
                Ao continuar esta a aceitar os nossos{' '}
                <Text style={styles.termsLink}>Termos</Text> e{' '}
                <Text style={styles.termsLink}>Politicas de Privacidade</Text>
              </Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* Modal de Atualização da App (Visível logo no Login) */}
      <AppUpdateModal
        visible={isUpdateModalVisible}
        onClose={() => setIsUpdateModalVisible(false)}
        updateInfo={availableUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 25,
    letterSpacing: 2.5,
    color: '#FFFFFF',
  },
  bottomGradient: {
    width: '100%',
    paddingHorizontal: 26,
    paddingTop: 110,
    justifyContent: 'flex-end',
  },
  contentSection: {
    width: '100%',
  },
  headline: {
    fontFamily: FontFamily.semiBold,
    fontSize: 38,
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -0.6,
    marginBottom: 40,
  },
  emailButton: {
    backgroundColor: Colors.loginButtonBg,
    borderRadius: 34,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  emailButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: 18,
    color: Colors.loginButtonText,
    letterSpacing: -0.2,
  },
  termsContainer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
});
