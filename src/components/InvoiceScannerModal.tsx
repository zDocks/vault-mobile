import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Dimensions,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import {
  ScannerIcon,
  CloseIcon,
  SparkleIcon,
  CheckIcon,
  CameraIcon,
  DocumentPdfIcon,
  BackArrowIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ClockIcon,
  CalendarIcon,
} from './Icons';
import { Colors } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import { aiApi, transactionsApi, entitiesApi, categoriesApi } from '../services/api';
import { scheduleInvoicePaymentReminders } from '../services/notifications';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const DAY_ITEM_WIDTH = 52;

const parseDateString = (str?: string): Date => {
  if (!str) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }
  const parts = str.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dt = new Date(y, m, d);
      dt.setHours(0, 0, 0, 0);
      return dt;
    }
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
};

const formatDateToIso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Payment Method Custom Icons
const CashPaymentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="3" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
    <Path d="M6 9h.01M18 15h.01" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const MbwayPaymentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="6" y="2.5" width="12" height="19" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M10 5.5h4M12 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M2.5 10l2 2-2 2M21.5 10l-2 2 2 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CardPaymentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="4.5" width="20" height="15" rx="3" stroke={color} strokeWidth="1.8" />
    <Path d="M2 9.5h20" stroke={color} strokeWidth="1.8" />
    <Rect x="5" y="13.5" width="4.5" height="2.5" rx="0.5" fill={color} />
  </Svg>
);

const TransferPaymentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9.5L12 4l9 5.5v1.5H3V9.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M5.5 11v6M9.8 11v6M14.2 11v6M18.5 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M2 18.5h20v2H2v-2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </Svg>
);

export type PaymentMethodType = 'Dinheiro' | 'MB WAY' | 'Cartão' | 'Transferência';

const PAYMENT_METHODS: Array<{
  id: PaymentMethodType;
  label: string;
  desc: string;
  icon: React.FC<{ size?: number; color?: string }>;
}> = [
    {
      id: 'Dinheiro',
      label: 'Dinheiro',
      desc: 'Pagamento em numerário / notas',
      icon: CashPaymentIcon,
    },
    {
      id: 'MB WAY',
      label: 'MB WAY',
      desc: 'Pagamento por telemóvel / app MB WAY',
      icon: MbwayPaymentIcon,
    },
    {
      id: 'Cartão',
      label: 'Cartão',
      desc: 'Multibanco, débito ou crédito',
      icon: CardPaymentIcon,
    },
    {
      id: 'Transferência',
      label: 'Transferência',
      desc: 'Transferência bancária / IBAN',
      icon: TransferPaymentIcon,
    },
  ];

interface InvoiceScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InvoiceScannerModal: React.FC<InvoiceScannerModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [modalRendered, setModalRendered] = useState(false);
  const [step, setStep] = useState<'pick' | 'scanning' | 'review' | 'payment_method'>('pick');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Cartão');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scanned Fields
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('0.00');
  const [category, setCategory] = useState('Fornecedores');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState('');
  const [taxNumber, setTaxNumber] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);

  // Payment status & Due Date for Invoices
  const [isPaid, setIsPaid] = useState<boolean>(true);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().substring(0, 10);
  });

  const setQuickDueDate = (daysToAdd: number) => {
    const base = new Date();
    base.setDate(base.getDate() + daysToAdd);
    setDueDate(base.toISOString().substring(0, 10));
  };

  const setEndOfMonthDueDate = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDueDate(lastDay.toISOString().substring(0, 10));
  };

  // DatePicker state (Funcionalidades completas do DatePicker da app)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'invoiceDate' | 'dueDate'>('dueDate');
  const [pickerSelectedDate, setPickerSelectedDate] = useState<Date>(new Date());
  const [pickerMonthIndex, setPickerMonthIndex] = useState(new Date().getMonth());
  const pickerScrollRef = useRef<ScrollView>(null);

  const pickerFadeAnim = useRef(new Animated.Value(0)).current;
  const pickerSlideAnim = useRef(new Animated.Value(450)).current;

  // Faixa contínua de dias (-60 a +180 dias) centrada no dia de hoje
  const pickerDays = React.useMemo(() => {
    const days: { date: Date; dayNum: number; dayName: string; key: string; time: number }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let offset = -60; offset <= 180; offset++) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      days.push({
        date: d,
        dayNum: d.getDate(),
        dayName: WEEK_DAYS[d.getDay()],
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        time: d.getTime(),
      });
    }
    return days;
  }, []);

  const openDatePicker = (target: 'invoiceDate' | 'dueDate') => {
    setDatePickerTarget(target);
    const initialDate = parseDateString(target === 'dueDate' ? dueDate : date);
    setPickerSelectedDate(initialDate);
    setPickerMonthIndex(initialDate.getMonth());
    setIsDatePickerOpen(true);

    pickerFadeAnim.setValue(0);
    pickerSlideAnim.setValue(450);
    Animated.parallel([
      Animated.timing(pickerFadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pickerSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-scroll suave para a data selecionada ao abrir
    setTimeout(() => {
      const selTime = initialDate.getTime();
      const targetIdx = pickerDays.findIndex((d) => d.time === selTime);
      if (targetIdx !== -1) {
        pickerScrollRef.current?.scrollTo({
          x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
          animated: false,
        });
      }
    }, 80);
  };

  const closeDatePicker = () => {
    Animated.parallel([
      Animated.timing(pickerFadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pickerSlideAnim, {
        toValue: 450,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDatePickerOpen(false);
    });
  };

  const handleConfirmPickerDate = () => {
    const formatted = formatDateToIso(pickerSelectedDate);
    if (datePickerTarget === 'dueDate') {
      setDueDate(formatted);
    } else {
      setDate(formatted);
    }
    closeDatePicker();
  };

  const handlePickerScroll = (e: any) => {
    const scrollX = e.nativeEvent.contentOffset.x;
    const centerIdx = Math.round((scrollX + 140) / DAY_ITEM_WIDTH);
    const clampedIdx = Math.max(0, Math.min(centerIdx, pickerDays.length - 1));
    const month = pickerDays[clampedIdx].date.getMonth();
    if (month !== pickerMonthIndex) {
      setPickerMonthIndex(month);
    }
  };

  const handlePickerMonthNav = (direction: 'next' | 'prev') => {
    const newMonth = (pickerMonthIndex + (direction === 'next' ? 1 : -1) + 12) % 12;
    setPickerMonthIndex(newMonth);
    const targetIdx = pickerDays.findIndex((d) => d.date.getMonth() === newMonth);
    if (targetIdx !== -1) {
      pickerScrollRef.current?.scrollTo({
        x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
        animated: true,
      });
    }
  };

  // Entity & Categories Metadata
  const [existingEntities, setExistingEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [existingCategories, setExistingCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [isNewSupplier, setIsNewSupplier] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isClosingRef = useRef(false);

  // Trigger animations on visible prop
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setModalRendered(true);
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      loadMetadata();
    } else if (modalRendered && !isClosingRef.current) {
      closeWithAnimation();
    }
  }, [visible]);

  // Pulse animation while scanning
  useEffect(() => {
    if (step === 'scanning') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [step]);

  const loadMetadata = async () => {
    try {
      const [entRes, catRes] = await Promise.all([
        entitiesApi.getEntities('fornecedor'),
        categoriesApi.getCategories('despesa'),
      ]);

      if (entRes?.success && entRes.entities) {
        setExistingEntities(entRes.entities);
      }
      if (catRes?.success && catRes.categories) {
        setExistingCategories(catRes.categories);
      }
    } catch (e) {
      console.warn('[Scanner Load Metadata Error]:', e);
    }
  };

  const closeWithAnimation = (onCompleted?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalRendered(false);
      handleReset();
      onClose();
      onCompleted?.();
    });
  };

  const handleReset = () => {
    setStep('pick');
    setIsSaving(false);
    setErrorMessage(null);
    setSupplier('');
    setAmount('0.00');
    setCategory('Fornecedores');
    setDate(new Date().toISOString().substring(0, 10));
    setDescription('');
    setTaxNumber(null);
    setItems([]);
    setIsNewSupplier(false);
    setPaymentMethod('Cartão');
    setIsPaid(true);
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setDueDate(d.toISOString().substring(0, 10));
  };

  const checkSupplierStatus = (name: string, entitiesList = existingEntities) => {
    const norm = name.trim().toLowerCase();
    if (!norm) {
      setIsNewSupplier(false);
      return;
    }

    const match = entitiesList.find(
      (e) =>
        e.name.trim().toLowerCase() === norm ||
        norm.includes(e.name.trim().toLowerCase()) ||
        e.name.trim().toLowerCase().includes(norm)
    );

    setIsNewSupplier(!match);
  };

  const processImage = async (base64Data: string, mimeType: string = 'image/jpeg') => {
    setStep('scanning');
    setErrorMessage(null);

    try {
      const [res, entRes, catRes] = await Promise.all([
        aiApi.scanInvoice(base64Data, mimeType),
        entitiesApi.getEntities('fornecedor'),
        categoriesApi.getCategories('despesa'),
      ]);

      const freshEntities = entRes?.entities || existingEntities;
      if (entRes?.entities) setExistingEntities(entRes.entities);
      if (catRes?.categories) setExistingCategories(catRes.categories);

      if (res.success && res.invoice) {
        const detectedName = res.invoice.supplier || 'Fornecedor';
        setSupplier(detectedName);
        setAmount(String(res.invoice.total || '0.00'));
        setCategory(res.invoice.category || 'Fornecedores');
        const invDate = res.invoice.date || new Date().toISOString().substring(0, 10);
        setDate(invDate);
        const parsedBase = new Date(invDate);
        const baseForDue = isNaN(parsedBase.getTime()) ? new Date() : parsedBase;
        baseForDue.setDate(baseForDue.getDate() + 15);
        setDueDate(baseForDue.toISOString().substring(0, 10));
        setIsPaid(true);
        setDescription(res.invoice.description || 'Fatura processada com Vault AI');
        setTaxNumber(res.invoice.taxNumber || null);
        setItems(res.invoice.items || []);

        checkSupplierStatus(detectedName, freshEntities);
        setStep('review');
      } else {
        setErrorMessage(res.error || 'Não foi possível ler a fatura.');
        setStep('pick');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar imagem.');
      setStep('pick');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmara para digitalizar faturas.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        await processImage(result.assets[0].base64, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Erro ao abrir câmara', err.message);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria para selecionar uma fatura.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        await processImage(result.assets[0].base64, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (err: any) {
      Alert.alert('Erro ao abrir galeria', err.message);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const fileName = (asset.name || '').toLowerCase();
        const isPdf = fileName.endsWith('.pdf') || (asset.mimeType || '').includes('pdf');
        const mimeType = asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg');

        // Ler ficheiro em Base64 através da API legada suportada do FileSystem
        const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (base64Data) {
          await processImage(base64Data, mimeType);
        } else {
          Alert.alert('Erro', 'Não foi possível ler o ficheiro selecionado.');
        }
      }
    } catch (err: any) {
      console.warn('[Pick Document Error]:', err);
      Alert.alert('Erro ao selecionar documento', err.message || 'Falha ao aceder ao ficheiro.');
    }
  };

  const handleProceedToPayment = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Valor inválido', 'Por favor indique um montante positivo válido.');
      return;
    }

    const cleanSupplier = supplier.trim();
    if (!cleanSupplier) {
      Alert.alert('Fornecedor obrigatório', 'Por favor indique o nome do fornecedor.');
      return;
    }

    setStep('payment_method');
  };

  const handleConfirmAndSave = async (overrideMethod?: PaymentMethodType) => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Valor inválido', 'Por favor indique um montante positivo válido.');
      return;
    }

    const cleanSupplier = supplier.trim();
    if (!cleanSupplier) {
      Alert.alert('Fornecedor obrigatório', 'Por favor indique o nome do fornecedor.');
      return;
    }

    if (!isPaid) {
      if (!dueDate || !dueDate.trim()) {
        Alert.alert('Data limite necessária', 'Por favor indica a data limite de pagamento (YYYY-MM-DD).');
        return;
      }
    }

    const finalMethod = overrideMethod || paymentMethod || 'Cartão';

    setIsSaving(true);
    try {
      // 1. Se for um novo fornecedor, cria primeiro a entidade no Vault
      if (isNewSupplier) {
        try {
          await entitiesApi.createEntity(cleanSupplier, 'fornecedor', taxNumber || undefined);
        } catch (entErr: any) {
          console.warn('[Create Entity warning]:', entErr.message);
        }
      }

      // 2. Grava a despesa com o método de pagamento selecionado ou como pendente
      const res = await transactionsApi.createTransaction({
        type: 'despesa',
        name: cleanSupplier,
        amount: numAmount,
        category: category.trim() || 'Fornecedores',
        method: isPaid ? finalMethod : undefined,
        isPaid: isPaid,
        status: isPaid ? 'pago' : 'pendente',
        paymentDate: isPaid ? date : undefined,
        dueDate: !isPaid ? dueDate.trim() : undefined,
        description: description.trim() || undefined,
      });

      if (res.success) {
        // Se for fatura pendente, agenda os lembretes automáticos no SO
        if (!isPaid && res.transaction?.id) {
          await scheduleInvoicePaymentReminders({
            id: res.transaction.id,
            name: cleanSupplier,
            amount: numAmount,
            dueDate: dueDate.trim(),
          });
        }

        closeWithAnimation(() => {
          onSuccess();
        });
      } else {
        Alert.alert('Erro ao gravar', res.error || 'Não foi possível gravar a despesa.');
      }
    } catch (err: any) {
      Alert.alert('Erro ao gravar', err.message || 'Falha de comunicação.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!modalRendered) return null;

  return (
    <Modal
      visible={modalRendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => closeWithAnimation()}
    >
      <View style={styles.rootOverlay}>
        {/* Animated Fade Backdrop */}
        <TouchableWithoutFeedback onPress={() => closeWithAnimation()}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Animated Slide-in/Slide-out Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step === 'payment_method' && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.headerBackBtn}
                  onPress={() => setStep('review')}
                >
                  <BackArrowIcon size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <View style={styles.headerTitleWrap}>
                <View style={styles.aiBadge}>
                  <SparkleIcon size={14} color="#00D09E" />
                  <Text style={styles.aiBadgeText}>
                    {step === 'payment_method'
                      ? isPaid
                        ? 'PAGAMENTO'
                        : 'PENDENTE'
                      : 'VAULT AI OCR'}
                  </Text>
                </View>
                <Text style={styles.headerTitle}>
                  {step === 'review'
                    ? 'Confirmar Fatura'
                    : step === 'payment_method'
                      ? isPaid
                        ? 'Método de Pagamento'
                        : 'Pagamento Pendente'
                      : 'Digitalizar Fatura'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeButton}
              onPress={() => closeWithAnimation()}
            >
              <CloseIcon size={20} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* ================= STEP 1: PICK IMAGE / DOCUMENT ================= */}
          {step === 'pick' && (
            <View style={styles.contentWrap}>
              <Text style={styles.subtitle}>
                Escolhe o método de envio da fatura ou recibo. O Vault AI extrai automaticamente o fornecedor, montante, artigos e categoria.
              </Text>

              <View style={styles.optionsList}>
                {/* 1. Câmara */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.optionRowCard}
                  onPress={handleTakePhoto}
                >
                  <View style={styles.optionIconCircle}>
                    <CameraIcon size={24} color="#00D09E" />
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Tirar Foto</Text>
                    <Text style={styles.optionDesc}>Fotografar recibo físico em papel</Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Galeria de Fotos */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.optionRowCard}
                  onPress={handlePickFromGallery}
                >
                  <View style={styles.optionIconCircle}>
                    <ScannerIcon size={22} color="#00D09E" />
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Galeria de Fotos</Text>
                    <Text style={styles.optionDesc}>Foto guardada na galeria ou Google Fotos</Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Documento / Ficheiro PDF */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.optionRowCard}
                  onPress={handlePickDocument}
                >
                  <View style={styles.optionIconCircle}>
                    <DocumentPdfIcon size={22} color="#00D09E" />
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Documento / Ficheiro PDF</Text>
                    <Text style={styles.optionDesc}>Fatura digital descarregada online (PDF)</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= STEP 2: SCANNING IN PROGRESS ================= */}
          {step === 'scanning' && (
            <View style={styles.scanningWrap}>
              <Animated.View style={[styles.scanIconPulse, { opacity: pulseAnim }]}>
                <ScannerIcon size={46} color="#00D09E" />
              </Animated.View>
              <ActivityIndicator size="large" color="#00D09E" style={{ marginTop: 22 }} />
              <Text style={styles.scanningTitle}>A Processar com Vault AI...</Text>
              <Text style={styles.scanningDesc}>
                A extrair o fornecedor, montante total, categoria e detalhes através de visão computacional inteligente.
              </Text>
            </View>
          )}

          {/* ================= STEP 3: REVIEW & CONFIRM ================= */}
          {step === 'review' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flexShrink: 1 }}
            >
              <ScrollView
                style={styles.reviewScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.reviewContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Notice Banner */}
                <View style={styles.successBanner}>
                  <CheckIcon size={16} color="#00D09E" />
                  <Text style={styles.successBannerText}>
                    Revê as informações antes de gravar no Vault
                  </Text>
                </View>

                {/* Amount Card */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Montante Total (€)</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />
                </View>

                {/* Supplier & Status */}
                <View style={styles.fieldBlock}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Fornecedor / Entidade</Text>
                    {isNewSupplier ? (
                      <View style={styles.newBadgePill}>
                        <SparkleIcon size={11} color="#00D09E" />
                        <Text style={styles.newBadgeText}>Novo Fornecedor</Text>
                      </View>
                    ) : (
                      <View style={styles.existingBadgePill}>
                        <CheckIcon size={11} color="#34D399" />
                        <Text style={styles.existingBadgeText}>Já Registado</Text>
                      </View>
                    )}
                  </View>

                  <TextInput
                    style={styles.textInputField}
                    value={supplier}
                    onChangeText={(val) => {
                      setSupplier(val);
                      checkSupplierStatus(val);
                    }}
                    placeholder="Nome do comerciante/fornecedor"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />

                  {isNewSupplier && (
                    <View style={styles.newSupplierNoticeBox}>
                      <SparkleIcon size={14} color="#00D09E" />
                      <Text style={styles.newSupplierNoticeText}>
                        Este fornecedor ainda não existe no teu sistema. O Vault irá criá-lo automaticamente na tua lista de entidades.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Category Selection with Quick Chips */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Categoria da Despesa</Text>
                  {existingCategories.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryPillsScroll}
                    >
                      {existingCategories.map((cat) => {
                        const isSelected = category.toLowerCase() === cat.name.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            activeOpacity={0.75}
                            style={[
                              styles.categoryPill,
                              isSelected && styles.categoryPillSelected,
                            ]}
                            onPress={() => setCategory(cat.name)}
                          >
                            <Text
                              style={[
                                styles.categoryPillText,
                                isSelected && styles.categoryPillTextSelected,
                              ]}
                            >
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                  <TextInput
                    style={styles.textInputField}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Categoria"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />
                </View>

                {/* Date */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Data da Fatura</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.datePickerInputTrigger}
                    onPress={() => openDatePicker('invoiceDate')}
                  >
                    <CalendarIcon size={16} color="#00D09E" />
                    <Text style={styles.datePickerInputText}>
                      {date || 'Selecionar data'}
                    </Text>
                    <ChevronRightIcon size={14} color="rgba(255, 255, 255, 0.4)" />
                  </TouchableOpacity>
                </View>

                {/* Description */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Descrição / Notas</Text>
                  <TextInput
                    style={[styles.textInputField, { height: 60, textAlignVertical: 'top' }]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    placeholder="Resumo do que foi comprado..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />
                </View>

                {/* Detected Items */}
                {items.length > 0 && (
                  <View style={styles.itemsBlock}>
                    <Text style={styles.itemsLabel}>Artigos Identificados:</Text>
                    {items.map((it, idx) => (
                      <Text key={idx} style={styles.itemBullet}>
                        • {it}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.saveButton}
                  onPress={handleProceedToPayment}
                >
                  <Text style={styles.saveButtonText}>
                    Confirmar e Escolher Pagamento
                  </Text>
                  <ChevronRightIcon size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.rescanButton}
                  onPress={() => setStep('pick')}
                >
                  <Text style={styles.rescanButtonText}>Digitalizar Outra Fatura</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* ================= STEP 4: PAYMENT / DUE DATE SELECTION ================= */}
          {step === 'payment_method' && (
            <ScrollView
              style={styles.paymentScroll}
              contentContainerStyle={styles.paymentContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Invoice Summary Box */}
              <View style={styles.paymentSummaryCard}>
                <View style={styles.paymentSummaryTop}>
                  <Text style={styles.paymentSummaryLabel}>FATURA CONFIRMADA</Text>
                  <Text style={styles.paymentSummaryAmount}>
                    {parseFloat(amount.replace(',', '.') || '0').toFixed(2)} €
                  </Text>
                </View>
                <View style={styles.paymentSummaryDetails}>
                  <Text style={styles.paymentSummarySupplier} numberOfLines={1}>
                    {supplier || 'Fornecedor'}
                  </Text>
                  <Text style={styles.paymentSummaryCategory}>
                    {category} • {date}
                  </Text>
                </View>
                {isNewSupplier && (
                  <View style={styles.paymentNewEntityTag}>
                    <SparkleIcon size={12} color="#00D09E" />
                    <Text style={styles.paymentNewEntityText}>
                      Será adicionado aos teus fornecedores
                    </Text>
                  </View>
                )}
              </View>

              {/* Status Toggle Card: Já foi Paga vs Fica Pendente */}
              <View style={styles.paymentStatusCard}>
                <Text style={styles.paymentStatusQuestion}>Esta fatura já foi paga?</Text>
                <View style={styles.paymentStatusToggleRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.paymentStatusToggleBtn,
                      isPaid && styles.paymentStatusToggleBtnPaidActive,
                    ]}
                    onPress={() => setIsPaid(true)}
                  >
                    <CheckIcon size={16} color={isPaid ? '#00D09E' : 'rgba(255, 255, 255, 0.6)'} />
                    <Text
                      style={[
                        styles.paymentStatusToggleText,
                        isPaid && styles.paymentStatusToggleTextPaidActive,
                      ]}
                    >
                      Já foi Paga
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.paymentStatusToggleBtn,
                      !isPaid && styles.paymentStatusToggleBtnPendingActive,
                    ]}
                    onPress={() => setIsPaid(false)}
                  >
                    <ClockIcon size={16} color={!isPaid ? '#FFB800' : 'rgba(255, 255, 255, 0.6)'} />
                    <Text
                      style={[
                        styles.paymentStatusToggleText,
                        !isPaid && styles.paymentStatusToggleTextPendingActive,
                      ]}
                    >
                      Fica Pendente
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* OPÇÃO 1: JÁ FOI PAGA -> SELETOR DE MÉTODO DE PAGAMENTO */}
              {isPaid ? (
                <>
                  <View style={styles.paymentHeaderBlock}>
                    <Text style={styles.paymentPromptTitle}>
                      Qual foi o método de pagamento?
                    </Text>
                    <Text style={styles.paymentPromptDesc}>
                      Indica a forma de pagamento para registar a despesa:
                    </Text>
                  </View>

                  <View style={styles.paymentMethodsList}>
                    {PAYMENT_METHODS.map((pm) => {
                      const isSelected = paymentMethod === pm.id;
                      const IconComponent = pm.icon;
                      return (
                        <TouchableOpacity
                          key={pm.id}
                          activeOpacity={0.8}
                          style={[
                            styles.paymentMethodCard,
                            isSelected && styles.paymentMethodCardSelected,
                          ]}
                          onPress={() => setPaymentMethod(pm.id)}
                        >
                          <View
                            style={[
                              styles.paymentIconWrap,
                              isSelected && styles.paymentIconWrapSelected,
                            ]}
                          >
                            <IconComponent
                              size={22}
                              color={isSelected ? '#00D09E' : '#FFFFFF'}
                            />
                          </View>

                          <View style={styles.paymentTextWrap}>
                            <Text
                              style={[
                                styles.paymentMethodTitle,
                                isSelected && styles.paymentMethodTitleSelected,
                              ]}
                            >
                              {pm.label}
                            </Text>
                            <Text style={styles.paymentMethodDesc}>{pm.desc}</Text>
                          </View>

                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioCircleSelected,
                            ]}
                          >
                            {isSelected && <View style={styles.radioInnerDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                /* OPÇÃO 2: FICA PENDENTE -> SELETOR DE DATA LIMITE DE PAGAMENTO */
                <View style={styles.pendingDueSection}>
                  <View style={styles.paymentHeaderBlock}>
                    <Text style={styles.paymentPromptTitle}>
                      Até que dia tem de ser feito o pagamento?
                    </Text>
                    <Text style={styles.paymentPromptDesc}>
                      Define a data limite. O Vault irá avisar-te automaticamente:
                    </Text>
                  </View>

                  <View style={styles.dueDateInputWrap}>
                    <View style={styles.dueDateLabelRow}>
                      <CalendarIcon size={14} color="#00D09E" />
                      <Text style={styles.fieldLabel}>Data Limite (YYYY-MM-DD)</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.datePickerInputTrigger}
                      onPress={() => openDatePicker('dueDate')}
                    >
                      <CalendarIcon size={16} color="#00D09E" />
                      <Text style={styles.datePickerInputText}>
                        {dueDate || 'Selecionar data limite'}
                      </Text>
                      <ChevronRightIcon size={14} color="rgba(255, 255, 255, 0.4)" />
                    </TouchableOpacity>
                  </View>

                  {/* Atalhos rápidos de data limite */}
                  <View style={styles.quickDateChipsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.quickChip}
                      onPress={() => setQuickDueDate(7)}
                    >
                      <Text style={styles.quickChipText}>+7 dias</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.quickChip}
                      onPress={() => setQuickDueDate(15)}
                    >
                      <Text style={styles.quickChipText}>+15 dias</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.quickChip}
                      onPress={() => setQuickDueDate(30)}
                    >
                      <Text style={styles.quickChipText}>+30 dias</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.quickChip}
                      onPress={setEndOfMonthDueDate}
                    >
                      <Text style={styles.quickChipText}>Fim do Mês</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Banner Explicativo das Notificações Automáticas */}
                  <View style={styles.notificationNoticeBox}>
                    <View style={styles.notificationNoticeIconWrap}>
                      <SparkleIcon size={16} color="#00D09E" />
                    </View>
                    <View style={styles.notificationNoticeTextWrap}>
                      <Text style={styles.notificationNoticeTitle}>
                        Lembretes Automáticos Diários
                      </Text>
                      <Text style={styles.notificationNoticeDesc}>
                        Será notificado a partir de 2 dias antes da data limite.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Confirm & Save Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.saveButton,
                  !isPaid && styles.saveButtonPending,
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={() => handleConfirmAndSave(isPaid ? paymentMethod : undefined)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckIcon size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>
                      {isPaid
                        ? `Gravar Despesa (${paymentMethod})`
                        : 'Gravar Fatura Pendente'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Return to review */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.backToReviewButton}
                onPress={() => setStep('review')}
                disabled={isSaving}
              >
                <BackArrowIcon size={16} color="rgba(255, 255, 255, 0.7)" />
                <Text style={styles.backToReviewText}>Voltar e alterar dados da fatura</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Animated.View>

        {/* ================= DATEPICKER OVERLAY BOTTOM SHEET ================= */}
        {isDatePickerOpen && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Backdrop with Fade */}
            <TouchableWithoutFeedback onPress={closeDatePicker}>
              <Animated.View
                style={[
                  styles.pickerBackdrop,
                  { opacity: pickerFadeAnim },
                ]}
              />
            </TouchableWithoutFeedback>

            {/* Bottom Sheet Card */}
            <Animated.View
              style={[
                styles.datePickerSheet,
                { transform: [{ translateY: pickerSlideAnim }] },
              ]}
            >
              {/* Top Handle */}
              <View style={styles.sheetHandleContainer}>
                <View style={styles.sheetHandleDark} />
              </View>

              {/* Month Navigation Row */}
              <View style={styles.modalMonthNavRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.navSquareButton}
                  onPress={() => handlePickerMonthNav('prev')}
                >
                  <ChevronLeftIcon size={22} color="#111111" />
                </TouchableOpacity>

                <Text style={styles.modalMonthTitle}>
                  {MONTH_NAMES[pickerMonthIndex]}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.navSquareButton}
                  onPress={() => handlePickerMonthNav('next')}
                >
                  <ChevronRightIcon size={22} color="#111111" />
                </TouchableOpacity>
              </View>

              {/* Continuous Horizontal ScrollView of days */}
              <View style={styles.daysScrollViewWrapper}>
                <ScrollView
                  ref={pickerScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={handlePickerScroll}
                  scrollEventThrottle={32}
                  contentContainerStyle={styles.daysScrollContent}
                >
                  {pickerDays.map((item) => {
                    const selTime = pickerSelectedDate.getTime();
                    const diff = Math.round((item.time - selTime) / 86400000);
                    const isSelected = diff === 0;
                    const isFullyOpaque = isSelected || Math.abs(diff) <= 2;

                    return (
                      <TouchableOpacity
                        key={`picker-${item.key}`}
                        activeOpacity={0.75}
                        style={[
                          styles.dayColumn,
                          isSelected && styles.dayColumnActive,
                          !isFullyOpaque && styles.dayColumnDimmed,
                        ]}
                        onPress={() => {
                          setPickerSelectedDate(item.date);
                          setPickerMonthIndex(item.date.getMonth());
                        }}
                      >
                        <Text
                          style={[
                            styles.dayNameText,
                            isSelected && styles.dayNameTextActive,
                            !isFullyOpaque && styles.dayTextDimmed,
                          ]}
                        >
                          {item.dayName}
                        </Text>
                        <Text
                          style={[
                            styles.dayNumText,
                            isSelected && styles.dayNumTextActive,
                            !isFullyOpaque && styles.dayTextDimmed,
                          ]}
                        >
                          {item.dayNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Confirmar Data Button */}
              <View style={styles.pickerConfirmButtonWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.pickerConfirmButton}
                  onPress={handleConfirmPickerDate}
                >
                  <Text style={styles.pickerConfirmButtonText}>Confirmar Data</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  sheetContainer: {
    backgroundColor: '#02231E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '90%',
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleWrap: {
    gap: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#00D09E',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 19,
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    padding: 22,
    gap: 16,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.72)',
    lineHeight: 19,
  },
  optionsList: {
    gap: 12,
    marginTop: 4,
  },
  optionRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 208, 158, 0.22)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  optionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  scanningWrap: {
    padding: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIconPulse: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0, 208, 158, 0.15)',
    borderWidth: 2,
    borderColor: '#00D09E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#FFFFFF',
    marginTop: 18,
  },
  scanningDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 290,
  },
  reviewScroll: {
    paddingHorizontal: 20,
  },
  reviewContent: {
    paddingTop: 16,
    paddingBottom: 20,
    gap: 13,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  successBannerText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#00D09E',
  },
  fieldBlock: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.68)',
  },
  newBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 208, 158, 0.15)',
    borderWidth: 1,
    borderColor: '#00D09E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  newBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#00D09E',
  },
  existingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  existingBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#34D399',
  },
  newSupplierNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 84, 69, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  newSupplierNoticeText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#E0FFF6',
    lineHeight: 16,
  },
  amountInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: '#00D09E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#00D09E',
  },
  textInputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  categoryPillsScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  categoryPillSelected: {
    backgroundColor: '#005445',
    borderColor: '#00D09E',
  },
  categoryPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  categoryPillTextSelected: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  itemsBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  itemsLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
  },
  itemBullet: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#005445',
    borderWidth: 1.5,
    borderColor: '#00D09E',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  rescanButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  rescanButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#EF4444',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentScroll: {
    paddingHorizontal: 20,
  },
  paymentContent: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  paymentSummaryCard: {
    backgroundColor: 'rgba(0, 84, 69, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  paymentSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentSummaryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#00D09E',
    letterSpacing: 0.6,
  },
  paymentSummaryAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#00D09E',
  },
  paymentSummaryDetails: {
    gap: 2,
  },
  paymentSummarySupplier: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  paymentSummaryCategory: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  paymentNewEntityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  paymentNewEntityText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#00D09E',
  },
  paymentHeaderBlock: {
    gap: 4,
  },
  paymentPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  paymentPromptDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 17,
  },
  paymentMethodsList: {
    gap: 10,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  paymentMethodCardSelected: {
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
    borderColor: '#00D09E',
  },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconWrapSelected: {
    backgroundColor: 'rgba(0, 208, 158, 0.22)',
  },
  paymentTextWrap: {
    flex: 1,
    gap: 2,
  },
  paymentMethodTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  paymentMethodTitleSelected: {
    color: '#00D09E',
  },
  paymentMethodDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#00D09E',
  },
  radioInnerDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#00D09E',
  },
  backToReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  backToReviewText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  paymentStatusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  paymentStatusQuestion: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  paymentStatusToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentStatusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  paymentStatusToggleBtnPaidActive: {
    borderColor: '#00D09E',
    backgroundColor: 'rgba(0, 208, 158, 0.12)',
  },
  paymentStatusToggleBtnPendingActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
  },
  paymentStatusToggleText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  paymentStatusToggleTextPaidActive: {
    color: '#00D09E',
    fontFamily: FontFamily.bold,
  },
  paymentStatusToggleTextPendingActive: {
    color: '#FFB800',
    fontFamily: FontFamily.bold,
  },
  pendingDueSection: {
    gap: 12,
  },
  dueDateInputWrap: {
    gap: 6,
  },
  dueDateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  notificationNoticeBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 208, 158, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.25)',
    marginTop: 4,
  },
  notificationNoticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 208, 158, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationNoticeTextWrap: {
    flex: 1,
    gap: 2,
  },
  notificationNoticeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#00D09E',
  },
  notificationNoticeDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  saveButtonPending: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B',
  },

  // DatePicker Trigger & Modal Styles
  datePickerInputTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  datePickerInputText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheetHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  datePickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 9999,
  },
  sheetHandleDark: {
    width: 46,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  modalMonthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  navSquareButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMonthTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#111111',
  },
  daysScrollViewWrapper: {
    width: '100%',
    marginBottom: 24,
  },
  daysScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DAY_ITEM_WIDTH,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  dayColumnActive: {
    backgroundColor: '#1E2524',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    opacity: 1,
  },
  dayColumnDimmed: {
    opacity: 0.35,
  },
  dayNameText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayNameTextActive: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  dayNumText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#111111',
  },
  dayNumTextActive: {
    color: '#FFFFFF',
  },
  dayTextDimmed: {
    opacity: 0.6,
  },
  pickerConfirmButtonWrap: {
    width: '100%',
    paddingHorizontal: 8,
  },
  pickerConfirmButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 28,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  pickerConfirmButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
