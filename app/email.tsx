import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BackArrowIcon } from '../src/components/Icons';
import { Colors } from '../src/theme/colors';
import { FontFamily } from '../src/theme/typography';
import { authApi } from '../src/services/api';

export default function EmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // Basic email validation
  const isValidEmail = (text: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
  };

  const isButtonActive = isValidEmail(email) && !isLoading;

  const [emailError, setEmailError] = useState('');

  const handleSubmit = async () => {
    if (!isButtonActive) return;
    setIsLoading(true);
    setEmailError('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await authApi.sendOtp(cleanEmail);
      setIsLoading(false);

      if (res && res.success) {
        router.push({
          pathname: '/otp',
          params: {
            email: cleanEmail,
          },
        });
      } else {
        setEmailError(res?.error || 'Erro ao enviar código. Tente novamente.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setEmailError(err.message || 'Erro de ligação ao servidor.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <StatusBar style="dark" />

        {/* Top Navigation Bar with Back Button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BackArrowIcon size={26} color="#222222" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flexOne}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>
              Insira o seu email para{'\n'}comecar ou fazer login
            </Text>

            {/* Email Input Field */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Endereco de email"
                placeholderTextColor={Colors.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
            </View>

            {/* Helper text */}
            <Text style={styles.helperText}>
              Vamos enviar um codigo para{'\n'}confirmar que es tu
            </Text>

            {emailError ? (
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ fontFamily: FontFamily.medium, fontSize: 14, color: '#D9534F', textAlign: 'center' }}>
                  {emailError}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Bottom Button Area */}
          <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!isButtonActive}
              onPress={handleSubmit}
              style={[
                styles.actionButton,
                isButtonActive ? styles.actionButtonActive : styles.actionButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  isButtonActive
                    ? styles.actionButtonTextActive
                    : styles.actionButtonTextDisabled,
                ]}
              >
                Obter Codigo
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.formBg,
  },
  flexOne: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 26,
    paddingTop: 28,
  },
  title: {
    fontFamily: FontFamily.light,
    fontSize: 28,
    color: Colors.formTextPrimary,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: 3,
    marginBottom: 36,
  },
  inputContainer: {
    backgroundColor: Colors.inputBg,
    borderRadius: 18,
    height: 62,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: 17,
    color: Colors.inputText,
  },
  helperText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.formTextSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  bottomContainer: {
    paddingHorizontal: 26,
    width: '100%',
  },
  actionButton: {
    height: 64,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  actionButtonDisabled: {
    backgroundColor: Colors.buttonDisabledBg,
  },
  actionButtonActive: {
    backgroundColor: Colors.buttonActiveBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
  },
  actionButtonTextDisabled: {
    color: Colors.buttonDisabledText,
  },
  actionButtonTextActive: {
    color: Colors.buttonActiveText,
  },
});
