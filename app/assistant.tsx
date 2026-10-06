import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  ChevronLeftIcon,
  SparkleIcon,
  SendIcon,
  TrashIcon,
} from '../src/components/Icons';
import { Colors } from '../src/theme/colors';
import { FontFamily } from '../src/theme/typography';
import { aiApi } from '../src/services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_SUGGESTIONS = [
  'Quanto gastei este mês no talho?',
  'Qual o meu saldo e despesas atuais?',
  'Quanto paguei de rendas este mês?',
  'Quais são os maiores fornecedores?',
];

const renderInlineTokens = (text: string, isAi: boolean) => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text
          key={i}
          style={[
            styles.inlineBold,
            isAi ? styles.inlineBoldAi : styles.inlineBoldUser,
          ]}
        >
          {boldText}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeText = part.slice(1, -1);
      return (
        <Text key={i} style={styles.inlineCode}>
          {codeText}
        </Text>
      );
    }
    return (
      <Text
        key={i}
        style={[
          styles.inlineNormal,
          isAi ? styles.inlineNormalAi : styles.inlineNormalUser,
        ]}
      >
        {part}
      </Text>
    );
  });
};

const FormattedMessageText: React.FC<{ content: string; isAi: boolean }> = ({ content, isAi }) => {
  const lines = content.split('\n');

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={idx} style={styles.paragraphSpacer} />;
        }

        // Bullet item: * ou - ou •
        const bulletMatch = trimmed.match(/^[\*\-•]\s+(.*)$/);
        if (bulletMatch) {
          const bulletText = bulletMatch[1];
          return (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, isAi ? styles.bulletDotAi : styles.bulletDotUser]} />
              <Text style={styles.bulletTextWrap}>
                {renderInlineTokens(bulletText, isAi)}
              </Text>
            </View>
          );
        }

        // Numbered item: 1. ou 2.
        const numberMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
        if (numberMatch) {
          const num = numberMatch[1];
          const numText = numberMatch[2];
          return (
            <View key={idx} style={styles.numberedRow}>
              <Text style={[styles.numberedPrefix, isAi ? styles.numberedPrefixAi : styles.numberedPrefixUser]}>
                {num}.
              </Text>
              <Text style={styles.bulletTextWrap}>
                {renderInlineTokens(numText, isAi)}
              </Text>
            </View>
          );
        }

        // Regular paragraph line
        return (
          <Text
            key={idx}
            style={[
              styles.paragraphLine,
              isAi ? styles.paragraphLineAi : styles.paragraphLineUser,
            ]}
          >
            {renderInlineTokens(trimmed, isAi)}
          </Text>
        );
      })}
    </View>
  );
};

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Olá! Sou o Vault AI, o teu assistente financeiro com acesso em tempo real a todas as tuas receitas, despesas e movimentos.\n\nPodes perguntar-me qualquer detalhe sobre os teus gastos, fornecedores ou previsões.',
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Filtrar a mensagem de boas-vindas para não influenciar ou repetir o Olá
      const historyPayload = messages
        .filter((m) => !m.id.startsWith('welcome-'))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await aiApi.chat(textToSend, historyPayload);

      if (res.success && res.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: res.error || 'Desculpa, não consegui consultar as tuas finanças no momento.',
          timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: 'Ocorreu um erro ao comunicar com o Vault AI. Por favor tenta novamente.',
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversa reiniciada. Em que posso ajudar nas tuas finanças agora?',
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[
          Colors.homeGradStart,
          Colors.homeGradMid1,
          Colors.homeGradMid2,
          Colors.homeGradEnd,
        ]}
        locations={[0, 0.3, 0.65, 1]}
        style={[
          styles.gradient,
          {
            paddingTop: Math.max(insets.top, 14),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <SparkleIcon size={16} color="#00D09E" />
              <Text style={styles.headerTitle}>Vault AI</Text>
            </View>
            <View style={styles.statusRow}>
              <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
              <Text style={styles.headerSubtitle}>Assistente Financeiro em Tempo Real</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.actionButton}
            onPress={handleClearChat}
          >
            <TrashIcon size={18} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        </View>

        {/* Quick Suggestion Pills */}
        <View style={styles.suggestionsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsScroll}
          >
            {QUICK_SUGGESTIONS.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.75}
                style={styles.suggestionPill}
                onPress={() => handleSendMessage(suggestion)}
              >
                <SparkleIcon size={12} color="#00D09E" />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Messages List */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 10 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={[
              styles.messagesContainer,
              { paddingBottom: Math.max(insets.bottom + 20, 24) },
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((item) => {
              const isAi = item.role === 'assistant';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageRow,
                    isAi ? styles.messageRowAi : styles.messageRowUser,
                  ]}
                >
                  {isAi && (
                    <View style={styles.aiAvatar}>
                      <SparkleIcon size={14} color="#00D09E" />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isAi ? styles.bubbleAi : styles.bubbleUser,
                    ]}
                  >
                    <FormattedMessageText content={item.content} isAi={isAi} />
                    <Text
                      style={[
                        styles.timestampText,
                        isAi ? styles.timestampAi : styles.timestampUser,
                      ]}
                    >
                      {item.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}

            {isLoading && (
              <View style={[styles.messageRow, styles.messageRowAi]}>
                <View style={styles.aiAvatar}>
                  <SparkleIcon size={14} color="#00D09E" />
                </View>
                <View style={[styles.messageBubble, styles.bubbleAi, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#00D09E" />
                  <Text style={styles.loadingAiText}>Vault AI a calcular resposta...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View
            style={[
              styles.inputContainer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Pergunta algo sobre as tuas despesas..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={inputMessage}
                onChangeText={setInputMessage}
                multiline
                maxLength={400}
                returnKeyType="send"
                onSubmitEditing={() => handleSendMessage()}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.sendButton,
                  (!inputMessage.trim() || isLoading) && styles.sendButtonDisabled,
                ]}
                onPress={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
              >
                <SendIcon size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02231E',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D09E',
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  suggestionsWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 84, 69, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  suggestionText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#E0FFF6',
  },
  chatArea: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  messageRowAi: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00382E',
    borderWidth: 1,
    borderColor: '#00D09E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  bubbleAi: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#005445',
    borderWidth: 1,
    borderColor: '#00D09E',
    borderTopRightRadius: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingAiText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#00D09E',
  },
  formattedContainer: {
    gap: 4,
  },
  paragraphSpacer: {
    height: 8,
  },
  paragraphLine: {
    fontSize: 14,
    lineHeight: 21,
  },
  paragraphLineAi: {
    color: 'rgba(255, 255, 255, 0.95)',
  },
  paragraphLineUser: {
    color: '#FFFFFF',
  },
  inlineNormal: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  inlineNormalAi: {
    color: 'rgba(255, 255, 255, 0.92)',
  },
  inlineNormalUser: {
    color: '#FFFFFF',
  },
  inlineBold: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 21,
  },
  inlineBoldAi: {
    color: '#00D09E',
  },
  inlineBoldUser: {
    color: '#FFFFFF',
  },
  inlineCode: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#00D09E',
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingRight: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 8,
  },
  bulletDotAi: {
    backgroundColor: '#00D09E',
  },
  bulletDotUser: {
    backgroundColor: '#FFFFFF',
  },
  bulletTextWrap: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingRight: 4,
  },
  numberedPrefix: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    marginRight: 6,
    marginTop: 1,
  },
  numberedPrefixAi: {
    color: '#00D09E',
  },
  numberedPrefixUser: {
    color: '#FFFFFF',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextAi: {
    fontFamily: FontFamily.regular,
    color: '#FFFFFF',
  },
  messageTextUser: {
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
  },
  timestampText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  timestampAi: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  timestampUser: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(2, 35, 30, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#FFFFFF',
    maxHeight: 100,
    paddingVertical: 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00D09E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
