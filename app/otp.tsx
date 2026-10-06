import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BackArrowIcon } from '../src/components/Icons';
import { Colors } from '../src/theme/colors';
import { FontFamily } from '../src/theme/typography';
import * as Clipboard from 'expo-clipboard';
import { authApi } from '../src/services/api';

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const email = ((params.email as string) || '').trim().toLowerCase();
  const paramCode = ((params.code as string) || '').trim();

  useEffect(() => {
    if (!email) {
      router.replace('/email');
    }
  }, [email]);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState<number>(30);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Se o utilizador abriu através do link direto do email (deep link), preenche automaticamente
  useEffect(() => {
    if (paramCode) {
      const cleaned = paramCode.replace(/[^0-9]/g, '');
      if (cleaned.length >= OTP_LENGTH) {
        setOtp(cleaned.slice(0, OTP_LENGTH).split(''));
        setErrorMsg('');
      }
    }
  }, [paramCode]);

  // Função para colar com 1 toque a partir da área de transferência (clipboard)
  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned.length >= OTP_LENGTH) {
        const digits = cleaned.slice(0, OTP_LENGTH).split('');
        setOtp(digits);
        setErrorMsg('');
        Keyboard.dismiss();
      } else if (cleaned.length > 0) {
        const newOtp = [...otp];
        cleaned.split('').forEach((d, i) => {
          if (i < OTP_LENGTH) newOtp[i] = d;
        });
        setOtp(newOtp);
        setErrorMsg('');
      }
    } catch {
      // ignore
    }
  };

  // Countdown timer 30s -> 0s
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    if (timer === 0 && email) {
      try {
        setErrorMsg('');
        await authApi.sendOtp(email);
        setTimer(30);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao reenviar código.');
      }
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    setErrorMsg('');
    const cleaned = text.replace(/[^0-9]/g, '');
    const newOtp = [...otp];

    if (cleaned.length > 1) {
      const pastedDigits = cleaned.slice(0, OTP_LENGTH).split('');
      pastedDigits.forEach((digit, i) => {
        newOtp[i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = cleaned;
    setOtp(newOtp);

    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const isComplete = otp.every((digit) => digit.length > 0);

  const handleVerify = async () => {
    if (!isComplete || loading || !email) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const code = otp.join('');
      const res = await authApi.verifyOtp(email, code);
      if (res && res.success && res.token) {
        router.replace('/home');
      } else {
        setErrorMsg(res?.error || 'Código inválido ou expirado.');
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Código inválido ou expirado.');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <StatusBar style="dark" />

        {/* Back navigation */}
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
              Enviamos-te um{'\n'}codigo de Verificacao
            </Text>

            {/* 6 OTP Boxes */}
            <View style={styles.otpRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                const isFocused = focusedIndex === index;
                const hasValue = otp[index].length > 0;
                return (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      isFocused && styles.otpBoxFocused,
                      hasValue && styles.otpBoxFilled,
                    ]}
                  >
                    <TextInput
                      ref={(ref) => {
                        inputRefs.current[index] = ref;
                      }}
                      style={styles.otpInput}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      value={otp[index]}
                      onChangeText={(val) => handleOtpChange(val, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      onFocus={() => setFocusedIndex(index)}
                      selectTextOnFocus
                      autoFocus={index === 0}
                    />
                  </View>
                );
              })}
            </View>

            {/* Quick Paste Button */}
            {/* <View style={styles.pasteButtonWrapper}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.pasteButton}
                onPress={handlePasteClipboard}
              >
                <Text style={styles.pasteButtonText}>📋 Colar Código Copiado</Text>
              </TouchableOpacity>
            </View> */}

            {/* Subtext info */}
            <Text style={styles.infoText}>
              Digite o codigo de 6 digitos enviado para{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

            {/* Countdown / Resend timer */}
            <View style={styles.timerContainer}>
              {timer > 0 ? (
                <Text style={styles.timerText}>
                  Reenviar codigo em {timer}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendActiveText}>
                    Reenviar codigo agora
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}
          </View>

          {/* Bottom Verify Button */}
          <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!isComplete || loading}
              onPress={handleVerify}
              style={[
                styles.verifyButton,
                isComplete && !loading ? styles.verifyButtonActive : styles.verifyButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.verifyButtonText,
                    isComplete
                      ? styles.verifyButtonTextActive
                      : styles.verifyButtonTextDisabled,
                  ]}
                >
                  Verificar
                </Text>
              )}
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
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontFamily: FontFamily.light,
    fontSize: 28,
    color: Colors.formTextPrimary,
    lineHeight: 36,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 36,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.otpBoxBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  otpBoxFocused: {
    backgroundColor: Colors.otpBoxFocusedBg,
    borderColor: '#9E9894',
  },
  otpBoxFilled: {
    backgroundColor: Colors.otpBoxFocusedBg,
  },
  otpInput: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.inputText,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  pasteButtonWrapper: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 82, 68, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(11, 82, 68, 0.22)',
  },
  pasteButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#0B5244',
  },
  infoText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.formTextSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  emailText: {
    fontFamily: FontFamily.semiBold,
    color: '#3A3633',
  },
  timerContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.formTextSecondary,
  },
  resendActiveText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#1F1F1F',
    textDecorationLine: 'underline',
  },
  errorContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#D9534F',
    textAlign: 'center',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    width: '100%',
  },
  verifyButton: {
    height: 64,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  verifyButtonDisabled: {
    backgroundColor: Colors.buttonDisabledBg,
  },
  verifyButtonActive: {
    backgroundColor: Colors.buttonActiveBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  verifyButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
  },
  verifyButtonTextDisabled: {
    color: Colors.buttonDisabledText,
  },
  verifyButtonTextActive: {
    color: Colors.buttonActiveText,
  },
});
