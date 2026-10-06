import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import {
  ChevronLeftIcon,
  SparkleIcon,
} from './Icons';
import { aiApi, PurchaseAdviceDTO } from '../services/api';

interface PurchaseAdvisorViewProps {
  onClose: () => void;
}

// ============================================================================
// Tambor (Wheel / Drum) Picker Component (Idêntico ao AddScreenView)
// ============================================================================
const DRUM_ITEM_HEIGHT = 48;
const DRUM_REPEATS = 60;

interface DrumWheelPickerProps {
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

const DrumWheelPicker: React.FC<DrumWheelPickerProps> = ({
  options,
  selectedValue,
  onSelect,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const isMounted = useRef(false);
  const isUserInteracting = useRef(false);

  const repeatedItems = useRef(
    Array.from({ length: DRUM_REPEATS }).flatMap((_, cycle) =>
      options.map((opt, optIdx) => ({
        opt,
        key: `cycle-${cycle}-opt-${optIdx}`,
        optIndex: optIdx,
      }))
    )
  ).current;

  const currentOptionIdx = Math.max(0, options.indexOf(selectedValue));
  const middleCycle = Math.floor(DRUM_REPEATS / 2);
  const [centeredGlobalIdx, setCenteredGlobalIdx] = useState(
    middleCycle * options.length + currentOptionIdx
  );

  useEffect(() => {
    const targetIdx = middleCycle * options.length + currentOptionIdx;
    setCenteredGlobalIdx(targetIdx);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: targetIdx * DRUM_ITEM_HEIGHT,
        animated: false,
      });
      isMounted.current = true;
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isMounted.current && !isUserInteracting.current) {
      const currentOpt = repeatedItems[centeredGlobalIdx]?.opt;
      if (currentOpt !== selectedValue) {
        const targetIdx = middleCycle * options.length + currentOptionIdx;
        setCenteredGlobalIdx(targetIdx);
        scrollRef.current?.scrollTo({
          y: targetIdx * DRUM_ITEM_HEIGHT,
          animated: true,
        });
      }
    }
  }, [selectedValue, currentOptionIdx]);

  const handleScroll = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(offsetY / DRUM_ITEM_HEIGHT);
    if (rawIdx !== centeredGlobalIdx && rawIdx >= 0 && rawIdx < repeatedItems.length) {
      setCenteredGlobalIdx(rawIdx);
    }
  };

  const handleScrollEnd = (e: any) => {
    isUserInteracting.current = false;
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(offsetY / DRUM_ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(rawIdx, repeatedItems.length - 1));
    setCenteredGlobalIdx(clampedIdx);

    const chosenOption = repeatedItems[clampedIdx]?.opt;
    if (chosenOption && chosenOption !== selectedValue) {
      onSelect(chosenOption);
    }
  };

  return (
    <View style={styles.drumContainer}>
      <View style={styles.drumVerticalLine} />
      <View style={styles.drumViewport}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={DRUM_ITEM_HEIGHT}
          decelerationRate="fast"
          bounces={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isUserInteracting.current = true;
          }}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={(e) => {
            if (Platform.OS === 'android') {
              handleScrollEnd(e);
            }
          }}
          contentContainerStyle={{
            paddingVertical: DRUM_ITEM_HEIGHT,
          }}
          style={styles.drumScrollView}
        >
          {repeatedItems.map((item, index) => {
            const isCenter = index === centeredGlobalIdx;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => {
                  isUserInteracting.current = false;
                  setCenteredGlobalIdx(index);
                  scrollRef.current?.scrollTo({
                    y: index * DRUM_ITEM_HEIGHT,
                    animated: true,
                  });
                  onSelect(item.opt);
                }}
                style={styles.drumScrollItem}
              >
                <Text
                  style={[
                    styles.drumScrollText,
                    isCenter ? styles.drumTextCenter : styles.drumTextSide,
                  ]}
                >
                  {item.opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.drumVerticalLine} />
    </View>
  );
};

// ============================================================================
// Main PurchaseAdvisorView Component
// ============================================================================
const INSTALLMENT_OPTIONS = [
  '3 Prestações',
  '6 Prestações',
  '10 Prestações',
  '12 Prestações',
  '18 Prestações',
  '24 Prestações',
  '36 Prestações',
];

export const PurchaseAdvisorView: React.FC<PurchaseAdvisorViewProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();

  // Wizard Steps: 0 = Amount & Product | 1 = Payment Mode | 2 = Need & Urgency | 3 = Vault AI Result
  const [step, setStep] = useState<number>(0);

  // Form Fields
  const [amount, setAmount] = useState('0');
  const [productName, setProductName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'pronto' | 'prestacoes'>('pronto');
  const [selectedInstallmentLabel, setSelectedInstallmentLabel] = useState('6 Prestações');
  const [necessity, setNecessity] = useState<'essencial' | 'importante' | 'superfluo'>('importante');
  const [urgency, setUrgency] = useState<'urgente' | 'moderada' | 'sem_pressa'>('moderada');
  const [contextText, setContextText] = useState('');

  // AI Advice & Loading
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<PurchaseAdviceDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keypad Handlers
  const handleKeyPress = (key: string) => {
    if (key === '<') {
      setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    } else if (key === '.') {
      setAmount((prev) => (prev.includes('.') ? prev : prev + '.'));
    } else {
      setAmount((prev) => {
        if (prev === '0') return key;
        if (prev.length >= 9) return prev;
        return prev + key;
      });
    }
  };

  const KEYPAD_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '<'],
  ];

  const getInstallmentsCount = () => {
    const num = parseInt(selectedInstallmentLabel.split(' ')[0], 10);
    return isNaN(num) ? 6 : num;
  };

  const numericPrice = parseFloat(amount.replace(',', '.')) || 0;
  const installmentsCount = getInstallmentsCount();
  const estimatedMonthly = numericPrice > 0 ? numericPrice / installmentsCount : 0;

  const handleConsultAi = async () => {
    setErrorMessage(null);
    setIsAiLoading(true);
    setStep(4);

    try {
      const res = await aiApi.getPurchaseAdvice({
        productName: productName.trim() || 'Item pretendido',
        price: numericPrice,
        paymentMethod: paymentMode,
        installments: paymentMode === 'prestacoes' ? installmentsCount : 1,
        necessity,
        urgency,
        context: contextText.trim() || undefined,
      });

      if (res.success && res.advice) {
        setAiAdvice(res.advice);
      } else {
        setErrorMessage(res.error || 'Não foi possível gerar análise com o Vault AI.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de ligação à API do Vault AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setAmount('0');
    setProductName('');
    setPaymentMode('pronto');
    setAiAdvice(null);
    setErrorMessage(null);
  };

  return (
    <View style={styles.container}>
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
            paddingTop: Math.max(insets.top + 8, 22),
            paddingBottom: Math.max(insets.bottom + 8, 18),
          },
        ]}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.iconButton}
            onPress={step > 0 ? () => setStep(step - 1) : onClose}
          >
            <ChevronLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerBadge}>
            <SparkleIcon size={14} color="#00D09E" />
            <Text style={styles.headerBadgeText}>VAULT AI</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        {/* ================= STEP 0: VALOR COM KEYPAD ================= */}
        {step === 0 && (
          <>
            {/* Amount Display */}
            <View style={styles.amountContainer}>
              <Text style={styles.amountText}>{amount}€</Text>
            </View>

            {/* Numeric Keypad */}
            <View style={styles.keypadContainer}>
              {KEYPAD_ROWS.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.keypadRow}>
                  {row.map((key) => (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.6}
                      style={styles.keypadButton}
                      onPress={() => handleKeyPress(key)}
                    >
                      {key === '.' ? (
                        <View style={styles.dotIndicator} />
                      ) : key === '<' ? (
                        <ChevronLeftIcon size={26} color="#FFFFFF" />
                      ) : (
                        <Text style={styles.keypadButtonText}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomSection}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.primaryActionButton,
                  (!numericPrice || numericPrice <= 0) && styles.primaryActionButtonDisabled,
                ]}
                disabled={!numericPrice || numericPrice <= 0}
                onPress={() => setStep(1)}
              >
                <Text style={styles.primaryActionButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ================= STEP 1: PRODUTO / ARTIGO ================= */}
        {step === 1 && (
          <View style={styles.stepContentCentered}>
            <Text style={styles.screenTitleCentered}>Artigo</Text>
            <Text style={styles.screenSubtitleCentered}>
              O que pretende comprar por {numericPrice.toFixed(2)}€?
            </Text>

            <View style={styles.descriptionInputCard}>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Ex: MacBook Pro, iPhone, Carro Usado..."
                placeholderTextColor="rgba(255, 255, 255, 0.45)"
                value={productName}
                onChangeText={setProductName}
                autoFocus
              />
            </View>

            <View style={styles.bottomSectionCentered}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.primaryActionButton,
                  !productName.trim() && styles.primaryActionButtonDisabled,
                ]}
                disabled={!productName.trim()}
                onPress={() => setStep(2)}
              >
                <Text style={styles.primaryActionButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================= STEP 2: MODALIDADE & TAMBOR INFINITO ================= */}
        {step === 2 && (
          <View style={styles.stepContentCentered}>
            <Text style={styles.screenTitleCentered}>Modalidade de Pagamento</Text>
            <Text style={styles.screenSubtitleCentered}>
              {productName} • {numericPrice.toFixed(2)}€
            </Text>

            {/* Pronto vs Prestações Toggle */}
            <View style={styles.yesNoRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.yesNoButton,
                  paymentMode === 'pronto'
                    ? styles.yesNoButtonActive
                    : styles.yesNoButtonInactive,
                ]}
                onPress={() => setPaymentMode('pronto')}
              >
                <Text
                  style={[
                    styles.yesNoText,
                    paymentMode === 'pronto'
                      ? styles.yesNoTextActive
                      : styles.yesNoTextInactive,
                  ]}
                >
                  A Pronto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.yesNoButton,
                  paymentMode === 'prestacoes'
                    ? styles.yesNoButtonActive
                    : styles.yesNoButtonInactive,
                ]}
                onPress={() => setPaymentMode('prestacoes')}
              >
                <Text
                  style={[
                    styles.yesNoText,
                    paymentMode === 'prestacoes'
                      ? styles.yesNoTextActive
                      : styles.yesNoTextInactive,
                  ]}
                >
                  Prestações
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tambor Infinito do AddScreenView se for em prestações */}
            {paymentMode === 'prestacoes' && (
              <View style={styles.tamborWrapper}>
                <DrumWheelPicker
                  options={INSTALLMENT_OPTIONS}
                  selectedValue={selectedInstallmentLabel}
                  onSelect={setSelectedInstallmentLabel}
                />
                <View style={styles.monthlyEstimateBadge}>
                  <Text style={styles.monthlyEstimateText}>
                    Mensalidade estimada: ~{estimatedMonthly.toFixed(2)} € / mês
                  </Text>
                </View>
              </View>
            )}

            {/* Bottom Button */}
            <View style={styles.bottomSectionCentered}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.primaryActionButton}
                onPress={() => setStep(3)}
              >
                <Text style={styles.primaryActionButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================= STEP 3: NECESSIDADE & URGÊNCIA ================= */}
        {step === 3 && (
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.screenTitleCentered}>Prioridade & Urgência</Text>
            <Text style={styles.screenSubtitleCentered}>
              Ajude a IA a avaliar o impacto real no seu dia a dia
            </Text>

            {/* Card 1: Grau de Necessidade */}
            <View style={styles.glassCard}>
              <Text style={styles.glassCardLabel}>GRAU DE NECESSIDADE</Text>
              <View style={styles.pillGroup}>
                {[
                  { id: 'essencial', label: 'Essencial (Trabalho/Saúde)' },
                  { id: 'importante', label: 'Importante (Traz Benefício)' },
                  { id: 'superfluo', label: 'Supérfluo (Capricho/Desejo)' },
                ].map((item) => {
                  const isActive = necessity === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      style={[
                        styles.pillOption,
                        isActive && styles.pillOptionActive,
                      ]}
                      onPress={() => setNecessity(item.id as any)}
                    >
                      <View style={[styles.pillDot, isActive && styles.pillDotActive]} />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Card 2: Urgência */}
            <View style={styles.glassCard}>
              <Text style={styles.glassCardLabel}>NÍVEL DE URGÊNCIA</Text>
              <View style={styles.pillGroup}>
                {[
                  { id: 'urgente', label: 'Urgente (Preciso Imediatamente)' },
                  { id: 'moderada', label: 'Moderada (Posso Esperar 1-2 meses)' },
                  { id: 'sem_pressa', label: 'Sem Pressa (Apenas no momento ideal)' },
                ].map((item) => {
                  const isActive = urgency === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      style={[
                        styles.pillOption,
                        isActive && styles.pillOptionActive,
                      ]}
                      onPress={() => setUrgency(item.id as any)}
                    >
                      <View style={[styles.pillDot, isActive && styles.pillDotActive]} />
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.geminiConsultButton}
              onPress={handleConsultAi}
            >
              <SparkleIcon size={18} color="#FFFFFF" />
              <Text style={styles.geminiConsultButtonText}>Consultar Vault AI</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ================= STEP 4: RESULTADO DA IA VAULT AI ================= */}
        {step === 4 && (
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isAiLoading ? (
              <View style={styles.aiLoadingWrap}>
                <ActivityIndicator size="large" color="#00D09E" />
                <Text style={styles.aiLoadingTitle}>A Consultar o Vault AI...</Text>
                <Text style={styles.aiLoadingSubtitle}>
                  A cruzar o saldo real da sua conta, despesas fixas recorrentes e margem mensal para emitir um veredito financeiro rigoroso.
                </Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.aiErrorWrap}>
                <Text style={styles.aiErrorTitle}>Erro na Análise</Text>
                <Text style={styles.aiErrorSubtitle}>{errorMessage}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleConsultAi}
                >
                  <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                </TouchableOpacity>
              </View>
            ) : aiAdvice ? (
              <View style={styles.aiResultContainer}>
                {/* Score & Verdict Hero Card */}
                <View style={styles.verdictCard}>
                  <View
                    style={[
                      styles.verdictBadge,
                      {
                        backgroundColor:
                          aiAdvice.tone === 'success'
                            ? '#005445'
                            : aiAdvice.tone === 'danger'
                              ? '#631414'
                              : '#543800',
                      },
                    ]}
                  >
                    <Text style={styles.verdictBadgeText}>{aiAdvice.verdict}</Text>
                  </View>

                  <Text style={styles.verdictScore}>{aiAdvice.score}/100</Text>
                  <Text style={styles.verdictScoreLabel}>Índice de Viabilidade Orçamental</Text>

                  <View style={styles.verdictDivider} />

                  <Text style={styles.verdictItemSummary}>
                    {productName || 'Artigo'} • {numericPrice.toFixed(2)}€
                    {paymentMode === 'prestacoes' && ` (${installmentsCount}x de ${estimatedMonthly.toFixed(2)}€)`}
                  </Text>
                </View>

                {/* Resumo da Análise */}
                <View style={styles.adviceCard}>
                  <Text style={styles.adviceCardHeader}>💡 Análise do Consultor</Text>
                  <Text style={styles.adviceSummaryText}>{aiAdvice.summary}</Text>
                </View>

                {/* Recomendação Estratégica */}
                <View style={styles.adviceCard}>
                  <Text style={styles.adviceCardHeader}>🎯 Recomendação Estratégica</Text>
                  <Text style={styles.adviceStrategicText}>{aiAdvice.strategicRecommendation}</Text>
                </View>

                {/* Plano de Poupança se aplicável */}
                {aiAdvice.savingsPlan && aiAdvice.savingsPlan.monthsToSave > 0 && (
                  <View style={styles.savingsPlanCard}>
                    <Text style={styles.savingsPlanHeader}>💰 Plano de Poupança Alternativo</Text>
                    <Text style={styles.savingsPlanMonths}>
                      Junte durante {aiAdvice.savingsPlan.monthsToSave} meses
                    </Text>
                    <Text style={styles.savingsPlanDetail}>
                      Ao colocar ~{aiAdvice.savingsPlan.monthlyAmountToSave}€ de parte por mês, compra sem recorrer a crédito.
                    </Text>
                    {aiAdvice.savingsPlan.explanation ? (
                      <Text style={styles.savingsPlanExplanation}>{aiAdvice.savingsPlan.explanation}</Text>
                    ) : null}
                  </View>
                )}

                {/* Pontos-chave */}
                {aiAdvice.keyPoints && aiAdvice.keyPoints.length > 0 && (
                  <View style={styles.adviceCard}>
                    <Text style={styles.adviceCardHeader}>📋 Pontos Cruciais</Text>
                    {aiAdvice.keyPoints.map((point: string, idx: number) => (
                      <View key={idx} style={styles.pointRow}>
                        <View style={styles.pointDot} />
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reset Buttons */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.newConsultationButton}
                  onPress={handleReset}
                >
                  <Text style={styles.newConsultationButtonText}>Fazer Nova Consulta</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        )}
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 60, 50, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 60, 50, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
  },
  headerBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#00D09E',
    letterSpacing: 0.8,
  },
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  amountText: {
    fontFamily: FontFamily.bold,
    fontSize: 54,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  descriptionInputCard: {
    backgroundColor: 'rgba(0, 60, 50, 0.55)',
    borderRadius: 16,
    width: '90%',
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  descriptionInput: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    color: '#FFFFFF',
  },
  keypadContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  keypadButton: {
    width: 72,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontFamily: FontFamily.regular,
    fontSize: 34,
    color: '#FFFFFF',
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingBottom: 10,
  },
  bottomSectionCentered: {
    paddingHorizontal: 28,
    paddingTop: 40,
    width: '100%',
  },
  primaryActionButton: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionButtonDisabled: {
    opacity: 0.5,
  },
  primaryActionButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
  },
  stepContentCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  screenTitleCentered: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  screenSubtitleCentered: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  yesNoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  yesNoButton: {
    width: 136,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yesNoButtonActive: {
    backgroundColor: '#005445',
    borderWidth: 1.5,
    borderColor: '#00D09E',
  },
  yesNoButtonInactive: {
    backgroundColor: 'rgba(0, 50, 42, 0.55)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  yesNoText: {
    fontSize: 16,
  },
  yesNoTextActive: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  yesNoTextInactive: {
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tamborWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  drumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: DRUM_ITEM_HEIGHT * 3,
  },
  drumVerticalLine: {
    width: 2,
    height: DRUM_ITEM_HEIGHT * 3,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  drumViewport: {
    height: DRUM_ITEM_HEIGHT * 3,
    width: 220,
    overflow: 'hidden',
  },
  drumScrollView: {
    flex: 1,
  },
  drumScrollItem: {
    height: DRUM_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drumScrollText: {
    fontSize: 19,
    textAlign: 'center',
  },
  drumTextCenter: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  drumTextSide: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  monthlyEstimateBadge: {
    backgroundColor: 'rgba(0, 208, 158, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
  },
  monthlyEstimateText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#00D09E',
  },
  stepScroll: {
    flex: 1,
  },
  stepScrollContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(0, 50, 42, 0.55)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  glassCardLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  pillGroup: {
    gap: 8,
  },
  pillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 40, 34, 0.45)',
  },
  pillOptionActive: {
    backgroundColor: '#005445',
    borderWidth: 1.5,
    borderColor: '#00D09E',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillDotActive: {
    backgroundColor: '#00D09E',
  },
  pillText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  pillTextActive: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  geminiConsultButton: {
    backgroundColor: '#005445',
    borderWidth: 1.5,
    borderColor: '#00D09E',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  geminiConsultButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  aiLoadingWrap: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  aiLoadingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  aiLoadingSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  aiErrorWrap: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  aiErrorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#FF6B6B',
  },
  aiErrorSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  aiResultContainer: {
    gap: 14,
  },
  verdictCard: {
    backgroundColor: 'rgba(0, 50, 42, 0.7)',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  verdictBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  verdictBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  verdictScore: {
    fontFamily: FontFamily.bold,
    fontSize: 54,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  verdictScoreLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  verdictDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 16,
  },
  verdictItemSummary: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#00D09E',
  },
  adviceCard: {
    backgroundColor: 'rgba(0, 50, 42, 0.55)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  adviceCardHeader: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  adviceSummaryText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  adviceStrategicText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#00D09E',
    lineHeight: 21,
  },
  savingsPlanCard: {
    backgroundColor: 'rgba(0, 84, 69, 0.55)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#00D09E',
  },
  savingsPlanHeader: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#00D09E',
    marginBottom: 6,
  },
  savingsPlanMonths: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  savingsPlanDetail: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  savingsPlanExplanation: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 6,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D09E',
    marginTop: 7,
  },
  pointText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  newConsultationButton: {
    backgroundColor: '#FFFFFF',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  newConsultationButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
  },
});
