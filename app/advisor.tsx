import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
  Keyboard,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontFamily } from '../src/theme/typography';
import {
  ChevronLeftIcon,
  SparkleIcon,
  CheckIcon,
} from '../src/components/Icons';
import Svg, { Path } from 'react-native-svg';
import { aiApi, PurchaseAdviceDTO } from '../src/services/api';

const AlertTriangleIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#FBBF24',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ============================================================================
// Tipos e Constantes
// ============================================================================
type PaymentMode = 'pronto' | 'prestacoes' | 'credito';
type InstallmentConfigType = 'count' | 'monthly_target';
type NecessityLevel = 'essencial' | 'importante' | 'superfluo';
type UrgencyLevel = 'urgente' | 'moderada' | 'sem_pressa';

const POPULAR_INSTALLMENT_COUNTS = [3, 6, 10, 12, 18, 24, 36, 48, 60];
const POPULAR_CREDIT_MONTHS = [12, 24, 36, 48, 60, 72, 84, 120];

export default function AdvisorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ScrollView refs para auto-scroll suave em inputs com teclado aberto
  const step1ScrollRef = useRef<ScrollView>(null);
  const step2ScrollRef = useRef<ScrollView>(null);
  const step3ScrollRef = useRef<ScrollView>(null);

  // Monitorização de teclado do SO
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Wizard Steps:
  // 0 = Valor da Compra (€)
  // 1 = Nome do Produto
  // 2 = Modalidade (A Pronto / A Prestações / A Crédito)
  // 3 = Necessidade & Urgência
  // 4 = Resultado Gemini 2.5 Flash
  const [step, setStep] = useState<number>(0);

  // Form Fields
  const [amount, setAmount] = useState('100');
  const [productName, setProductName] = useState('');

  // Step 2: Modalidade
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('pronto');

  // Modalidade: A Prestações (sem juros)
  const [installmentType, setInstallmentType] = useState<InstallmentConfigType>('count');
  const [customInstallmentsCount, setCustomInstallmentsCount] = useState('6');
  const [targetMonthlyInput, setTargetMonthlyInput] = useState('50');

  // Modalidade: A Crédito (bancário)
  const [creditMonths, setCreditMonths] = useState('36');
  const [tanInput, setTanInput] = useState('8.5');
  const [taegInput, setTaegInput] = useState('11.5');
  const [commissionsInput, setCommissionsInput] = useState('0');

  // Step 3: Contexto & Estratégia Financeira (Trade-offs / Substituição de despesas)
  const [contextText, setContextText] = useState('');

  // Step 4: Necessidade & Urgência
  const [necessity, setNecessity] = useState<NecessityLevel>('importante');
  const [urgency, setUrgency] = useState<UrgencyLevel>('moderada');

  // Step 5: IA & Loading
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<PurchaseAdviceDTO | null>(null);
  const [financialContext, setFinancialContext] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cálculos Numéricos
  const numericPrice = parseFloat(amount.replace(',', '.')) || 0;

  // Cálculos de Prestações (0% juros)
  const installmentsCountNum = Math.max(1, parseInt(customInstallmentsCount, 10) || 1);
  const targetMonthlyNum = Math.max(1, parseFloat(targetMonthlyInput.replace(',', '.')) || 1);

  // Se o utilizador preferir dizer quanto quer pagar por mês:
  const calculatedMonthsFromMonthlyTarget =
    targetMonthlyNum > 0 ? Math.max(1, Math.ceil(numericPrice / targetMonthlyNum)) : 1;

  const effectiveInstallments =
    installmentType === 'count' ? installmentsCountNum : calculatedMonthsFromMonthlyTarget;

  const effectiveMonthlyPaymentZeroInterest =
    numericPrice > 0 ? numericPrice / effectiveInstallments : 0;

  // Cálculos de Crédito Bancário
  const creditMonthsNum = Math.max(1, parseInt(creditMonths, 10) || 1);
  const tanNum = parseFloat(tanInput.replace(',', '.')) || 0;
  const taegNum = parseFloat(taegInput.replace(',', '.')) || 0;
  const commissionsNum = parseFloat(commissionsInput.replace(',', '.')) || 0;

  // Fórmula de Amortização Francesa (PMT)
  // Taxa mensal = (TAN / 100) / 12
  const monthlyRate = tanNum / 100 / 12;
  let creditMonthlyPMT = 0;
  if (monthlyRate > 0) {
    const factor = Math.pow(1 + monthlyRate, creditMonthsNum);
    creditMonthlyPMT = numericPrice * ((monthlyRate * factor) / (factor - 1));
  } else {
    creditMonthlyPMT = numericPrice / creditMonthsNum;
  }

  const totalCreditPaid = creditMonthlyPMT * creditMonthsNum;
  const totalInterest = Math.max(0, totalCreditPaid - numericPrice);
  const mticCalculated = totalCreditPaid + commissionsNum;
  const creditOvercostPercent =
    numericPrice > 0 ? ((mticCalculated - numericPrice) / numericPrice) * 100 : 0;

  // Teclado Numérico para o Passo 0
  const handleKeyPress = (key: string) => {
    if (key === '<') {
      setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    } else if (key === '.') {
      setAmount((prev) => (prev.includes('.') ? prev : prev + '.'));
    } else {
      setAmount((prev) => {
        if (prev === '0') return key;
        if (prev.length >= 8) return prev;
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

  // Chamada à IA do Gemini 2.5 Flash
  const handleConsultGemini = async () => {
    setErrorMessage(null);
    setIsAiLoading(true);
    setStep(5);

    try {
      let payloadInstallments = 1;
      let payloadMonthlyPayment = numericPrice;
      let payloadTotalInterest = 0;
      let payloadMtic = numericPrice;

      if (paymentMode === 'prestacoes') {
        payloadInstallments = effectiveInstallments;
        payloadMonthlyPayment = effectiveMonthlyPaymentZeroInterest;
      } else if (paymentMode === 'credito') {
        payloadInstallments = creditMonthsNum;
        payloadMonthlyPayment = creditMonthlyPMT;
        payloadTotalInterest = totalInterest;
        payloadMtic = mticCalculated;
      }

      const res = await aiApi.getPurchaseAdvice({
        productName: productName.trim() || 'Item pretendido',
        price: numericPrice,
        paymentMethod: paymentMode,
        installments: payloadInstallments,
        monthlyPayment: payloadMonthlyPayment,
        tan: paymentMode === 'credito' ? tanNum : undefined,
        taeg: paymentMode === 'credito' ? taegNum : undefined,
        commissions: paymentMode === 'credito' ? commissionsNum : undefined,
        totalInterest: payloadTotalInterest,
        mtic: payloadMtic,
        necessity,
        urgency,
        context: contextText.trim() || undefined,
      });

      if (res.success && res.advice) {
        setAiAdvice(res.advice);
        setFinancialContext(res.financialContext);
      } else {
        setErrorMessage(res.error || 'Não foi possível obter resposta do consultor.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de comunicação ao consultar o consultor.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Botão Retroceder
  const handleGoBack = () => {
    if (step > 0 && step < 5) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <ExpoStatusBar style="light" />
      {Platform.OS === 'android' && (
        <RNStatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      )}
      <LinearGradient
        colors={['#02231E', '#064E3B', '#02231E']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientContainer}
      >
        {/* Header Superior Integrado Fixo no Topo */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleGoBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Conselheiro Financeiro</Text>
            <Text style={styles.headerSubtitle}>
              {step === 0 && 'Passo 1/5 • Valor da Compra'}
              {step === 1 && 'Passo 2/5 • Artigo Desejado'}
              {step === 2 && 'Passo 3/5 • Modalidade & Cálculo'}
              {step === 3 && 'Passo 4/5 • Contexto & Estratégia'}
              {step === 4 && 'Passo 5/5 • Prioridade & Urgência'}
              {step === 5 && 'Análise Vault AI'}
            </Text>
          </View>

          <View style={styles.headerBadge}>
            <SparkleIcon size={16} color="#34D399" />
            <Text style={styles.headerBadgeText}>AI</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fullFlex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >

          {/* ================================================================= */}
          {/* PASSO 0: TECLADO NUMÉRICO - VALOR DA COMPRA                      */}
          {/* ================================================================= */}
          {step === 0 && (
            <View style={styles.stepContainer}>
              <View style={styles.amountDisplayCard}>
                <Text style={styles.amountLabel}>Quanto custa o produto?</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountValueText}>{amount}</Text>
                  <Text style={styles.currencySymbol}>€</Text>
                </View>
                <Text style={styles.amountHelper}>
                  Insira o valor total pretendido para a simulação
                </Text>
              </View>

              {/* Teclado Numérico */}
              <View style={styles.keypadContainer}>
                {KEYPAD_ROWS.map((row, rIdx) => (
                  <View key={`row-${rIdx}`} style={styles.keypadRow}>
                    {row.map((key) => (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.7}
                        style={[
                          styles.keypadKey,
                          key === '<' ? styles.keypadKeyBackspace : null,
                        ]}
                        onPress={() => handleKeyPress(key)}
                      >
                        <Text
                          style={[
                            styles.keypadKeyText,
                            key === '<' && styles.keypadKeyBackspaceText,
                          ]}
                        >
                          {key === '<' ? '⌫' : key}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>

              {/* Botão de Avanço */}
              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom + 12, 24) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.primaryButton,
                    numericPrice <= 0 && styles.disabledButton,
                  ]}
                  disabled={numericPrice <= 0}
                  onPress={() => setStep(1)}
                >
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* PASSO 1: NOME DO PRODUTO OU BEM                                   */}
          {/* ================================================================= */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <ScrollView
                ref={step1ScrollRef}
                style={styles.scrollArea}
                contentContainerStyle={[
                  styles.scrollContent,
                  isKeyboardVisible && styles.scrollContentWithKeyboard,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
              >
                <View style={styles.amountBanner}>
                  <Text style={styles.amountBannerLabel}>Valor Indicado</Text>
                  <Text style={styles.amountBannerValue}>
                    {numericPrice.toLocaleString('pt-PT', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    €
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>O que pretende comprar?</Text>
                  <Text style={styles.cardDescription}>
                    Diga qual é o bem ou serviço (ex: Computador portátil, Viatura, Eletrodoméstico, etc.)
                  </Text>

                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: iPhone 16 Pro Max, Carro Usado..."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={productName}
                    onChangeText={setProductName}
                    autoFocus
                    maxLength={60}
                    onFocus={() => {
                      setTimeout(() => {
                        step1ScrollRef.current?.scrollTo({ y: 60, animated: true });
                      }, 120);
                    }}
                  />

                  {/* Sugestões Rápidas */}
                  <Text style={styles.quickLabel}>Sugestões rápidas:</Text>
                  <View style={styles.chipsRow}>
                    {[
                      'Portátil / PC',
                      'Telemóvel',
                      'Carro / Mota',
                      'Eletrodoméstico',
                      'Férias / Viagem',
                      'Mobiliário',
                    ].map((item) => (
                      <TouchableOpacity
                        key={item}
                        activeOpacity={0.7}
                        style={[
                          styles.chip,
                          productName === item && styles.chipActive,
                        ]}
                        onPress={() => setProductName(item)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            productName === item && styles.chipTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom + 12, 24) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.primaryButton,
                    productName.trim().length === 0 && styles.disabledButton,
                  ]}
                  disabled={productName.trim().length === 0}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep(2);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* PASSO 2: MODALIDADES (PRONTO, PRESTAÇÕES OU CRÉDITO COM CÁLCULOS) */}
          {/* ================================================================= */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <ScrollView
                ref={step2ScrollRef}
                style={styles.scrollArea}
                contentContainerStyle={[
                  styles.scrollContent,
                  isKeyboardVisible && styles.scrollContentWithKeyboard,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
              >
                {/* Cabeçalho de Resumo */}
                <View style={styles.amountBanner}>
                  <View>
                    <Text style={styles.amountBannerLabel}>{productName}</Text>
                    <Text style={styles.amountBannerValue}>
                      {numericPrice.toLocaleString('pt-PT', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      €
                    </Text>
                  </View>
                </View>

                {/* Seleção das 3 Modalidades */}
                <Text style={styles.sectionHeaderTitle}>
                  Como pretende pagar?
                </Text>

                <View style={styles.modeTabsRow}>
                  {/* OPÇÃO 1: A PRONTO */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.modeTab,
                      paymentMode === 'pronto' && styles.modeTabActive,
                    ]}
                    onPress={() => setPaymentMode('pronto')}
                  >
                    <Text
                      style={[
                        styles.modeTabTitle,
                        paymentMode === 'pronto' && styles.modeTabTitleActive,
                      ]}
                    >
                      A Pronto
                    </Text>
                    <Text style={styles.modeTabSubtitle}>Totalidade</Text>
                  </TouchableOpacity>

                  {/* OPÇÃO 2: A PRESTAÇÕES */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.modeTab,
                      paymentMode === 'prestacoes' && styles.modeTabActive,
                    ]}
                    onPress={() => setPaymentMode('prestacoes')}
                  >
                    <Text
                      style={[
                        styles.modeTabTitle,
                        paymentMode === 'prestacoes' && styles.modeTabTitleActive,
                      ]}
                    >
                      A Prestações
                    </Text>
                    <Text style={styles.modeTabSubtitle}>0% Juros</Text>
                  </TouchableOpacity>

                  {/* OPÇÃO 3: A CRÉDITO */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.modeTab,
                      paymentMode === 'credito' && styles.modeTabActive,
                    ]}
                    onPress={() => setPaymentMode('credito')}
                  >
                    <Text
                      style={[
                        styles.modeTabTitle,
                        paymentMode === 'credito' && styles.modeTabTitleActive,
                      ]}
                    >
                      A Crédito
                    </Text>
                    <Text style={styles.modeTabSubtitle}>Banco / Juros</Text>
                  </TouchableOpacity>
                </View>

                {/* PAINEL DINÂMICO CONFORME A MODALIDADE */}

                {/* 1. SE FOR A PRONTO */}
                {paymentMode === 'pronto' && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Pagamento a Pronto</Text>
                    <Text style={styles.cardDescription}>
                      Paga o valor total no momento da compra sem recorrer a empréstimos nem criar encargos mensais futuros.
                    </Text>

                    <View style={styles.calcSummaryBox}>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Montante a pagar hoje:</Text>
                        <Text style={styles.calcValueBold}>
                          {numericPrice.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          €
                        </Text>
                      </View>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Juros ou encargos:</Text>
                        <Text style={[styles.calcValue, { color: '#34D399' }]}>
                          0,00 € (Sem custos extra)
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 2. SE FOR A PRESTAÇÕES */}
                {paymentMode === 'prestacoes' && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Prestações sem Juros</Text>
                    <Text style={styles.cardDescription}>
                      Pagamento dividido por mês sem recurso bancário (ex: parcelamento do retalhista ou acordo direto).
                    </Text>

                    {/* Alternador de Modo: Nº de Prestações vs Quero pagar X/mês */}
                    <View style={styles.subToggleContainer}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[
                          styles.subToggleBtn,
                          installmentType === 'count' && styles.subToggleBtnActive,
                        ]}
                        onPress={() => setInstallmentType('count')}
                      >
                        <Text
                          style={[
                            styles.subToggleText,
                            installmentType === 'count' && styles.subToggleTextActive,
                          ]}
                        >
                          Definir Meses
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[
                          styles.subToggleBtn,
                          installmentType === 'monthly_target' && styles.subToggleBtnActive,
                        ]}
                        onPress={() => setInstallmentType('monthly_target')}
                      >
                        <Text
                          style={[
                            styles.subToggleText,
                            installmentType === 'monthly_target' && styles.subToggleTextActive,
                          ]}
                        >
                          Quero pagar X €/mês
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Caso A: Definir número livre de prestações */}
                    {installmentType === 'count' && (
                      <View style={styles.subSection}>
                        <Text style={styles.inputFieldLabel}>
                          Número de Prestações (Livre, sem limites):
                        </Text>

                        {/* Chips populares com scroll */}
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.horizontalChipsScroll}
                        >
                          {POPULAR_INSTALLMENT_COUNTS.map((cnt) => (
                            <TouchableOpacity
                              key={cnt}
                              activeOpacity={0.7}
                              style={[
                                styles.chip,
                                customInstallmentsCount === String(cnt) &&
                                styles.chipActive,
                              ]}
                              onPress={() => setCustomInstallmentsCount(String(cnt))}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  customInstallmentsCount === String(cnt) &&
                                  styles.chipTextActive,
                                ]}
                              >
                                {cnt}x
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Input numérico direto para qualquer número de prestações */}
                        <View style={styles.stepperRow}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.stepperBtn}
                            onPress={() => {
                              const curr = parseInt(customInstallmentsCount, 10) || 1;
                              if (curr > 1) setCustomInstallmentsCount(String(curr - 1));
                            }}
                          >
                            <Text style={styles.stepperBtnText}>-</Text>
                          </TouchableOpacity>

                          <TextInput
                            style={styles.stepperInput}
                            keyboardType="numeric"
                            value={customInstallmentsCount}
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9]/g, '');
                              setCustomInstallmentsCount(clean);
                            }}
                            placeholder="Meses"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            onFocus={() => {
                              setTimeout(() => {
                                step2ScrollRef.current?.scrollTo({ y: 200, animated: true });
                              }, 120);
                            }}
                          />

                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.stepperBtn}
                            onPress={() => {
                              const curr = parseInt(customInstallmentsCount, 10) || 1;
                              setCustomInstallmentsCount(String(curr + 1));
                            }}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Caso B: Quero pagar X por mês */}
                    {installmentType === 'monthly_target' && (
                      <View style={styles.subSection}>
                        <Text style={styles.inputFieldLabel}>
                          Quanto pretende pagar por mês no máximo?
                        </Text>

                        <View style={styles.inputPrefixWrap}>
                          <TextInput
                            style={styles.textInputWithSuffix}
                            keyboardType="numeric"
                            value={targetMonthlyInput}
                            onChangeText={setTargetMonthlyInput}
                            placeholder="Ex: 50"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            onFocus={() => {
                              setTimeout(() => {
                                step2ScrollRef.current?.scrollTo({ y: 220, animated: true });
                              }, 120);
                            }}
                          />
                          <Text style={styles.inputSuffix}>€ / mês</Text>
                        </View>

                        {/* Chips de valores mensais frequentes */}
                        <View style={styles.chipsRow}>
                          {['25', '50', '75', '100', '150', '200'].map((val) => (
                            <TouchableOpacity
                              key={val}
                              activeOpacity={0.7}
                              style={[
                                styles.chip,
                                targetMonthlyInput === val && styles.chipActive,
                              ]}
                              onPress={() => setTargetMonthlyInput(val)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  targetMonthlyInput === val && styles.chipTextActive,
                                ]}
                              >
                                {val} €/mês
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Card de Cálculo em Tempo Real */}
                    <View style={styles.calcSummaryBox}>
                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Mensalidade estimada:</Text>
                        <Text style={styles.calcValueBold}>
                          ~
                          {effectiveMonthlyPaymentZeroInterest.toLocaleString(
                            'pt-PT',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}{' '}
                          € / mês
                        </Text>
                      </View>

                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Total de prestações:</Text>
                        <Text style={styles.calcValue}>
                          {effectiveInstallments} meses
                        </Text>
                      </View>

                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Total a pagar no fim:</Text>
                        <Text style={[styles.calcValue, { color: '#34D399' }]}>
                          {numericPrice.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          € (0% juros)
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 3. SE FOR A CRÉDITO */}
                {paymentMode === 'credito' && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Crédito Bancário / Financiamento</Text>
                    <Text style={styles.cardDescription}>
                      Insira as condições do banco para calcularmos as prestações exatas, total de juros e MTIC.
                    </Text>

                    {/* Prazo em Meses */}
                    <Text style={styles.inputFieldLabel}>Prazo do Crédito (meses):</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.horizontalChipsScroll}
                    >
                      {POPULAR_CREDIT_MONTHS.map((m) => (
                        <TouchableOpacity
                          key={m}
                          activeOpacity={0.7}
                          style={[
                            styles.chip,
                            creditMonths === String(m) && styles.chipActive,
                          ]}
                          onPress={() => setCreditMonths(String(m))}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              creditMonths === String(m) && styles.chipTextActive,
                            ]}
                          >
                            {m}m ({Math.round(m / 12)} anos)
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Stepper / Input para Meses de Crédito */}
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.stepperBtn}
                        onPress={() => {
                          const curr = parseInt(creditMonths, 10) || 12;
                          if (curr > 6) setCreditMonths(String(curr - 6));
                        }}
                      >
                        <Text style={styles.stepperBtnText}>-6m</Text>
                      </TouchableOpacity>

                      <TextInput
                        style={styles.stepperInput}
                        keyboardType="numeric"
                        value={creditMonths}
                        onChangeText={(val) => {
                          const clean = val.replace(/[^0-9]/g, '');
                          setCreditMonths(clean);
                        }}
                        placeholder="Meses"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        onFocus={() => {
                          setTimeout(() => {
                            step2ScrollRef.current?.scrollTo({ y: 350, animated: true });
                          }, 120);
                        }}
                      />

                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.stepperBtn}
                        onPress={() => {
                          const curr = parseInt(creditMonths, 10) || 12;
                          setCreditMonths(String(curr + 6));
                        }}
                      >
                        <Text style={styles.stepperBtnText}>+6m</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Inputs de TAN, TAEG e Comissões */}
                    <View style={styles.creditInputsGrid}>
                      {/* TAN */}
                      <View style={styles.creditInputCol}>
                        <Text style={styles.smallInputLabel}>TAN (%)</Text>
                        <TextInput
                          style={styles.smallInput}
                          keyboardType="numeric"
                          value={tanInput}
                          onChangeText={setTanInput}
                          placeholder="8.5"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          onFocus={() => {
                            setTimeout(() => {
                              step2ScrollRef.current?.scrollTo({ y: 460, animated: true });
                            }, 120);
                          }}
                        />
                      </View>

                      {/* TAEG */}
                      <View style={styles.creditInputCol}>
                        <Text style={styles.smallInputLabel}>TAEG (%)</Text>
                        <TextInput
                          style={styles.smallInput}
                          keyboardType="numeric"
                          value={taegInput}
                          onChangeText={setTaegInput}
                          placeholder="11.5"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          onFocus={() => {
                            setTimeout(() => {
                              step2ScrollRef.current?.scrollTo({ y: 460, animated: true });
                            }, 120);
                          }}
                        />
                      </View>

                      {/* Comissões */}
                      <View style={styles.creditInputCol}>
                        <Text style={styles.smallInputLabel}>Despesas (€)</Text>
                        <TextInput
                          style={styles.smallInput}
                          keyboardType="numeric"
                          value={commissionsInput}
                          onChangeText={setCommissionsInput}
                          placeholder="0"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          onFocus={() => {
                            setTimeout(() => {
                              step2ScrollRef.current?.scrollTo({ y: 460, animated: true });
                            }, 120);
                          }}
                        />
                      </View>
                    </View>

                    {/* Resumo Financeiro Bancário Calculado */}
                    <View style={styles.creditCalcBox}>
                      <View style={styles.creditHighlightRow}>
                        <View>
                          <Text style={styles.creditHighlightLabel}>
                            Prestação Mensal Bancária:
                          </Text>
                          <Text style={styles.creditHighlightValue}>
                            {creditMonthlyPMT.toLocaleString('pt-PT', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            € / mês
                          </Text>
                        </View>
                        <View style={styles.creditBadge}>
                          <Text style={styles.creditBadgeText}>
                            {creditMonthsNum} meses
                          </Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Valor Solicitado:</Text>
                        <Text style={styles.calcValue}>
                          {numericPrice.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          €
                        </Text>
                      </View>

                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabel}>Juros a Pagar ao Banco:</Text>
                        <Text style={[styles.calcValue, { color: '#F87171' }]}>
                          +
                          {totalInterest.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          €
                        </Text>
                      </View>

                      {commissionsNum > 0 && (
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Comissões e Impostos:</Text>
                          <Text style={[styles.calcValue, { color: '#FBBF24' }]}>
                            +
                            {commissionsNum.toLocaleString('pt-PT', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            €
                          </Text>
                        </View>
                      )}

                      <View style={styles.calcRow}>
                        <Text style={styles.calcLabelBold}>
                          MTIC (Custo Total Final):
                        </Text>
                        <Text style={styles.calcValueBoldLarge}>
                          {mticCalculated.toLocaleString('pt-PT', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          €
                        </Text>
                      </View>

                      <View style={styles.warningCostPill}>
                        <AlertTriangleIcon size={14} color="#FBBF24" />
                        <Text style={styles.warningCostText}>
                          O crédito adiciona +{creditOvercostPercent.toFixed(1)}% ao
                          custo do produto em juros e encargos.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom + 12, 24) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.primaryButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep(3);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Avançar para Contexto & Estratégia</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* PASSO 3: CONTEXTO & ESTRATÉGIA FINANCEIRA (TRADE-OFFS / POUPANÇAS)*/}
          {/* ================================================================= */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <ScrollView
                ref={step3ScrollRef}
                style={styles.scrollArea}
                contentContainerStyle={[
                  styles.scrollContent,
                  isKeyboardVisible && styles.scrollContentWithKeyboard,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={true}
              >
                <View style={styles.amountBanner}>
                  <Text style={styles.amountBannerLabel}>{productName}</Text>
                  <Text style={styles.amountBannerValue}>
                    {numericPrice.toLocaleString('pt-PT', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    €
                  </Text>
                  <Text style={styles.amountBannerSub}>
                    Modalidade:{' '}
                    {paymentMode === 'pronto'
                      ? 'A Pronto'
                      : paymentMode === 'prestacoes'
                        ? `${effectiveInstallments}x de ~${effectiveMonthlyPaymentZeroInterest.toFixed(2)} € (0% juros)`
                        : `Crédito ${creditMonthsNum}m de ~${creditMonthlyPMT.toFixed(2)} €`}
                  </Text>
                </View>

                {/* Card de Contexto & Estratégia */}
                <View style={styles.card}>
                  <View style={styles.contextHeaderBadge}>
                    <SparkleIcon size={14} color="#34D399" />
                    <Text style={styles.contextHeaderBadgeText}>ESTRATÉGIA & IMPACTO</Text>
                  </View>
                  <Text style={styles.cardTitle}>Contexto Financeiro (Opcional)</Text>
                  <Text style={styles.cardDescription}>
                    Esta compra substitui outras despesas ou gera património próprio? Explique o cenário para a IA calcular o custo líquido real e os trade-offs.
                  </Text>

                  {/* Sugestões Rápidas de Contexto */}
                  <Text style={styles.quickLabel}>Sugestões rápidas de contexto:</Text>
                  {/* <View style={styles.contextChipsContainer}>
                    {[
                      {
                        label: '🏠 Substitui rendas',
                        snippet: 'Com esta compra deixo de pagar rendas a terceiros e começo a amortizar património próprio.',
                      },
                      {
                        label: '🏢 Cria património próprio',
                        snippet: 'A prestação substitui custo a fundo perdido por um ativo imobiliário/duradouro com valorização futura.',
                      },
                      {
                        label: '📉 Corta custos fixos',
                        snippet: 'Permite eliminar despesas mensais operacionais que tenho atualmente.',
                      },
                      {
                        label: '💼 Gera novas receitas',
                        snippet: 'Este bem vai gerar faturação e rendimentos diretos para a minha atividade comercial.',
                      },
                    ].map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        style={styles.contextChip}
                        onPress={() => {
                          setContextText((prev) => {
                            if (!prev.trim()) return item.snippet;
                            if (prev.includes(item.snippet)) return prev;
                            return `${prev.trim()} ${item.snippet}`;
                          });
                        }}
                      >
                        <Text style={styles.contextChipText}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View> */}

                  {/* Input Multiline */}
                  <View style={styles.contextInputWrapper}>
                    <TextInput
                      style={styles.contextTextInput}
                      multiline
                      numberOfLines={4}
                      placeholder="Ex: Se comprar este terreno de 120k a 2000€/mês, deixo de pagar 800€ de renda de casa + 200€ de armazém, ficando com património próprio ao fim de X anos..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={contextText}
                      onChangeText={setContextText}
                      textAlignVertical="top"
                      onFocus={() => {
                        setTimeout(() => {
                          step3ScrollRef.current?.scrollToEnd({ animated: true });
                        }, 120);
                      }}
                    />
                    <View style={styles.contextCharCountRow}>
                      <View style={styles.contextLeftActions}>
                        {contextText.length > 0 && (
                          <TouchableOpacity onPress={() => setContextText('')}>
                            <Text style={styles.clearContextText}>Limpar</Text>
                          </TouchableOpacity>
                        )}
                        {isKeyboardVisible && (
                          <TouchableOpacity
                            onPress={() => Keyboard.dismiss()}
                            style={styles.dismissKeyBtn}
                          >
                            <Text style={styles.dismissKeyText}>Ocultar teclado ▾</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.contextCharCountText}>
                        {contextText.length} carateres
                      </Text>
                    </View>
                  </View>

                  {/* Dica da IA */}
                  <View style={styles.contextHintBox}>
                    <Text style={styles.contextHintText}>
                      💡 O Vault AI ponderará as poupanças declaradas contra a prestação para calcular o esforço líquido e a valorização patrimonial.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom + 12, 24) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.primaryButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setStep(4);
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    {contextText.trim() ? 'Continuar para Avaliação' : 'Continuar (Sem Contexto)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* PASSO 4: NECESSIDADE & URGÊNCIA                                   */}
          {/* ================================================================= */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.amountBanner}>
                  <Text style={styles.amountBannerLabel}>{productName}</Text>
                  <Text style={styles.amountBannerValue}>
                    {numericPrice.toLocaleString('pt-PT', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    €
                  </Text>
                  <Text style={styles.amountBannerSub}>
                    Modalidade:{' '}
                    {paymentMode === 'pronto'
                      ? 'A Pronto'
                      : paymentMode === 'prestacoes'
                        ? `${effectiveInstallments}x de ~${effectiveMonthlyPaymentZeroInterest.toFixed(2)} € (0% juros)`
                        : `Crédito ${creditMonthsNum}m de ~${creditMonthlyPMT.toFixed(2)} € (Juros +${totalInterest.toFixed(2)} €)`}
                  </Text>
                </View>

                {/* Pergunta 1: Grau de Necessidade */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Qual é o grau de necessidade?</Text>
                  <Text style={styles.cardDescription}>
                    Seja honesto com as suas finanças para uma análise rigorosa.
                  </Text>

                  <View style={styles.optionCardsGroup}>
                    {[
                      {
                        key: 'essencial',
                        title: 'Essencial',
                        desc: 'Indispensável para o dia a dia, trabalho ou saúde.',
                      },
                      {
                        key: 'importante',
                        title: 'Importante',
                        desc: 'Traz utilidade e conforto, mas consigo viver sem ele.',
                      },
                      {
                        key: 'superfluo',
                        title: 'Supérfluo / Capricho',
                        desc: 'Vontade imediata, luxo ou prazer momentâneo.',
                      },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        activeOpacity={0.7}
                        style={[
                          styles.optionCard,
                          necessity === opt.key && styles.optionCardActive,
                        ]}
                        onPress={() => setNecessity(opt.key as NecessityLevel)}
                      >
                        <View style={styles.optionCardHeader}>
                          <Text
                            style={[
                              styles.optionCardTitle,
                              necessity === opt.key && styles.optionCardTitleActive,
                            ]}
                          >
                            {opt.title}
                          </Text>
                          {necessity === opt.key && (
                            <View style={styles.checkedCircle}>
                              <CheckIcon size={12} color="#02231E" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionCardDesc}>{opt.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Pergunta 2: Urgência */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Qual é a urgência da compra?</Text>
                  <Text style={styles.cardDescription}>
                    Pode esperar para poupar ou precisa do artigo já este mês?
                  </Text>

                  <View style={styles.optionCardsGroup}>
                    {[
                      {
                        key: 'urgente',
                        title: 'Urgente',
                        desc: 'Preciso já esta semana, não pode aguardar.',
                      },
                      {
                        key: 'moderada',
                        title: 'Moderada',
                        desc: 'Posso aguardar algumas semanas se for vantajoso.',
                      },
                      {
                        key: 'sem_pressa',
                        title: 'Sem Pressa',
                        desc: 'Posso planear ou aguardar saldos e poupar.',
                      },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        activeOpacity={0.7}
                        style={[
                          styles.optionCard,
                          urgency === opt.key && styles.optionCardActive,
                        ]}
                        onPress={() => setUrgency(opt.key as UrgencyLevel)}
                      >
                        <View style={styles.optionCardHeader}>
                          <Text
                            style={[
                              styles.optionCardTitle,
                              urgency === opt.key && styles.optionCardTitleActive,
                            ]}
                          >
                            {opt.title}
                          </Text>
                          {urgency === opt.key && (
                            <View style={styles.checkedCircle}>
                              <CheckIcon size={12} color="#02231E" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionCardDesc}>{opt.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View
                style={[
                  styles.bottomBar,
                  { paddingBottom: Math.max(insets.bottom + 12, 24) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.aiConsultButton}
                  onPress={handleConsultGemini}
                >
                  <SparkleIcon size={20} color="#FFFFFF" />
                  <Text style={styles.aiConsultButtonText}>
                    Analisar com Vault AI
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================================================================= */}
          {/* PASSO 5: RESULTADO DO CONSULTOR IA (VAULT AI)                     */}
          {/* ================================================================= */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              {isAiLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#34D399" />
                  <Text style={styles.loadingTitle}>A Consultar o Vault AI...</Text>
                  <Text style={styles.loadingSubtitle}>
                    O Vault AI está a cruzar o seu saldo, rendimentos, despesas fixas e o impacto dos juros/prestações.
                  </Text>
                </View>
              ) : errorMessage ? (
                <View style={styles.errorContainer}>
                  <AlertTriangleIcon size={48} color="#F87171" />
                  <Text style={styles.errorTitle}>Não foi possível concluir</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.retryButton}
                    onPress={handleConsultGemini}
                  >
                    <Text style={styles.retryButtonText}>Tentar Novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : aiAdvice ? (
                <ScrollView
                  style={styles.scrollArea}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Card do Score de Viabilidade */}
                  <View style={styles.adviceScoreCard}>
                    <View style={styles.scoreRow}>
                      <View>
                        <Text style={styles.scoreLabel}>Viabilidade Financeira</Text>
                        <Text style={styles.verdictText}>{aiAdvice.verdict}</Text>
                      </View>
                      <View
                        style={[
                          styles.scoreCircle,
                          aiAdvice.score >= 70
                            ? styles.scoreSuccess
                            : aiAdvice.score >= 40
                              ? styles.scoreWarning
                              : styles.scoreDanger,
                        ]}
                      >
                        <Text style={styles.scoreNumber}>{aiAdvice.score}</Text>
                        <Text style={styles.scoreMax}>/100</Text>
                      </View>
                    </View>

                    <Text style={styles.adviceSummary}>{aiAdvice.summary}</Text>
                  </View>

                  {/* Card de Análise de Trade-Off & Contexto Estratégico */}
                  {aiAdvice.contextAnalysis && (
                    <View style={styles.contextTradeoffCard}>
                      <View style={styles.contextCardHeader}>
                        <SparkleIcon size={17} color="#34D399" />
                        <Text style={styles.contextCardTitle}>
                          Trade-Off Estratégico & Património
                        </Text>
                      </View>
                      <Text style={styles.contextCardText}>
                        {aiAdvice.contextAnalysis}
                      </Text>
                    </View>
                  )}

                  {/* Resumo da Modalidade Avaliada */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Enquadramento da Compra</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Produto:</Text>
                      <Text style={styles.detailVal}>{productName}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Preço:</Text>
                      <Text style={styles.detailVal}>
                        {numericPrice.toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        €
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Modalidade:</Text>
                      <Text style={styles.detailVal}>
                        {paymentMode === 'pronto' && 'A Pronto Pagamento'}
                        {paymentMode === 'prestacoes' &&
                          `Prestações (${effectiveInstallments}x de ~${effectiveMonthlyPaymentZeroInterest.toFixed(2)} €)`}
                        {paymentMode === 'credito' &&
                          `Crédito (${creditMonthsNum}m de ~${creditMonthlyPMT.toFixed(2)} €)`}
                      </Text>
                    </View>
                    {paymentMode === 'credito' && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Juros a pagar ao banco:</Text>
                        <Text style={[styles.detailVal, { color: '#F87171' }]}>
                          +{totalInterest.toFixed(2)} € (MTIC: {mticCalculated.toFixed(2)} €)
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Recomendação Estratégica do Vault AI */}
                  <View style={styles.card}>
                    <View style={styles.cardHeaderWithIcon}>
                      <SparkleIcon size={18} color="#34D399" />
                      <Text style={styles.cardTitle}>Recomendação Estratégica</Text>
                    </View>
                    <Text style={styles.recommendationText}>
                      {aiAdvice.strategicRecommendation}
                    </Text>
                  </View>

                  {/* Plano de Poupança / Alternativa Consciente */}
                  {aiAdvice.savingsPlan && (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Plano de Poupança Sugerido</Text>
                      <Text style={styles.savingsPlanText}>
                        {aiAdvice.savingsPlan.explanation}
                      </Text>
                      {aiAdvice.savingsPlan.monthsToSave > 0 && (
                        <View style={styles.savingsPlanMetrics}>
                          <View style={styles.savingsMetricCol}>
                            <Text style={styles.savingsMetricVal}>
                              {aiAdvice.savingsPlan.monthsToSave} meses
                            </Text>
                            <Text style={styles.savingsMetricLbl}>
                              Tempo de Poupança
                            </Text>
                          </View>
                          <View style={styles.savingsMetricCol}>
                            <Text style={styles.savingsMetricVal}>
                              {aiAdvice.savingsPlan.monthlyAmountToSave.toFixed(2)} €
                            </Text>
                            <Text style={styles.savingsMetricLbl}>
                              Poupar por mês
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Pontos Críticos de Atenção */}
                  {aiAdvice.keyPoints && aiAdvice.keyPoints.length > 0 && (
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Pontos Críticos</Text>
                      {aiAdvice.keyPoints.map((pt, idx) => (
                        <View key={`pt-${idx}`} style={styles.bulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.bulletText}>{pt}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>
              ) : null}

              {/* Botões do Ecrã de Resultado */}
              {!isAiLoading && (
                <View
                  style={[
                    styles.bottomBar,
                    { paddingBottom: Math.max(insets.bottom + 12, 24) },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.primaryButton}
                    onPress={() => {
                      setStep(0);
                      setAiAdvice(null);
                      setAmount('100');
                      setContextText('');
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Nova Simulação</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// Folha de Estilos com Acabamento Premium
// ============================================================================
const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#02231E',
  },
  gradientContainer: {
    flex: 1,
  },
  fullFlex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  headerBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#34D399',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // PASSO 0: DISPLAY DO VALOR
  amountDisplayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  amountLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  amountValueText: {
    fontFamily: FontFamily.bold,
    fontSize: 54,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  currencySymbol: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    color: '#34D399',
    marginLeft: 6,
  },
  amountHelper: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 10,
    textAlign: 'center',
  },

  // TECLADO NUMÉRICO
  keypadContainer: {
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadKey: {
    flex: 1,
    height: 58,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  keypadKeyBackspace: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  keypadKeyText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 24,
    color: '#FFFFFF',
  },
  keypadKeyBackspaceText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // BANNERS E CARDS
  amountBanner: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  amountBannerLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  amountBannerValue: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: '#FFFFFF',
    marginTop: 4,
  },
  amountBannerSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#34D399',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  quickLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  chipTextActive: {
    color: '#02231E',
    fontFamily: FontFamily.bold,
  },

  // MODALIDADES (STEP 2)
  sectionHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeTabActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: '#34D399',
  },
  modeTabTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  modeTabTitleActive: {
    color: '#34D399',
  },
  modeTabSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // SUB-TOGGLE PRESTAÇÕES
  subToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  subToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  subToggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  subToggleText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  subToggleTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
  },
  subSection: {
    marginBottom: 16,
  },
  inputFieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  horizontalChipsScroll: {
    marginBottom: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 6,
  },
  stepperBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepperBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  stepperInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    width: 100,
    height: 46,
    textAlign: 'center',
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  inputPrefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  textInputWithSuffix: {
    flex: 1,
    height: 48,
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  inputSuffix: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#34D399',
    marginLeft: 8,
  },

  // CRÉDITO BANCÁRIO INPUTS
  creditInputsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  creditInputCol: {
    flex: 1,
  },
  smallInputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  smallInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 10,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    textAlign: 'center',
  },
  creditCalcBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  creditHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  creditHighlightLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  creditHighlightValue: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 2,
  },
  creditBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  creditBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#34D399',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
  },
  warningCostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  warningCostText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#FBBF24',
    lineHeight: 15,
  },

  // CÁLCULOS RESUMO GERAL
  calcSummaryBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 14,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  calcLabelBold: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  calcValue: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  calcValueBold: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  calcValueBoldLarge: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#34D399',
  },

  // STEP 3: OPÇÕES DE NECESSIDADE & URGÊNCIA
  optionCardsGroup: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  optionCardActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: '#34D399',
  },
  optionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  optionCardTitleActive: {
    color: '#34D399',
  },
  optionCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
  },
  checkedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // STEP 4: RESULTADO IA
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 18,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  adviceScoreCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  scoreLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  verdictText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: 2,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  scoreSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34D399',
  },
  scoreWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: '#FBBF24',
  },
  scoreDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderColor: '#F87171',
  },
  scoreNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  scoreMax: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
  },
  adviceSummary: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recommendationText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#34D399',
    lineHeight: 20,
  },
  savingsPlanText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  savingsPlanMetrics: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
  },
  savingsMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  savingsMetricVal: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  savingsMetricLbl: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  detailVal: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // BOTÕES INFERIORES
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  primaryButton: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#02231E',
    letterSpacing: 0.3,
  },
  aiConsultButton: {
    height: 54,
    backgroundColor: '#059669',
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  aiConsultButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // CONTEXTO & TRADE-OFF (STEP 3 & RESULT)
  contextHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  contextHeaderBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#34D399',
    letterSpacing: 0.8,
  },
  contextChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  contextChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  contextChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  contextInputWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 14,
    marginBottom: 14,
  },
  contextTextInput: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
    minHeight: 90,
  },
  contextCharCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  clearContextText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#F87171',
  },
  contextCharCountText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginLeft: 'auto',
  },
  contextHintBox: {
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
  },
  contextHintText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#A7F3D0',
    lineHeight: 17,
  },
  contextTradeoffCard: {
    backgroundColor: 'rgba(6, 78, 59, 0.45)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  contextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  contextCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#34D399',
  },
  contextCardText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#F3F4F6',
    lineHeight: 22,
  },
  scrollContentWithKeyboard: {
    paddingTop: 40,
  },
  contextLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dismissKeyBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  dismissKeyText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#34D399',
  },
});
