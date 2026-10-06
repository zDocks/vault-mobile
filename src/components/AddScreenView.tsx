import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  Animated,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Easing,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { FontFamily } from '../theme/typography';
import {
  ScannerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from './Icons';
import { transactionsApi, categoriesApi, entitiesApi } from '../services/api';

interface AddScreenViewProps {
  onClose: () => void;
}

// ============================================================================
// Tambor (Wheel / Drum) Picker Component using Infinite Looping ScrollView
// ============================================================================
const DRUM_ITEM_HEIGHT = 48;
const DRUM_REPEATS = 80;

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

  // Generate repeating sequence for infinite scroll experience
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

  // Scroll to middle cycle initially on mount
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

  // When selectedValue changes externally, update scroll position smoothly
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

    const chosenOption = repeatedItems[clampedIdx].opt;
    if (chosenOption && chosenOption !== selectedValue) {
      onSelect(chosenOption);
    }

    // Infinite loop normalization: keep position within middle zone
    if (clampedIdx < 15 * options.length || clampedIdx > 65 * options.length) {
      const optIdx = clampedIdx % options.length;
      const normalizedIdx = middleCycle * options.length + optIdx;
      setCenteredGlobalIdx(normalizedIdx);
      scrollRef.current?.scrollTo({
        y: normalizedIdx * DRUM_ITEM_HEIGHT,
        animated: false,
      });
    }
  };

  return (
    <View style={styles.drumContainer}>
      {/* Left Vertical Line */}
      <View style={styles.drumVerticalLine} />

      {/* Middle ScrollView Viewport */}
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
            paddingVertical: DRUM_ITEM_HEIGHT, // exactly 1 item padding so first & last row center
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

      {/* Right Vertical Line */}
      <View style={styles.drumVerticalLine} />
    </View>
  );
};

// ============================================================================
// Main AddScreenView Component
// ============================================================================
const DAY_ITEM_WIDTH = 52;
const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

type WizardStepType =
  | 'category'
  | 'employee'
  | 'vencimento_type'
  | 'supplier'
  | 'expense_name'
  | 'payment_method'
  | 'date'
  | 'description'
  | 'paid'
  | 'recurring';

export const AddScreenView: React.FC<AddScreenViewProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();

  // Step 1: Keypad state
  const [isInWizard, setIsInWizard] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [amount, setAmount] = useState('0');
  const [transactionType, setTransactionType] = useState<'despesa' | 'receita'>('despesa');

  // Categories state
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [despesaCategories, setDespesaCategories] = useState<string[]>([]);
  const [receitaCategories, setReceitaCategories] = useState<string[]>([]);

  // Funcionário (Empregados) state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<string[]>([]);

  // Tipo de Vencimento state
  const [vencimentoTypeSearch, setVencimentoTypeSearch] = useState('');
  const [selectedVencimentoType, setSelectedVencimentoType] = useState('Ordenado');
  const [vencimentoTypes, setVencimentoTypes] = useState<string[]>([
    'Ordenado',
    'Seg. Social',
    'Subsídio de Natal',
    'Subsídio de Férias',
  ]);

  // Fornecedores state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // Nome da despesa (para Diversos e categorias customizadas)
  const [expenseName, setExpenseName] = useState('');

  // Carrega categorias e entidades da base de dados
  useEffect(() => {
    categoriesApi.getCategories('despesa').then((res) => {
      if (res && res.success && res.categories && res.categories.length > 0) {
        const names: string[] = res.categories.map((c: any) => c.name);
        setDespesaCategories(names);
        setSelectedCategory((prev) => prev || names[0]);
        setCategorySearch((prev) => prev || names[0]);
      }
    }).catch(() => { });

    categoriesApi.getCategories('receita').then((res) => {
      if (res && res.success && res.categories && res.categories.length > 0) {
        const names: string[] = res.categories.map((c: any) => c.name);
        setReceitaCategories(names);
      }
    }).catch(() => { });

    entitiesApi.getEntities('funcionario').then((res) => {
      if (res && res.success && res.entities && res.entities.length > 0) {
        const names: string[] = res.entities.map((e: any) => e.name);
        setEmployees(names);
        setSelectedEmployee(names[0]);
      }
    }).catch(() => { });

    entitiesApi.getEntities('fornecedor').then((res) => {
      if (res && res.success && res.entities && res.entities.length > 0) {
        const names: string[] = res.entities.map((e: any) => e.name);
        setSuppliers(names);
        setSelectedSupplier(names[0]);
      }
    }).catch(() => { });
  }, []);

  // Data state - padrão: hoje
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState<Date>(todayDate);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(todayDate.getMonth());

  const dateScrollRef = useRef<ScrollView>(null);

  // Faixa contínua de dias centrada no dia de hoje (-90 a +90 dias)
  const [allDays] = useState(() => {
    const days: { date: Date; dayNum: number; dayName: string; key: string }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let offset = -90; offset <= 90; offset++) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      days.push({
        date: d,
        dayNum: d.getDate(),
        dayName: WEEK_DAYS[d.getDay()],
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      });
    }
    return days;
  });

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

  // Step Descrição
  const [description, setDescription] = useState('');

  // Step Pago
  const [isPaid, setIsPaid] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<string>('Multibanco');
  const PAYMENT_OPTIONS = ['Multibanco', 'Dinheiro', 'MBWay', 'Transferência'];

  // Step Recorrente
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const [recurringInterval, setRecurringInterval] = useState<string>('Mensal');
  const RECURRING_OPTIONS = ['Diário', 'Mensal', 'Trimestral', 'Anual'];

  // Dynamic Flow determination based on category and payment status
  const getFlowForCategory = (
    cat: string,
    type: 'despesa' | 'receita',
    paid: boolean
  ): WizardStepType[] => {
    const lower = cat.toLowerCase().trim();
    const dateSteps: WizardStepType[] = paid ? ['date'] : [];

    if (type === 'despesa') {
      if (lower === 'vencimentos') {
        return [
          'category',
          'employee',
          'vencimento_type',
          'description',
          'paid',
          ...dateSteps,
          'recurring',
        ];
      }
      if (lower === 'fornecedores') {
        return [
          'category',
          'supplier',
          'description',
          'paid',
          ...dateSteps,
          'recurring',
        ];
      }
      // Diversos ou qualquer outra categoria customizada de despesa
      return [
        'category',
        'expense_name',
        'description',
        'paid',
        ...dateSteps,
        'recurring',
      ];
    }

    // Receita: Caixa vs Diversos / outra categoria customizada
    if (lower === 'caixa') {
      return [
        'category',
        'payment_method',
        'description',
        'date',
        'recurring',
      ];
    }

    // Diversos ou outra categoria criada pelo utilizador
    return [
      'category',
      'expense_name',
      'payment_method',
      'description',
      'date',
      'recurring',
    ];
  };

  const currentFlow = getFlowForCategory(selectedCategory, transactionType, isPaid);
  const currentScreen: WizardStepType = currentFlow[wizardStepIndex] || 'category';
  const isLastStep = wizardStepIndex === currentFlow.length - 1;

  // Auto-scroll to selectedDate when entering date step
  useEffect(() => {
    if (currentScreen === 'date') {
      const targetIdx = allDays.findIndex(
        (d) =>
          d.date.getFullYear() === selectedDate.getFullYear() &&
          d.date.getMonth() === selectedDate.getMonth() &&
          d.date.getDate() === selectedDate.getDate()
      );
      if (targetIdx !== -1) {
        setTimeout(() => {
          dateScrollRef.current?.scrollTo({
            x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
            animated: false,
          });
        }, 100);
      }
    }
  }, [currentScreen]);

  // When scrolling horizontally, update visible month title based on centered item
  const handleDateScroll = (e: any) => {
    const scrollX = e.nativeEvent.contentOffset.x;
    const centerIdx = Math.round((scrollX + 140) / DAY_ITEM_WIDTH);
    const clampedIdx = Math.max(0, Math.min(centerIdx, allDays.length - 1));
    const month = allDays[clampedIdx].date.getMonth();
    if (month !== currentMonthIndex) {
      setCurrentMonthIndex(month);
    }
  };

  // Month navigation arrows smoothly scroll to first day of requested month
  const handleMonthNav = (direction: 'next' | 'prev') => {
    const newMonth = (currentMonthIndex + (direction === 'next' ? 1 : -1) + 12) % 12;
    setCurrentMonthIndex(newMonth);
    const targetIdx = allDays.findIndex((d) => d.date.getMonth() === newMonth);
    if (targetIdx !== -1) {
      dateScrollRef.current?.scrollTo({
        x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
        animated: true,
      });
    }
  };

  // Generic Bottom Sheet Modal for adding new items (Category, Employee, Sub-type, Supplier)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalInputValue, setModalInputValue] = useState('');
  const [onModalSubmitCallback, setOnModalSubmitCallback] = useState<((val: string) => void) | null>(null);

  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const modalSlideAnim = useRef(new Animated.Value(400)).current;

  const openAddItemModal = (
    title: string,
    placeholder: string,
    onSubmit: (val: string) => void
  ) => {
    setModalTitle(title);
    setModalPlaceholder(placeholder);
    setModalInputValue('');
    setOnModalSubmitCallback(() => onSubmit);
    setModalVisible(true);

    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(modalSlideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeAddItemModal = (onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(modalFadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(modalSlideAnim, {
        toValue: 400,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      onComplete?.();
    });
  };

  const handleModalSubmit = () => {
    const trimmed = modalInputValue.trim();
    if (trimmed && onModalSubmitCallback) {
      onModalSubmitCallback(trimmed);
      closeAddItemModal();
    }
  };

  // Keyboard avoidance animation for floating next button
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const height = e.endCoordinates.height;
      Animated.timing(keyboardHeightAnim, {
        toValue: height,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e: any) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e?.duration || 200 : 200,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Close and reset — limpa todo o estado do wizard para começo limpo na próxima abertura
  const handleClose = () => {
    setIsInWizard(false);
    setWizardStepIndex(0);
    // Reset amount & type
    setAmount('0');
    setTransactionType('despesa');
    // Reset category
    setCategorySearch('');
    setSelectedCategory('');
    // Reset employee
    setEmployeeSearch('');
    setSelectedEmployee(employees[0] || '');
    // Reset vencimento type
    setVencimentoTypeSearch('');
    setSelectedVencimentoType(vencimentoTypes[0] || 'Ordenado');
    // Reset supplier
    setSupplierSearch('');
    setSelectedSupplier(suppliers[0] || '');
    // Reset expense name & description
    setExpenseName('');
    setDescription('');
    // Reset paid & recurring
    setIsPaid(true);
    setPaymentMethod('Multibanco');
    setIsRecurring(true);
    setRecurringInterval('Mensal');
    // Reset date to today
    const freshToday = new Date();
    freshToday.setHours(0, 0, 0, 0);
    setSelectedDate(freshToday);
    setCurrentMonthIndex(freshToday.getMonth());
    onClose();
  };

  // Navigation handlers
  const handleBack = () => {
    if (wizardStepIndex > 0) {
      setWizardStepIndex((prev) => prev - 1);
    } else {
      setIsInWizard(false);
    }
  };

  const saveTransactionToDatabase = async () => {
    try {
      const lowerCat = selectedCategory.toLowerCase();
      let entityName = '';
      if (lowerCat === 'vencimentos') {
        entityName = selectedEmployee;
      } else if (lowerCat === 'fornecedores') {
        entityName = selectedSupplier;
      } else {
        entityName = expenseName || selectedCategory;
      }

      await transactionsApi.createTransaction({
        type: transactionType,
        name: entityName,
        amount: parseFloat(amount.replace(',', '.')) || 0,
        category: selectedCategory,
        method: isPaid ? paymentMethod : undefined,
        isPaid: isPaid,
        isRecurring: isRecurring,
        paymentDate: isPaid ? selectedDate.toISOString() : new Date().toISOString(),
        description: description || undefined,
      });
    } catch (e) {
      console.log('Error creating transaction in DB:', e);
    }
  };

  const handleNext = () => {
    if (wizardStepIndex < currentFlow.length - 1) {
      setWizardStepIndex((prev) => prev + 1);
    } else {
      // Final step Concluir - Gravar no PostgreSQL
      saveTransactionToDatabase();
      handleClose();
    }
  };

  // Step 1: Numeric keypad
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

  // Filtered lists for autocompletes
  const currentCategories =
    transactionType === 'despesa' ? despesaCategories : receitaCategories;
  const filteredCategories = currentCategories.filter((item) =>
    item.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredEmployees = employees.filter((item) =>
    item.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredVencimentoTypes = vencimentoTypes.filter((item) =>
    item.toLowerCase().includes(vencimentoTypeSearch.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter((item) =>
    item.toLowerCase().includes(supplierSearch.toLowerCase())
  );

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
            paddingBottom: Math.max(insets.bottom + 6, 16),
          },
        ]}
      >
        {!isInWizard ? (
          // ================= STEP 1: AMOUNT & KEYPAD =================
          <>
            {/* Header: Left Arrow | Right Scanner */}
            <View style={styles.header}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.iconButton}
                onPress={handleClose}
              >
                <ChevronLeftIcon size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* <TouchableOpacity activeOpacity={0.8} style={styles.iconButton}>
                <ScannerIcon size={22} color="#FFFFFF" />
              </TouchableOpacity> */}
            </View>

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

            {/* Bottom: Despesa/Receita + Continuar */}
            <View style={styles.bottomSection}>
              <View style={styles.typeSelectorContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.typeButton,
                    transactionType === 'despesa'
                      ? styles.typeButtonActive
                      : styles.typeButtonInactive,
                  ]}
                  onPress={() => {
                    setTransactionType('despesa');
                    if (transactionType !== 'despesa') {
                      const first = despesaCategories[0] || '';
                      setSelectedCategory(first);
                      setCategorySearch(first);
                    }
                  }}
                >
                  <Text style={styles.typeButtonText}>Despesa</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.typeButton,
                    transactionType === 'receita'
                      ? styles.typeButtonActive
                      : styles.typeButtonInactive,
                  ]}
                  onPress={() => {
                    setTransactionType('receita');
                    if (transactionType !== 'receita') {
                      const first = receitaCategories[0] || '';
                      setSelectedCategory(first);
                      setCategorySearch(first);
                    }
                  }}
                >
                  <Text style={styles.typeButtonText}>Receita</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.continueButton}
                onPress={() => {
                  setIsInWizard(true);
                  setWizardStepIndex(0);
                }}
              >
                <Text style={styles.continueButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // ================= DYNAMIC WIZARD FLOW =================
          <View style={styles.wizardContainer}>
            {/* Header: Back Arrow | Dynamic Progress Dashes | Close X */}
            <View style={styles.stepHeader}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconButton}
                onPress={handleBack}
              >
                <ChevronLeftIcon size={26} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Progress Indicator Dashes adapting to currentFlow */}
              <View style={styles.progressContainer}>
                {currentFlow.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressSegment,
                      i <= wizardStepIndex && styles.progressSegmentActive,
                    ]}
                  />
                ))}
              </View>

              {/* Close Button X */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconButton}
                onPress={handleClose}
              >
                <CloseIcon size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* SCREEN BODY CONTENT BASED ON currentScreen */}
            <View style={styles.stepBody}>
              {/* SCREEN: CATEGORIA */}
              {currentScreen === 'category' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>
                    Categoria {transactionType === 'despesa' ? 'Despesa' : 'Receita'}
                  </Text>

                  <View style={styles.autocompleteCard}>
                    <TextInput
                      style={styles.autocompleteInput}
                      value={categorySearch}
                      onChangeText={(text) => {
                        setCategorySearch(text);
                        setSelectedCategory(text);
                      }}
                      autoFocus
                      selectionColor="#FFFFFF"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    />
                    <View style={styles.cardInputDivider} />

                    <ScrollView
                      style={styles.autocompleteList}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredCategories.map((cat, index) => {
                        const isSelected =
                          selectedCategory.toLowerCase() === cat.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={cat}
                            activeOpacity={0.7}
                            style={styles.listItem}
                            onPress={() => {
                              setSelectedCategory(cat);
                              setCategorySearch(cat);
                            }}
                          >
                            <Text
                              style={[
                                styles.listItemText,
                                isSelected && styles.listItemTextSelected,
                              ]}
                            >
                              {cat}
                            </Text>
                            {index < filteredCategories.length - 1 && (
                              <View style={styles.itemDivider} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.newActionWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.newActionButton}
                      onPress={() =>
                        openAddItemModal(
                          `Nova Categoria ${transactionType === 'despesa' ? 'de Despesa' : 'de Receita'
                          }`,
                          'Nome da categoria',
                          (newVal) => {
                            if (transactionType === 'despesa') {
                              if (!despesaCategories.includes(newVal)) {
                                setDespesaCategories((p) => [...p, newVal]);
                              }
                            } else {
                              if (!receitaCategories.includes(newVal)) {
                                setReceitaCategories((p) => [...p, newVal]);
                              }
                            }
                            setSelectedCategory(newVal);
                            setCategorySearch(newVal);
                          }
                        )
                      }
                    >
                      <Text style={styles.newActionText}>+ nova categoria</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCREEN: FUNCIONÁRIO (EMPREGADO) */}
              {currentScreen === 'employee' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Funcionário</Text>

                  <View style={styles.autocompleteCard}>
                    <TextInput
                      style={styles.autocompleteInput}
                      value={employeeSearch}
                      onChangeText={(text) => {
                        setEmployeeSearch(text);
                        setSelectedEmployee(text);
                      }}
                      autoFocus
                      selectionColor="#FFFFFF"
                      placeholder="Pesquisar funcionário"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    />
                    <View style={styles.cardInputDivider} />

                    <ScrollView
                      style={styles.autocompleteList}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredEmployees.map((emp, index) => {
                        const isSelected =
                          selectedEmployee.toLowerCase() === emp.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={emp}
                            activeOpacity={0.7}
                            style={styles.listItem}
                            onPress={() => {
                              setSelectedEmployee(emp);
                              setEmployeeSearch(emp);
                            }}
                          >
                            <Text
                              style={[
                                styles.listItemText,
                                isSelected && styles.listItemTextSelected,
                              ]}
                            >
                              {emp}
                            </Text>
                            {index < filteredEmployees.length - 1 && (
                              <View style={styles.itemDivider} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.newActionWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.newActionButton}
                      onPress={() =>
                        openAddItemModal(
                          'Novo Funcionário',
                          'Nome do funcionário',
                          (newVal) => {
                            if (!employees.includes(newVal)) {
                              setEmployees((p) => [...p, newVal]);
                            }
                            setSelectedEmployee(newVal);
                            setEmployeeSearch(newVal);
                          }
                        )
                      }
                    >
                      <Text style={styles.newActionText}>+ novo funcionário</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCREEN: TIPO DE VENCIMENTO */}
              {currentScreen === 'vencimento_type' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Tipo de Vencimento</Text>

                  <View style={styles.autocompleteCard}>
                    <TextInput
                      style={styles.autocompleteInput}
                      value={vencimentoTypeSearch}
                      onChangeText={(text) => {
                        setVencimentoTypeSearch(text);
                        setSelectedVencimentoType(text);
                      }}
                      autoFocus
                      selectionColor="#FFFFFF"
                      placeholder="Pesquisar tipo"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    />
                    <View style={styles.cardInputDivider} />

                    <ScrollView
                      style={styles.autocompleteList}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredVencimentoTypes.map((t, index) => {
                        const isSelected =
                          selectedVencimentoType.toLowerCase() === t.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={t}
                            activeOpacity={0.7}
                            style={styles.listItem}
                            onPress={() => {
                              setSelectedVencimentoType(t);
                              setVencimentoTypeSearch(t);
                            }}
                          >
                            <Text
                              style={[
                                styles.listItemText,
                                isSelected && styles.listItemTextSelected,
                              ]}
                            >
                              {t}
                            </Text>
                            {index < filteredVencimentoTypes.length - 1 && (
                              <View style={styles.itemDivider} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.newActionWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.newActionButton}
                      onPress={() =>
                        openAddItemModal(
                          'Novo Tipo de Vencimento',
                          'Ex: Subsídio de Refeição',
                          (newVal) => {
                            if (!vencimentoTypes.includes(newVal)) {
                              setVencimentoTypes((p) => [...p, newVal]);
                            }
                            setSelectedVencimentoType(newVal);
                            setVencimentoTypeSearch(newVal);
                          }
                        )
                      }
                    >
                      <Text style={styles.newActionText}>+ nova categoria</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCREEN: FORNECEDOR */}
              {currentScreen === 'supplier' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Fornecedor</Text>

                  <View style={styles.autocompleteCard}>
                    <TextInput
                      style={styles.autocompleteInput}
                      value={supplierSearch}
                      onChangeText={(text) => {
                        setSupplierSearch(text);
                        setSelectedSupplier(text);
                      }}
                      autoFocus
                      selectionColor="#FFFFFF"
                      placeholder="Pesquisar fornecedor"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    />
                    <View style={styles.cardInputDivider} />

                    <ScrollView
                      style={styles.autocompleteList}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredSuppliers.map((supp, index) => {
                        const isSelected =
                          selectedSupplier.toLowerCase() === supp.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={supp}
                            activeOpacity={0.7}
                            style={styles.listItem}
                            onPress={() => {
                              setSelectedSupplier(supp);
                              setSupplierSearch(supp);
                            }}
                          >
                            <Text
                              style={[
                                styles.listItemText,
                                isSelected && styles.listItemTextSelected,
                              ]}
                            >
                              {supp}
                            </Text>
                            {index < filteredSuppliers.length - 1 && (
                              <View style={styles.itemDivider} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.newActionWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.newActionButton}
                      onPress={() =>
                        openAddItemModal(
                          'Novo Fornecedor',
                          'Nome do fornecedor',
                          (newVal) => {
                            if (!suppliers.includes(newVal)) {
                              setSuppliers((p) => [...p, newVal]);
                            }
                            setSelectedSupplier(newVal);
                            setSupplierSearch(newVal);
                          }
                        )
                      }
                    >
                      <Text style={styles.newActionText}>+ novo fornecedor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SCREEN: NOME DA DESPESA / RECEITA (Para Diversos e outras) */}
              {currentScreen === 'expense_name' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>
                    {transactionType === 'despesa' ? 'Nome da despesa' : 'Nome da receita'}
                  </Text>

                  <View style={styles.descriptionInputCard}>
                    <TextInput
                      style={styles.descriptionInput}
                      value={expenseName}
                      onChangeText={setExpenseName}
                      placeholder={
                        transactionType === 'despesa' ? 'Nome da despesa' : 'Nome da receita'
                      }
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      autoFocus
                      selectionColor="#FFFFFF"
                    />
                  </View>
                </View>
              )}

              {/* SCREEN: MÉTODO DE RECEBIMENTO (Para Receita) */}
              {currentScreen === 'payment_method' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Método de pagamento</Text>

                  <View style={[styles.tamborWrapper, { marginTop: 40 }]}>
                    <DrumWheelPicker
                      options={PAYMENT_OPTIONS}
                      selectedValue={paymentMethod}
                      onSelect={setPaymentMethod}
                    />
                  </View>
                </View>
              )}

              {/* SCREEN: DATA */}
              {currentScreen === 'date' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Data</Text>

                  {/* Month Navigation */}
                  <View style={styles.monthNavRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.monthNavButton}
                      onPress={() => handleMonthNav('prev')}
                    >
                      <ChevronLeftIcon size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <Text style={styles.monthTitleText}>
                      {MONTH_NAMES[currentMonthIndex]}
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.monthNavButton}
                      onPress={() => handleMonthNav('next')}
                    >
                      <ChevronRightIcon size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Continuous Horizontal ScrollView of days */}
                  <View style={styles.daysScrollViewWrapper}>
                    <ScrollView
                      ref={dateScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      onScroll={handleDateScroll}
                      scrollEventThrottle={32}
                      contentContainerStyle={styles.daysScrollContent}
                    >
                      {allDays.map((item) => {
                        const dCopy = new Date(
                          item.date.getFullYear(),
                          item.date.getMonth(),
                          item.date.getDate()
                        );
                        const selCopy = new Date(
                          selectedDate.getFullYear(),
                          selectedDate.getMonth(),
                          selectedDate.getDate()
                        );
                        const diff = Math.round(
                          (dCopy.getTime() - selCopy.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const isSelected = diff === 0;
                        const isFullyOpaque = isSelected || diff === -1 || diff === -2;

                        return (
                          <TouchableOpacity
                            key={item.key}
                            activeOpacity={0.75}
                            style={[
                              styles.dayColumn,
                              isSelected && styles.dayColumnActive,
                              !isFullyOpaque && styles.dayColumnDimmed,
                            ]}
                            onPress={() => {
                              setSelectedDate(item.date);
                              setCurrentMonthIndex(item.date.getMonth());
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
                </View>
              )}

              {/* SCREEN: DESCRIÇÃO */}
              {currentScreen === 'description' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Descricao</Text>
                  <Text style={styles.screenSubtitle}>opcional</Text>

                  <View style={styles.descriptionInputCard}>
                    <TextInput
                      style={styles.descriptionInput}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Outubro"
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      autoFocus
                      selectionColor="#FFFFFF"
                    />
                  </View>
                </View>
              )}

              {/* SCREEN: PAGO */}
              {currentScreen === 'paid' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Pago</Text>

                  {/* Sim / Nao Toggle Buttons */}
                  <View style={styles.yesNoRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.yesNoButton,
                        isPaid ? styles.yesNoButtonActive : styles.yesNoButtonInactive,
                      ]}
                      onPress={() => setIsPaid(true)}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          isPaid ? styles.yesNoTextActive : styles.yesNoTextInactive,
                        ]}
                      >
                        Sim
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.yesNoButton,
                        !isPaid ? styles.yesNoButtonActive : styles.yesNoButtonInactive,
                      ]}
                      onPress={() => setIsPaid(false)}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          !isPaid ? styles.yesNoTextActive : styles.yesNoTextInactive,
                        ]}
                      >
                        Nao
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tambor Wheel Picker via Snapping Native ScrollView */}
                  {isPaid && (
                    <View style={styles.tamborWrapper}>
                      <DrumWheelPicker
                        options={PAYMENT_OPTIONS}
                        selectedValue={paymentMethod}
                        onSelect={setPaymentMethod}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* SCREEN: RECORRENTE */}
              {currentScreen === 'recurring' && (
                <View style={styles.stepContentCentered}>
                  <Text style={styles.screenTitleCentered}>Recorrente</Text>

                  {/* Sim / Nao Toggle Buttons */}
                  <View style={styles.yesNoRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.yesNoButton,
                        isRecurring
                          ? styles.yesNoButtonActive
                          : styles.yesNoButtonInactive,
                      ]}
                      onPress={() => setIsRecurring(true)}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          isRecurring ? styles.yesNoTextActive : styles.yesNoTextInactive,
                        ]}
                      >
                        Sim
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.yesNoButton,
                        !isRecurring
                          ? styles.yesNoButtonActive
                          : styles.yesNoButtonInactive,
                      ]}
                      onPress={() => setIsRecurring(false)}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          !isRecurring
                            ? styles.yesNoTextActive
                            : styles.yesNoTextInactive,
                        ]}
                      >
                        Nao
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tambor Wheel Picker via Snapping Native ScrollView */}
                  {isRecurring && (
                    <View style={styles.tamborWrapper}>
                      <DrumWheelPicker
                        options={RECURRING_OPTIONS}
                        selectedValue={recurringInterval}
                        onSelect={setRecurringInterval}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* BOTTOM ACTION BUTTONS */}
            {!isLastStep ? (
              // Floating Next Button (all steps before last) at bottom right
              <Animated.View
                style={[
                  styles.floatingNextContainer,
                  {
                    marginBottom: keyboardHeightAnim,
                    paddingBottom: Math.max(insets.bottom + 8, 16),
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.nextCircleButton}
                  onPress={handleNext}
                >
                  <ChevronRightIcon size={24} color="#222222" />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              // Last Step: Concluir Action Pill Button at bottom
              <View
                style={[
                  styles.finishButtonContainer,
                  { paddingBottom: Math.max(insets.bottom + 12, 20) },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.finishButton}
                  onPress={handleNext}
                >
                  <Text style={styles.finishButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Reusable Bottom Sheet Modal for Adding Items */}
      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeAddItemModal()}
      >
        {/* Backdrop tap-to-dismiss (absolute, covers full screen) */}
        <TouchableWithoutFeedback onPress={() => closeAddItemModal()}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: modalFadeAnim },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* KeyboardAvoidingView lifts the sheet above the keyboard */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalSheet,
                {
                  paddingBottom: Math.max(insets.bottom + 16, 26),
                  transform: [{ translateY: modalSlideAnim }],
                },
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.modalHandle} />

              {/* Modal Title */}
              <Text style={styles.modalTitle}>{modalTitle}</Text>

              {/* Input Field */}
              <View style={styles.modalInputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  value={modalInputValue}
                  onChangeText={setModalInputValue}
                  placeholder={modalPlaceholder}
                  placeholderTextColor="#8E8E93"
                  autoFocus
                  selectionColor="#00A68C"
                  returnKeyType="done"
                  onSubmitEditing={handleModalSubmit}
                />
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modalSubmitButton,
                  !modalInputValue.trim() && styles.modalSubmitButtonDisabled,
                ]}
                disabled={!modalInputValue.trim()}
                onPress={handleModalSubmit}
              >
                <Text style={styles.modalSubmitButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Header (Step 1)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    width: '100%',
    paddingBottom: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Amount & Keypad
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  amountText: {
    fontFamily: FontFamily.bold,
    fontSize: 62,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  keypadContainer: {
    paddingHorizontal: 6,
    width: '100%',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 17,
  },
  keypadButton: {
    width: 90,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 40,
    color: '#FFFFFF',
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  bottomSection: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 12,
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  typeButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderWidth: 1.5,
    borderColor: '#00D09E',
    backgroundColor: 'rgba(0, 166, 140, 0.25)',
  },
  typeButtonInactive: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0, 75, 63, 0.55)',
  },
  typeButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 30,
    height: 65,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },

  // ================= Wizard Flow (Steps 2 to 8) =================
  wizardContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    width: '100%',
    height: 48,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  progressSegment: {
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressSegmentActive: {
    backgroundColor: '#FFFFFF',
    height: 3,
  },

  stepBody: {
    flex: 1,
    width: '100%',
  },
  stepContent: {
    width: '100%',
    paddingTop: 16,
  },
  stepContentCentered: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 74,
  },

  // Titles
  screenTitle: {
    fontFamily: FontFamily.regular,
    fontSize: 34,
    color: '#FFFFFF',
    paddingHorizontal: 22,
    marginTop: 20,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  screenTitleCentered: {
    fontFamily: FontFamily.light,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    marginTop: 4,
  },

  // Autocomplete Card
  autocompleteCard: {
    backgroundColor: 'rgba(0, 56, 47, 0.88)',
    borderRadius: 20,
    marginHorizontal: 22,
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  autocompleteInput: {
    fontFamily: FontFamily.regular,
    fontSize: 19,
    color: '#FFFFFF',
    paddingVertical: 4,
    height: 36,
  },
  cardInputDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 6,
    marginBottom: 4,
  },
  autocompleteList: {
    maxHeight: 160,
  },
  listItem: {
    paddingVertical: 12,
  },
  listItemText: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    color: '#FFFFFF',
  },
  listItemTextSelected: {
    fontFamily: FontFamily.semiBold,
    color: '#5FE3B3',
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 12,
  },
  newActionWrapper: {
    alignItems: 'center',
    marginTop: 14,
  },
  newActionButton: {
    backgroundColor: 'rgba(0, 166, 140, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  newActionText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#E0F4F0',
  },

  // Step 5: Data Picker Styles with Horizontal ScrollView
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 50,
    marginTop: 58,
    marginBottom: 18,
  },
  monthNavButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 60, 50, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 27,
    color: '#FFFFFF',
    minWidth: 160,
    textAlign: 'center',
  },
  daysScrollViewWrapper: {
    width: '100%',
    marginTop: 6,
  },
  daysScrollContent: {
    paddingHorizontal: 38,
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: DAY_ITEM_WIDTH,
  },
  dayColumnActive: {
    backgroundColor: '#1E2524',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    opacity: 1,
  },
  dayColumnDimmed: {
    opacity: 0.4,
  },
  dayNameText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayNameTextActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  dayNumText: {
    fontFamily: FontFamily.bold,
    fontSize: 21,
    color: '#FFFFFF',
  },
  dayNumTextActive: {
    color: '#FFFFFF',
  },
  dayTextDimmed: {
    opacity: 0.7,
  },

  // Step 6: Descrição Input Card
  descriptionInputCard: {
    backgroundColor: 'rgba(0, 60, 50, 0.55)',
    borderRadius: 16,
    width: '90%',
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 36,
  },
  descriptionInput: {
    fontFamily: FontFamily.regular,
    fontSize: 19,
    color: '#FFFFFF',
  },

  // Step 7 & 8: Sim / Nao Row
  yesNoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 36,
    marginBottom: 34,
  },
  yesNoButton: {
    width: 122,
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
    fontSize: 17,
  },
  yesNoTextActive: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  yesNoTextInactive: {
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // Tambor (Wheel Picker) with Native Snapping ScrollView
  tamborWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  drumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    height: DRUM_ITEM_HEIGHT * 3, // 144px
  },
  drumVerticalLine: {
    width: 2,
    height: DRUM_ITEM_HEIGHT * 3,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  drumViewport: {
    height: DRUM_ITEM_HEIGHT * 3,
    width: 200,
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
    textAlign: 'center',
  },
  drumTextSide: {
    fontFamily: FontFamily.regular,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.28)',
  },
  drumTextCenter: {
    fontFamily: FontFamily.regular,
    fontSize: 30,
    color: '#FFFFFF',
  },

  // Floating Next Button (Bottom Right)
  floatingNextContainer: {
    position: 'absolute',
    bottom: 0,
    right: 22,
    zIndex: 10,
  },
  nextCircleButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E4DFDC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },

  // Step 8: Finish Action Pill Button
  finishButtonContainer: {
    width: '100%',
    paddingHorizontal: 22,
  },
  finishButton: {
    backgroundColor: '#EDE8DF',
    borderRadius: 32,
    height: 62,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  finishButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#1C1C1E',
  },

  // Reusable Bottom Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C5C0BC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 20,
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  modalInputWrapper: {
    backgroundColor: '#F3EFEA',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    justifyContent: 'center',
    marginHorizontal: 22,
    borderWidth: 1,
    borderColor: '#E2DDD8',
  },
  modalInput: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: '#1C1C1E',
  },
  modalSubmitButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    height: 54,
    marginHorizontal: 22,
    marginTop: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    opacity: 0.4,
  },
  modalSubmitButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
