import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SectionList,
  ActivityIndicator,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import {
  CalendarIcon,
  SearchIcon,
  FilterGridIcon,
  BackArrowIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  CloseIcon,
  TrashIcon,
  EditIcon,
} from './Icons';
import { transactionsApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import { cancelInvoiceReminders } from '../services/notifications';

export interface ExpenseItem {
  id: string;
  name: string;
  method: string;
  amount: string;
  rawAmount?: number;
  type?: 'despesa' | 'receita';
  isPaid?: boolean;
  category: string;
  date: string;
  rawDate: Date;
  dueDate?: string;
  description?: string;
  avatarChar: string;
}

interface ExpensesScreenViewProps {
  type?: 'despesa' | 'receita' | 'pendentes';
  title?: string;
  onOpenAddScreen?: () => void;
  initialSelectedId?: string | null;
}

// ============================================================================
// Tambor (Wheel / Drum) Picker Light Mode Component (For White Confirmation Modal)
// ============================================================================
const DRUM_LIGHT_ITEM_HEIGHT = 46;
const DRUM_LIGHT_REPEATS = 40;

interface DrumWheelPickerLightProps {
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

const DrumWheelPickerLight: React.FC<DrumWheelPickerLightProps> = ({
  options,
  selectedValue,
  onSelect,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const isMounted = useRef(false);
  const isUserInteracting = useRef(false);

  const repeatedItems = useRef(
    Array.from({ length: DRUM_LIGHT_REPEATS }).flatMap((_, cycle) =>
      options.map((opt, optIdx) => ({
        opt,
        key: `drum-light-${cycle}-${optIdx}`,
        optIndex: optIdx,
      }))
    )
  ).current;

  const currentOptionIdx = Math.max(0, options.indexOf(selectedValue));
  const middleCycle = Math.floor(DRUM_LIGHT_REPEATS / 2);
  const [centeredGlobalIdx, setCenteredGlobalIdx] = useState(
    middleCycle * options.length + currentOptionIdx
  );

  useEffect(() => {
    const targetIdx = middleCycle * options.length + currentOptionIdx;
    setCenteredGlobalIdx(targetIdx);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: targetIdx * DRUM_LIGHT_ITEM_HEIGHT,
        animated: false,
      });
      isMounted.current = true;
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const handleScroll = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(offsetY / DRUM_LIGHT_ITEM_HEIGHT);
    if (rawIdx !== centeredGlobalIdx && rawIdx >= 0 && rawIdx < repeatedItems.length) {
      setCenteredGlobalIdx(rawIdx);
    }
  };

  const handleScrollEnd = (e: any) => {
    isUserInteracting.current = false;
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(offsetY / DRUM_LIGHT_ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(rawIdx, repeatedItems.length - 1));
    setCenteredGlobalIdx(clampedIdx);

    const chosenOption = repeatedItems[clampedIdx]?.opt;
    if (chosenOption && chosenOption !== selectedValue) {
      onSelect(chosenOption);
    }
  };

  return (
    <View style={styles.drumLightContainer}>
      <View style={styles.drumLightVerticalLine} />
      <View style={styles.drumLightViewport}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={DRUM_LIGHT_ITEM_HEIGHT}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isUserInteracting.current = true;
          }}
          onMomentumScrollEnd={handleScrollEnd}
          contentContainerStyle={{
            paddingVertical: DRUM_LIGHT_ITEM_HEIGHT,
          }}
          style={styles.drumLightScrollView}
        >
          {repeatedItems.map((item, index) => {
            const isCenter = index === centeredGlobalIdx;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => {
                  setCenteredGlobalIdx(index);
                  scrollRef.current?.scrollTo({
                    y: index * DRUM_LIGHT_ITEM_HEIGHT,
                    animated: true,
                  });
                  onSelect(item.opt);
                }}
                style={styles.drumLightItem}
              >
                <Text
                  style={[
                    styles.drumLightText,
                    isCenter ? styles.drumLightTextCenter : styles.drumLightTextSide,
                  ]}
                >
                  {item.opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.drumLightVerticalLine} />
    </View>
  );
};

// ============================================================================
// SwipeToConfirm Component ("Deslize para confirmar pagamento")
// ============================================================================
const SWIPE_THUMB_SIZE = 54;

const SwipeToConfirm: React.FC<{ onConfirm: () => void }> = ({ onConfirm }) => {
  const screenWidth = Dimensions.get('window').width;
  const initialTrackWidth = Math.max(200, screenWidth - 44);
  const [trackWidth, setTrackWidth] = useState(initialTrackWidth);

  const panX = useRef(new Animated.Value(0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;
  const auraOpacity = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const isTriggered = useRef(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // maxDrag mantido numa Ref para o PanResponder SEMPRE aceder ao valor atual (nunca fica preso a 1)
  const maxDragRef = useRef(Math.max(50, initialTrackWidth - SWIPE_THUMB_SIZE - 12));

  useEffect(() => {
    maxDragRef.current = Math.max(50, trackWidth - SWIPE_THUMB_SIZE - 12);
  }, [trackWidth]);

  // Animação contínua em onda dos chevrons › › › que indicam a direção
  useEffect(() => {
    const wave = Animated.loop(
      Animated.timing(chevronAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    wave.start();
    return () => wave.stop();
  }, []);

  // Animação inicial de convite (hint) fazendo a bola deslizar brevemente e voltar
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(panX, {
          toValue: 28,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }),
      ]).start();
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 1,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dx) > 1,
      onPanResponderGrant: () => {
        isTriggered.current = false;
        Animated.parallel([
          Animated.spring(thumbScale, {
            toValue: 1.12,
            friction: 5,
            tension: 80,
            useNativeDriver: false,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.55,
            duration: 140,
            useNativeDriver: false,
          }),
        ]).start();
      },
      onPanResponderMove: (_, gestureState) => {
        const currentMax = maxDragRef.current;
        if (gestureState.dx >= 0) {
          const clamped = Math.min(gestureState.dx, currentMax);
          panX.setValue(clamped);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentMax = maxDragRef.current;
        // Exige deslizar até ao final (pelo menos 85% do percurso)
        const hasReachedEnd = gestureState.dx >= currentMax * 0.85;

        if (hasReachedEnd && !isTriggered.current) {
          isTriggered.current = true;
          setIsConfirmed(true);

          // Dispara a abertura do modal IMEDIATAMENTE (instantâneo, sem espera)
          onConfirm();

          // Encaixe rápido e visual no final
          Animated.parallel([
            Animated.timing(panX, {
              toValue: currentMax,
              duration: 70,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
            Animated.timing(auraOpacity, {
              toValue: 0,
              duration: 80,
              useNativeDriver: false,
            }),
          ]).start(() => {
            // Reposiciona para quando o modal fechar
            setTimeout(() => {
              panX.setValue(0);
              thumbScale.setValue(1);
              isTriggered.current = false;
              setIsConfirmed(false);
            }, 350);
          });
        } else {
          // Volta com animação de mola elástica para o início se soltar antes
          Animated.parallel([
            Animated.spring(panX, {
              toValue: 0,
              friction: 7,
              tension: 45,
              useNativeDriver: false,
            }),
            Animated.spring(thumbScale, {
              toValue: 1.0,
              friction: 6,
              tension: 50,
              useNativeDriver: false,
            }),
            Animated.timing(auraOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const currentMaxDrag = Math.max(50, trackWidth - SWIPE_THUMB_SIZE - 12);

  // Interpolações visuais dinâmicas enquanto desliza
  const textOpacity = panX.interpolate({
    inputRange: [0, Math.max(1, currentMaxDrag * 0.45)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const textTranslateX = panX.interpolate({
    inputRange: [0, currentMaxDrag],
    outputRange: [0, 20],
    extrapolate: 'clamp',
  });

  const fillWidth = panX.interpolate({
    inputRange: [0, currentMaxDrag],
    outputRange: [SWIPE_THUMB_SIZE + 12, trackWidth],
    extrapolate: 'clamp',
  });

  const auraScale = panX.interpolate({
    inputRange: [0, currentMaxDrag],
    outputRange: [1.0, 1.45],
    extrapolate: 'clamp',
  });

  const thumbRotate = panX.interpolate({
    inputRange: [0, currentMaxDrag],
    outputRange: ['0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const arrowTranslateX = panX.interpolate({
    inputRange: [0, currentMaxDrag],
    outputRange: [0, 4],
    extrapolate: 'clamp',
  });

  const chevronOp1 = chevronAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.25, 0.9, 0.25, 0.25, 0.25],
  });
  const chevronOp2 = chevronAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.25, 0.25, 0.9, 0.25, 0.25],
  });
  const chevronOp3 = chevronAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.25, 0.25, 0.25, 0.9, 0.25],
  });

  return (
    <View
      style={styles.swipeTrack}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - trackWidth) > 1) {
          setTrackWidth(w);
          maxDragRef.current = Math.max(50, w - SWIPE_THUMB_SIZE - 12);
        }
      }}
      {...panResponder.panHandlers}
    >
      {/* Rasto de preenchimento dinâmico com gradiente seguindo a bola */}
      <Animated.View style={[styles.swipeFill, { width: fillWidth }]}>
        <LinearGradient
          colors={['#00E5AE', '#00A887']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.swipeFillShine} />
      </Animated.View>

      {/* Texto com chevrons em onda animada que desvanecem durante o deslize */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeTextContainer,
          {
            opacity: textOpacity,
            transform: [{ translateX: textTranslateX }],
          },
        ]}
      >
        <Text style={styles.swipeText}>Deslize para confirmar pagamento</Text>
        <View style={styles.swipeArrowsRow}>
          <Animated.View style={{ opacity: chevronOp1 }}>
            <ChevronRightIcon size={13} color="#8E8E93" />
          </Animated.View>
          <Animated.View style={{ opacity: chevronOp2, marginLeft: -3 }}>
            <ChevronRightIcon size={13} color="#8E8E93" />
          </Animated.View>
          <Animated.View style={{ opacity: chevronOp3, marginLeft: -3 }}>
            <ChevronRightIcon size={13} color="#8E8E93" />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Bola que desliza com aura e resposta tátil */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeThumbWrapper,
          {
            transform: [
              { translateX: panX },
              { scale: thumbScale },
            ],
          },
        ]}
      >
        {/* Aura brilhante que expande enquanto o utilizador desliza */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.swipeAura,
            {
              opacity: auraOpacity,
              transform: [{ scale: auraScale }],
            },
          ]}
        />

        {/* Bola principal com rotação dinâmica e transição de ícone */}
        <Animated.View
          style={[
            styles.swipeThumb,
            {
              transform: [{ rotate: thumbRotate }],
              backgroundColor: isConfirmed ? '#00D09E' : '#00A887',
            },
          ]}
        >
          {isConfirmed ? (
            <CheckIcon size={26} color="#FFFFFF" />
          ) : (
            <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
              <ChevronRightIcon size={25} color="#FFFFFF" />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};


const INITIAL_EXPENSES: ExpenseItem[] = [
  // Hoje
  {
    id: 'exp-1',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '-10.40€',
    category: 'Vencimentos',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Adiantamento',
    avatarChar: 'Z',
  },
  {
    id: 'exp-2',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '-400.40€',
    category: 'Compras',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'exp-3',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '-21.90€',
    category: 'Alimentação',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Almoço de equipa',
    avatarChar: 'M',
  },
  {
    id: 'exp-4',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '-10.40€',
    category: 'Diversos',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Subscrição',
    avatarChar: 'S',
  },
  // 1 Out 2026
  {
    id: 'exp-5',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '-10.40€',
    category: 'Vencimentos',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Serviço pontual',
    avatarChar: 'Z',
  },
  {
    id: 'exp-6',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '-400.40€',
    category: 'Compras',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'exp-7',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '-21.90€',
    category: 'Alimentação',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Jantar',
    avatarChar: 'M',
  },
  {
    id: 'exp-8',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '-10.40€',
    category: 'Diversos',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Jogo software',
    avatarChar: 'S',
  },
];

const INITIAL_RECEITAS: ExpenseItem[] = [
  // Hoje
  {
    id: 'rec-1',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '+10.40€',
    category: 'Caixa',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Pagamento cliente',
    avatarChar: 'Z',
  },
  {
    id: 'rec-2',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '+400.40€',
    category: 'Vendas',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'rec-3',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '+21.90€',
    category: 'Serviços',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Faturação diária',
    avatarChar: 'M',
  },
  {
    id: 'rec-4',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '+10.40€',
    category: 'Diversos',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Reembolso',
    avatarChar: 'S',
  },
  // 1 Out 2026
  {
    id: 'rec-5',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '+10.40€',
    category: 'Caixa',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Recebimento',
    avatarChar: 'Z',
  },
  {
    id: 'rec-6',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '+400.40€',
    category: 'Vendas',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'rec-7',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '+21.90€',
    category: 'Serviços',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Faturação diária',
    avatarChar: 'M',
  },
  {
    id: 'rec-8',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '+10.40€',
    category: 'Diversos',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Reembolso',
    avatarChar: 'S',
  },
];

const INITIAL_PENDENTES: ExpenseItem[] = [
  // Hoje
  {
    id: 'pend-1',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '10.40€',
    category: 'Vencimentos',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Adiantamento pendente',
    avatarChar: 'Z',
  },
  {
    id: 'pend-2',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '400.40€',
    category: 'Compras',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'pend-3',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '21.90€',
    category: 'Alimentação',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Almoço equipa',
    avatarChar: 'M',
  },
  {
    id: 'pend-4',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '10.40€',
    category: 'Diversos',
    date: '02/10/2026',
    rawDate: new Date(2026, 9, 2),
    description: 'Subscrição software',
    avatarChar: 'S',
  },
  // 1 Out 2026
  {
    id: 'pend-5',
    name: 'zDocks',
    method: 'Dinheiro',
    amount: '10.40€',
    category: 'Vencimentos',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Serviço pontual',
    avatarChar: 'Z',
  },
  {
    id: 'pend-6',
    name: 'Recheio',
    method: 'Multibanco',
    amount: '400.40€',
    category: 'Compras',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Descricao',
    avatarChar: 'R',
  },
  {
    id: 'pend-7',
    name: 'MC Donalds',
    method: 'MBWay',
    amount: '21.90€',
    category: 'Alimentação',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Jantar equipa',
    avatarChar: 'M',
  },
  {
    id: 'pend-8',
    name: 'STEAM',
    method: 'Pagamento Online',
    amount: '10.40€',
    category: 'Diversos',
    date: '01/10/2026',
    rawDate: new Date(2026, 9, 1),
    description: 'Jogo software',
    avatarChar: 'S',
  },
];

const QUICK_FILTERS = ['Lorem', 'Lorem', 'Lorem', 'Lorem'];

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

const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const DAY_ITEM_WIDTH = 52;

export const ExpensesScreenView: React.FC<ExpensesScreenViewProps> = ({
  type = 'despesa',
  title,
  onOpenAddScreen,
  initialSelectedId,
}) => {
  const insets = useSafeAreaInsets();
  const displayTitle =
    title ||
    (type === 'despesa'
      ? 'Despesas'
      : type === 'receita'
        ? 'Receitas'
        : 'Pendentes');

  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 80;

  const loadTransactionsFromApi = async (offset = 0, isAppend = false) => {
    try {
      if (offset === 0) setIsLoading(true);
      else setIsLoadingMore(true);

      const res = await transactionsApi.getTransactions({
        type: type,
        limit: PAGE_SIZE,
        offset: offset,
      });

      if (res && res.success) {
        const mapped: ExpenseItem[] = (res.items || []).map((t) => {
          const d = t.rawDate ? new Date(t.rawDate) : new Date();
          return {
            id: t.id,
            name: t.name,
            method: t.method || (t.isPaid ? 'Concluído' : 'Pendente'),
            amount: type === 'pendentes'
              ? formatCurrency(t.amount, { removeSign: true })
              : formatCurrency(t.amount, { keepSign: true }),
            rawAmount: t.rawAmount || Math.abs(parseFloat(String(t.amount).replace(/[^0-9.-]+/g, '')) || 0),
            type: t.type,
            isPaid: t.isPaid,
            category: t.category || 'Geral',
            date: t.date,
            rawDate: d,
            dueDate: t.dueDate || undefined,
            description: t.description || '',
            avatarChar: t.avatarChar || (t.name[0] || 'V').toUpperCase(),
          };
        });

        if (isAppend) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((x) => x.id));
            const fresh = mapped.filter((x) => !existingIds.has(x.id));
            return [...prev, ...fresh];
          });
        } else {
          setItems(mapped);
        }
        setHasMore((res.items || []).length === PAGE_SIZE);
      } else {
        if (!isAppend) setItems([]);
        setHasMore(false);
      }
    } catch (err) {
      if (!isAppend) setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadTransactionsFromApi(0, false);
  }, [type]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  // Estados e Handlers para Edição e Eliminação de Transações
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editMethod, setEditMethod] = useState('Multibanco');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editError, setEditError] = useState<string | null>(null);

  const QUICK_CATEGORIES = [
    'Alimentação',
    'Compras',
    'Vencimentos',
    'Transportes',
    'Serviços',
    'Caixa',
    'Vendas',
    'Diversos',
  ];

  const PAYMENT_METHODS = ['Multibanco', 'Dinheiro', 'MBWay', 'Transferência'];

  const formatDateDisplay = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleOpenEditModal = () => {
    if (!selectedExpense) return;
    setEditName(selectedExpense.name);
    const cleanNum =
      selectedExpense.rawAmount !== undefined
        ? selectedExpense.rawAmount
        : Math.abs(parseFloat(String(selectedExpense.amount).replace(/[^0-9.-]+/g, '')) || 0);
    setEditAmount(String(cleanNum));
    setEditCategory(selectedExpense.category);
    setEditMethod(
      selectedExpense.method &&
        selectedExpense.method !== 'Concluído' &&
        selectedExpense.method !== 'Pendente'
        ? selectedExpense.method
        : 'Multibanco'
    );
    setEditDescription(selectedExpense.description || '');
    setEditDate(selectedExpense.rawDate || new Date());
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedExpense) return;
    if (!editName.trim()) {
      setEditError('Por favor insere o nome da entidade/fornecedor.');
      return;
    }
    const parsedAmount = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setEditError('Por favor insere um valor numérico válido maior que 0.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      const res = await transactionsApi.updateTransaction(selectedExpense.id, {
        name: editName.trim(),
        amount: parsedAmount,
        category: editCategory.trim() || 'Diversos',
        method: editMethod,
        description: editDescription.trim(),
        paymentDate: editDate.toISOString(),
      });

      if (res && res.success) {
        const newDateStr = formatDateDisplay(editDate);
        const isExpense = selectedExpense.type === 'despesa' || type === 'despesa';
        const newFormattedAmount = isExpense
          ? `-${formatCurrency(parsedAmount, { removeSign: true })}`
          : `+${formatCurrency(parsedAmount, { removeSign: true })}`;

        setSelectedExpense({
          ...selectedExpense,
          name: editName.trim(),
          amount: newFormattedAmount,
          rawAmount: parsedAmount,
          category: editCategory.trim() || 'Diversos',
          method: editMethod,
          description: editDescription.trim(),
          date: newDateStr,
          rawDate: editDate,
          avatarChar: editName.trim().charAt(0).toUpperCase(),
        });

        setIsEditModalOpen(false);
        loadTransactionsFromApi(0, false);
      } else {
        setEditError(res?.error || 'Erro ao guardar alterações.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedExpense) return;
    try {
      setIsDeleting(true);
      const res = await transactionsApi.deleteTransaction(selectedExpense.id);
      if (res && res.success) {
        cancelInvoiceReminders(selectedExpense.id);
        setIsDeleteModalOpen(false);
        setSelectedExpense(null);
        loadTransactionsFromApi(0, false);
      } else {
        alert(res?.error || 'Erro ao eliminar transação.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Infinite scroll trigger
  const handleEndReached = () => {
    if (!isLoading && !isLoadingMore && hasMore && !searchQuery.trim() && !appliedDate) {
      loadTransactionsFromApi(items.length, true);
    }
  };

  // Pesquisa ultra rápida com debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      if (!appliedDate) {
        loadTransactionsFromApi(0, false);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await transactionsApi.getTransactions({
          type,
          search: q,
          limit: 150,
        });
        if (res && res.success) {
          const mapped: ExpenseItem[] = (res.items || []).map((t) => {
            const d = t.rawDate ? new Date(t.rawDate) : new Date();
            return {
              id: t.id,
              name: t.name,
              method: t.method || (t.isPaid ? 'Concluído' : 'Pendente'),
              amount: type === 'pendentes'
                ? formatCurrency(t.amount, { removeSign: true })
                : formatCurrency(t.amount, { keepSign: true }),
              rawAmount: t.rawAmount || Math.abs(parseFloat(String(t.amount).replace(/[^0-9.-]+/g, '')) || 0),
              type: t.type,
              isPaid: t.isPaid,
              category: t.category || 'Geral',
              date: t.date,
              rawDate: d,
              dueDate: t.dueDate || undefined,
              description: t.description || '',
              avatarChar: t.avatarChar || (t.name[0] || 'V').toUpperCase(),
            };
          });
          setItems(mapped);
          setHasMore(false);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Abre automaticamente a fatura se fornecido initialSelectedId (ex: ao tocar na notificação)
  useEffect(() => {
    if (initialSelectedId && items.length > 0) {
      const match = items.find((x) => x.id === initialSelectedId);
      if (match) {
        setSelectedExpense(match);
      }
    }
  }, [initialSelectedId, items]);

  // Faixa contínua de dias centrada no dia de hoje (-45 a +45 dias = 91 dias)
  const allDays = React.useMemo(() => {
    const days: { date: Date; dayNum: number; dayName: string; key: string; time: number }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let offset = -45; offset <= 45; offset++) {
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

  const INITIAL_SCROLL_X = Math.max(0, 45 * DAY_ITEM_WIDTH - 140);

  // DatePicker 1 (Filtro por Data) state
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerRendered, setDatePickerRendered] = useState(false);
  const [modalMonthIndex, setModalMonthIndex] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [appliedDate, setAppliedDate] = useState<Date | null>(null);
  const dateScrollRef = useRef<ScrollView>(null);

  // Animation values for DatePicker modal
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(450)).current;

  // Auto-scroll DatePicker 1 para a data selecionada ao abrir
  useEffect(() => {
    if (isDatePickerOpen) {
      const selTime = selectedDate.getTime();
      const targetIdx = allDays.findIndex((d) => d.time === selTime);
      if (targetIdx !== -1) {
        dateScrollRef.current?.scrollTo({
          x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
          animated: false,
        });
      }
    }
  }, [isDatePickerOpen]);

  // Ao deslizar horizontalmente no DatePicker 1, atualiza o título do mês com base no item centrado
  const handleDateScroll = (e: any) => {
    const scrollX = e.nativeEvent.contentOffset.x;
    const centerIdx = Math.round((scrollX + 140) / DAY_ITEM_WIDTH);
    const clampedIdx = Math.max(0, Math.min(centerIdx, allDays.length - 1));
    const month = allDays[clampedIdx].date.getMonth();
    if (month !== modalMonthIndex) {
      setModalMonthIndex(month);
    }
  };

  // Setas de navegação de mês no DatePicker 1 deslizam suavemente até ao 1º dia do mês
  const handleMonthNav = (direction: 'next' | 'prev') => {
    const newMonth = (modalMonthIndex + (direction === 'next' ? 1 : -1) + 12) % 12;
    setModalMonthIndex(newMonth);
    const targetIdx = allDays.findIndex((d) => d.date.getMonth() === newMonth);
    if (targetIdx !== -1) {
      dateScrollRef.current?.scrollTo({
        x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
        animated: true,
      });
    }
  };

  const openDatePicker = () => {
    setDatePickerRendered(true);
    setIsDatePickerOpen(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(450);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDatePicker = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 450,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDatePickerOpen(false);
      setDatePickerRendered(false);
    });
  };

  const handleApplyDate = () => {
    setAppliedDate(selectedDate);
    closeDatePicker();
  };

  // Filter transactions by search query & optional applied date (memoized for instant responsiveness)
  const filteredExpenses = React.useMemo(() => {
    let list = items;
    if (appliedDate) {
      const day = String(appliedDate.getDate()).padStart(2, '0');
      const month = String(appliedDate.getMonth() + 1).padStart(2, '0');
      const year = appliedDate.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      list = list.filter((item) => item.date === dateStr);
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.method.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.amount.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }, [items, appliedDate, searchQuery]);

  // Formata uma data 'DD/MM/YYYY' para o formato legível 'D Mês AAAA'
  const formatDateLabel = (dateStr: string): string => {
    const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (isNaN(day) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dateStr;
    return `${day} ${SHORT_MONTHS[monthIdx]} ${year}`;
  };

  // Dynamic grouped list by date label
  const groupedExpensesList = React.useMemo(() => {
    const map = new Map<string, ExpenseItem[]>();
    filteredExpenses.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    return Array.from(map.entries()).map(([dateStr, groupItems]) => {
      const title = dateStr === todayStr ? 'Hoje' : formatDateLabel(dateStr);
      return { title, data: groupItems, items: groupItems };
    });
  }, [filteredExpenses]);

  // DatePicker 2 (Confirm Payment Modal state - Step 2)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('Cartao');
  const [confirmMonthIndex, setConfirmMonthIndex] = useState(today.getMonth());
  const [confirmDate, setConfirmDate] = useState<Date>(today);
  const confirmDateScrollRef = useRef<ScrollView>(null);

  const confirmFadeAnim = useRef(new Animated.Value(0)).current;
  const confirmSlideAnim = useRef(new Animated.Value(350)).current;

  // Auto-scroll DatePicker 2 para a confirmDate quando entra no Passo 2
  useEffect(() => {
    if (isConfirmModalOpen && confirmStep === 2) {
      const targetIdx = allDays.findIndex(
        (d) =>
          d.date.getFullYear() === confirmDate.getFullYear() &&
          d.date.getMonth() === confirmDate.getMonth() &&
          d.date.getDate() === confirmDate.getDate()
      );
      if (targetIdx !== -1) {
        setTimeout(() => {
          confirmDateScrollRef.current?.scrollTo({
            x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
            animated: false,
          });
        }, 120);
      }
    }
  }, [isConfirmModalOpen, confirmStep]);

  // Ao deslizar horizontalmente no DatePicker 2, atualiza o título do mês
  const handleConfirmDateScroll = (e: any) => {
    const scrollX = e.nativeEvent.contentOffset.x;
    const centerIdx = Math.round((scrollX + 140) / DAY_ITEM_WIDTH);
    const clampedIdx = Math.max(0, Math.min(centerIdx, allDays.length - 1));
    const month = allDays[clampedIdx].date.getMonth();
    if (month !== confirmMonthIndex) {
      setConfirmMonthIndex(month);
    }
  };

  // Setas de navegação de mês no DatePicker 2 deslizam suavemente até ao 1º dia do mês
  const handleConfirmMonthNav = (direction: 'next' | 'prev') => {
    const newMonth = (confirmMonthIndex + (direction === 'next' ? 1 : -1) + 12) % 12;
    setConfirmMonthIndex(newMonth);
    const targetIdx = allDays.findIndex((d) => d.date.getMonth() === newMonth);
    if (targetIdx !== -1) {
      confirmDateScrollRef.current?.scrollTo({
        x: Math.max(0, targetIdx * DAY_ITEM_WIDTH - 140),
        animated: true,
      });
    }
  };

  const handleOpenConfirmModal = () => {
    setConfirmStep(1);
    setIsConfirmModalOpen(true);
    Animated.parallel([
      Animated.timing(confirmFadeAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(confirmSlideAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCloseConfirmModal = () => {
    Animated.parallel([
      Animated.timing(confirmFadeAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(confirmSlideAnim, {
        toValue: 350,
        duration: 170,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsConfirmModalOpen(false);
    });
  };

  const handleFinishConfirmPayment = async () => {
    if (selectedExpense) {
      try {
        await cancelInvoiceReminders(selectedExpense.id);
        await transactionsApi.confirmPayment(selectedExpense.id, {
          method: confirmPaymentMethod,
          paymentDate: confirmDate.toISOString(),
        });
      } catch (e) {
        console.log('Error confirming payment in database:', e);
      }
      if (type === 'pendentes') {
        setItems((prev) => prev.filter((it) => it.id !== selectedExpense.id));
      }
      loadTransactionsFromApi();
    }
    handleCloseConfirmModal();
    setSelectedExpense(null);
  };

  // =========================================================================
  // VIEW 2: EXPENSE DETAIL VIEW (Imagem 2, 3 & 4)
  // =========================================================================
  if (selectedExpense) {
    return (
      <View style={styles.detailContainer}>
        {/* Top Header Card */}
        <View
          style={[
            styles.detailTopCard,
            { paddingTop: Math.max(insets.top + 8, 36) },
          ]}
        >
          {/* Top Bar with Back and Action Buttons */}
          <View style={styles.detailNavRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.detailBackButton}
              onPress={() => setSelectedExpense(null)}
            >
              <BackArrowIcon size={26} color="#111111" />
            </TouchableOpacity>

            <View style={styles.detailNavActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.detailNavBtn}
                onPress={handleOpenEditModal}
              >
                <EditIcon size={20} color="#111111" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.detailNavBtn, styles.detailNavDeleteBtn]}
                onPress={() => setIsDeleteModalOpen(true)}
              >
                <TrashIcon size={20} color="#E53935" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Large Amount */}
          <Text style={styles.detailAmountText} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(selectedExpense.amount, { removeSign: true })}
          </Text>

          {/* Entity Name */}
          <Text style={styles.detailNameText}>{selectedExpense.name}</Text>

          {/* Description (apenas se existir e não for vazia) */}
          {Boolean(selectedExpense.description?.trim()) && (
            <Text style={styles.detailDescText}>
              {selectedExpense.description?.trim()}
            </Text>
          )}
        </View>

        {/* Detailed Rows */}
        <View style={styles.detailRowsWrapper}>
          {/* Row 1: Categoria */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Categoria</Text>
            <Text style={styles.detailRowValue}>{selectedExpense.category}</Text>
          </View>

          {/* Row 2: Metodo (Não exibido em Pendentes pois ainda não foi pago) */}
          {type !== 'pendentes' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailRowLabel}>Metodo</Text>
              <Text style={styles.detailRowValue}>{selectedExpense.method}</Text>
            </View>
          )}

          {/* Row 3: Data / Data de criacao */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>
              {type === 'pendentes' ? 'Data de criacao' : 'Data'}
            </Text>
            <Text style={styles.detailRowValue}>{selectedExpense.date}</Text>
          </View>

          {/* Row 4: Data Limite (Vencimento) */}
          {Boolean(selectedExpense.dueDate) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailRowLabel}>Data Limite (Vencimento)</Text>
              <Text style={[styles.detailRowValue, { color: '#E53935', fontFamily: FontFamily.bold }]}>
                {selectedExpense.dueDate}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Action Buttons for Despesas / Receitas */}
        {type !== 'pendentes' && (
          <View
            style={[
              styles.detailBottomActionsRow,
              { paddingBottom: Math.max(insets.bottom + 20, 28) },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.detailBottomEditBtn}
              onPress={handleOpenEditModal}
            >
              <EditIcon size={18} color="#005445" />
              <Text style={styles.detailBottomEditText}>Editar Registo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.detailBottomDeleteBtn}
              onPress={() => setIsDeleteModalOpen(true)}
            >
              <TrashIcon size={18} color="#E53935" />
              <Text style={styles.detailBottomDeleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          visible={isDeleteModalOpen}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setIsDeleteModalOpen(false)}
        >
          <View style={styles.centerModalOverlay}>
            <View style={styles.deleteModalCard}>
              <View style={styles.deleteModalIconBox}>
                <TrashIcon size={26} color="#E53935" />
              </View>

              <Text style={styles.deleteModalTitle}>Eliminar Registo</Text>
              <Text style={styles.deleteModalBody}>
                Tens a certeza de que pretendes eliminar o registo "{selectedExpense.name}" (
                {formatCurrency(selectedExpense.amount, { removeSign: true })}) permanentemente?
                Esta ação é irreversível.
              </Text>

              <View style={styles.deleteModalButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.deleteCancelBtn}
                  onPress={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                >
                  <Text style={styles.deleteCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.deleteConfirmBtn}
                  onPress={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteConfirmText}>Eliminar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Transaction Modal */}
        <Modal
          visible={isEditModalOpen}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setIsEditModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback onPress={() => setIsEditModalOpen(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.editModalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <View style={styles.editModalHeader}>
                <Text style={styles.editModalTitle}>Editar Registo</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.editModalCloseBtn}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <CloseIcon size={20} color="#111111" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 460 }}
              >
                {editError && (
                  <View style={styles.editErrorBanner}>
                    <Text style={styles.editErrorText}>{editError}</Text>
                  </View>
                )}

                {/* Nome */}
                <Text style={styles.editFieldLabel}>Nome / Entidade</Text>
                <TextInput
                  style={styles.editInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Ex: Recheio, Vodafone, Salário"
                  placeholderTextColor="#9E9EA4"
                />

                {/* Valor */}
                <Text style={styles.editFieldLabel}>Valor (€)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9E9EA4"
                />

                {/* Categoria */}
                <Text style={styles.editFieldLabel}>Categoria</Text>
                <TextInput
                  style={styles.editInput}
                  value={editCategory}
                  onChangeText={setEditCategory}
                  placeholder="Ex: Compras, Alimentação"
                  placeholderTextColor="#9E9EA4"
                />
                <View style={styles.editChipsRow}>
                  {QUICK_CATEGORIES.map((cat) => {
                    const isSelected = editCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat}
                        activeOpacity={0.7}
                        style={[styles.editChip, isSelected && styles.editChipActive]}
                        onPress={() => setEditCategory(cat)}
                      >
                        <Text style={[styles.editChipText, isSelected && styles.editChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Método de Pagamento */}
                {type !== 'pendentes' && (
                  <>
                    <Text style={styles.editFieldLabel}>Método de Pagamento</Text>
                    <View style={styles.editChipsRow}>
                      {PAYMENT_METHODS.map((m) => {
                        const isSelected = editMethod === m;
                        return (
                          <TouchableOpacity
                            key={m}
                            activeOpacity={0.7}
                            style={[styles.editChip, isSelected && styles.editChipActive]}
                            onPress={() => setEditMethod(m)}
                          >
                            <Text style={[styles.editChipText, isSelected && styles.editChipTextActive]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Data */}
                <Text style={styles.editFieldLabel}>Data do Registo</Text>
                <View style={styles.editDateRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.editDateQuickBtn}
                    onPress={() => {
                      const d = new Date(editDate);
                      d.setDate(d.getDate() - 1);
                      setEditDate(d);
                    }}
                  >
                    <Text style={styles.editDateQuickText}>-1 dia</Text>
                  </TouchableOpacity>

                  <View style={styles.editDateDisplayBox}>
                    <CalendarIcon size={16} color="#005445" />
                    <Text style={styles.editDateDisplayText}>{formatDateDisplay(editDate)}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.editDateQuickBtn}
                    onPress={() => setEditDate(new Date())}
                  >
                    <Text style={styles.editDateQuickText}>Hoje</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.editDateQuickBtn}
                    onPress={() => {
                      const d = new Date(editDate);
                      d.setDate(d.getDate() + 1);
                      setEditDate(d);
                    }}
                  >
                    <Text style={styles.editDateQuickText}>+1 dia</Text>
                  </TouchableOpacity>
                </View>

                {/* Descrição */}
                <Text style={styles.editFieldLabel}>Descrição (Opcional)</Text>
                <TextInput
                  style={[styles.editInput, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Notas adicionais sobre este registo"
                  placeholderTextColor="#9E9EA4"
                  multiline
                />
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.editSaveBtn}
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#00D09E" />
                ) : (
                  <Text style={styles.editSaveBtnText}>Guardar Alterações</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Slide to Confirm Button for Pendentes (Imagem 2) */}
        {type === 'pendentes' && (
          <View
            style={[
              styles.swipeWrapper,
              { marginBottom: Math.max(insets.bottom + 180, 160) },
            ]}
          >
            <SwipeToConfirm onConfirm={handleOpenConfirmModal} />
          </View>
        )}

        {/* 2-Step Confirmation Modal (Imagens 3 & 4) */}
        <Modal
          visible={isConfirmModalOpen}
          transparent
          statusBarTranslucent
          animationType="none"
          onRequestClose={handleCloseConfirmModal}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={handleCloseConfirmModal}>
              <Animated.View
                style={[
                  styles.modalBackdrop,
                  { opacity: confirmFadeAnim },
                ]}
              />
            </TouchableWithoutFeedback>

            <Animated.View
              style={[
                styles.datePickerSheet,
                {
                  paddingBottom: Math.max(insets.bottom + 16, 28),
                  transform: [{ translateY: confirmSlideAnim }],
                },
              ]}
            >
              {/* Top 2-step progress dashes */}
              <View style={styles.confirmProgressRow}>
                <View
                  style={[
                    styles.confirmProgressSegment,
                    styles.confirmProgressSegmentActive,
                  ]}
                />
                <View
                  style={[
                    styles.confirmProgressSegment,
                    confirmStep === 2 && styles.confirmProgressSegmentActive,
                  ]}
                />
              </View>

              {confirmStep === 1 ? (
                // STEP 1: PAYMENT METHOD TAMBOR (Imagem 3)
                <View style={styles.confirmStepContent}>
                  <View style={{ marginVertical: 22 }}>
                    <DrumWheelPickerLight
                      options={['Dinheiro', 'Cartao', 'MBWay', 'Transferência']}
                      selectedValue={confirmPaymentMethod}
                      onSelect={setConfirmPaymentMethod}
                    />
                  </View>

                  <View style={styles.applyButtonWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.applyButton}
                      onPress={() => setConfirmStep(2)}
                    >
                      <Text style={styles.applyButtonText}>Proximo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // STEP 2: PAYMENT DATE PICKER (Imagem 4)
                <View style={styles.confirmStepContent}>
                  {/* Month Navigation Row */}
                  <View style={styles.modalMonthNavRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.navSquareButton}
                      onPress={() => handleConfirmMonthNav('prev')}
                    >
                      <ChevronLeftIcon size={22} color="#111111" />
                    </TouchableOpacity>

                    <Text style={styles.modalMonthTitle}>
                      {MONTH_NAMES[confirmMonthIndex]}
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.navSquareButton}
                      onPress={() => handleConfirmMonthNav('next')}
                    >
                      <ChevronRightIcon size={22} color="#111111" />
                    </TouchableOpacity>
                  </View>

                  {/* Continuous Horizontal ScrollView of days (tal como no AddScreenView) */}
                  <View style={styles.daysScrollViewWrapper}>
                    <ScrollView
                      ref={confirmDateScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentOffset={{ x: INITIAL_SCROLL_X, y: 0 }}
                      onScroll={handleConfirmDateScroll}
                      scrollEventThrottle={32}
                      contentContainerStyle={styles.daysScrollContent}
                    >
                      {allDays.map((item) => {
                        const selTime = confirmDate.getTime();
                        const diff = Math.round((item.time - selTime) / 86400000);
                        const isSelected = diff === 0;
                        const isFullyOpaque = isSelected || Math.abs(diff) <= 2;

                        return (
                          <TouchableOpacity
                            key={`confirm-${item.key}`}
                            activeOpacity={0.75}
                            style={[
                              styles.dayColumn,
                              isSelected && styles.dayColumnActive,
                              !isFullyOpaque && styles.dayColumnDimmed,
                            ]}
                            onPress={() => {
                              setConfirmDate(item.date);
                              setConfirmMonthIndex(item.date.getMonth());
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

                  {/* Confirmar Button */}
                  <View style={styles.applyButtonWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.applyButton}
                      onPress={handleFinishConfirmPayment}
                    >
                      <Text style={styles.applyButtonText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>
          </View>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // VIEW 1: EXPENSES LIST VIEW (Imagem 1)
  // =========================================================================
  return (
    <View style={styles.container}>
      {/* Top Header Row */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: Math.max(insets.top + 12, 38) },
        ]}
      >
        <Text style={styles.pageTitle}>{displayTitle}</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.calendarButton}
          onPress={openDatePicker}
        >
          <CalendarIcon size={24} color={appliedDate ? '#00A887' : '#111111'} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Procurar"
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Quick Filters Row */}
      {/* <View style={styles.quickFiltersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersContent}
        >
          {QUICK_FILTERS.map((label, idx) => {
            const isSelected = selectedFilter === idx;
            return (
              <TouchableOpacity
                key={`filter-${idx}`}
                activeOpacity={0.75}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                ]}
                onPress={() =>
                  setSelectedFilter(isSelected ? null : idx)
                }
              >
                <FilterGridIcon size={14} color="#1E1E1E" />
                <Text style={styles.filterPillText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View> */}

      {/* Virtualized Grouped Transactions List */}
      <SectionList
        sections={groupedExpensesList}
        keyExtractor={(item) => item.id}
        style={styles.scrollList}
        contentContainerStyle={styles.scrollListContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReachedThreshold={0.5}
        onEndReached={handleEndReached}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ paddingVertical: 18, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ paddingVertical: 60, alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 16, color: '#333333', marginBottom: 6, textAlign: 'center' }}>
                {type === 'despesa'
                  ? 'Sem despesas registadas'
                  : type === 'receita'
                    ? 'Sem faturação registada'
                    : 'Sem pagamentos pendentes'}
              </Text>
              <Text style={{ fontFamily: FontFamily.regular, fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 18 }}>
                {type === 'pendentes'
                  ? 'Todas as tuas despesas estão em dia.'
                  : 'Usa o botão + ou desliza para cima na barra inferior para registar.'}
              </Text>
            </View>
          ) : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#111111" />
            </View>
          )
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderWrapper}>
            <Text style={styles.groupHeaderTitle}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.65}
            style={styles.expenseItemRow}
            onPress={() => setSelectedExpense(item)}
          >
            {/* Avatar Initial */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarChar}>{item.avatarChar}</Text>
            </View>

            {/* Info Text */}
            <View style={styles.itemCenterInfo}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSubtitle}>{item.method}</Text>
            </View>

            {/* Amount */}
            <Text style={styles.itemAmount} numberOfLines={1} adjustsFontSizeToFit>
              {type === 'pendentes'
                ? formatCurrency(item.amount, { removeSign: true })
                : formatCurrency(item.amount, { keepSign: true })}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ================================================================= */}
      {/* DATEPICKER BOTTOM SHEET (Modal ensures it renders above navbar) */}
      {/* ================================================================= */}
      <Modal
        visible={datePickerRendered}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={closeDatePicker}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop with Fade */}
          <TouchableWithoutFeedback onPress={closeDatePicker}>
            <Animated.View
              style={[
                styles.modalBackdrop,
                { opacity: fadeAnim },
              ]}
            />
          </TouchableWithoutFeedback>

          {/* Bottom Sheet Card */}
          <Animated.View
            style={[
              styles.datePickerSheet,
              {
                paddingBottom: Math.max(insets.bottom + 16, 28),
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Top Handle */}
            <View style={styles.sheetHandleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Month Navigation Row */}
            <View style={styles.modalMonthNavRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.navSquareButton}
                onPress={() => handleMonthNav('prev')}
              >
                <ChevronLeftIcon size={22} color="#111111" />
              </TouchableOpacity>

              <Text style={styles.modalMonthTitle}>
                {MONTH_NAMES[modalMonthIndex]}
              </Text>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.navSquareButton}
                onPress={() => handleMonthNav('next')}
              >
                <ChevronRightIcon size={22} color="#111111" />
              </TouchableOpacity>
            </View>

            {/* Continuous Horizontal ScrollView of days */}
            <View style={styles.daysScrollViewWrapper}>
              <ScrollView
                ref={dateScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: INITIAL_SCROLL_X, y: 0 }}
                onScroll={handleDateScroll}
                scrollEventThrottle={32}
                contentContainerStyle={styles.daysScrollContent}
              >
                {allDays.map((item) => {
                  const selTime = selectedDate.getTime();
                  const diff = Math.round((item.time - selTime) / 86400000);
                  const isSelected = diff === 0;
                  const isFullyOpaque = isSelected || Math.abs(diff) <= 2;

                  return (
                    <TouchableOpacity
                      key={`filter-${item.key}`}
                      activeOpacity={0.75}
                      style={[
                        styles.dayColumn,
                        isSelected && styles.dayColumnActive,
                        !isFullyOpaque && styles.dayColumnDimmed,
                      ]}
                      onPress={() => {
                        setSelectedDate(item.date);
                        setModalMonthIndex(item.date.getMonth());
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

            {/* Aplicar / Limpar Buttons */}
            <View style={{ flexDirection: 'row', width: '100%', paddingHorizontal: 12, gap: 10 }}>
              {appliedDate && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.applyButton, { flex: 1, backgroundColor: '#F0F0F2' }]}
                  onPress={() => {
                    setAppliedDate(null);
                    closeDatePicker();
                  }}
                >
                  <Text style={[styles.applyButtonText, { color: '#666666' }]}>Limpar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.applyButton, appliedDate ? { flex: 2 } : { width: '100%' }]}
                onPress={handleApplyDate}
              >
                <Text style={styles.applyButtonText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  pageTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    color: '#111111',
    letterSpacing: -0.5,
  },
  calendarButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // Search Bar
  searchBarWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEDED',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#111111',
    height: '100%',
  },

  // Quick Filters
  quickFiltersWrapper: {
    marginBottom: 16,
  },
  quickFiltersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEDED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 7,
  },
  filterPillActive: {
    backgroundColor: '#DCDCDC',
  },
  filterPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#1E1E1E',
  },

  // Grouped List
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingHorizontal: 22,
    paddingBottom: 175,
  },
  sectionHeaderWrapper: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  groupContainer: {
    width: '100%',
  },
  groupHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#111111',
    marginBottom: 8,
  },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D6E5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarChar: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#4B6B82',
  },
  itemCenterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: '#111111',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#7E7E84',
  },
  itemAmount: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#2C2C2E',
  },

  // =========================================================================
  // DETAIL VIEW STYLES
  // =========================================================================
  detailContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailTopCard: {
    backgroundColor: '#F5F5F7',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: 20,
    position: 'relative',
  },
  detailNavRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  detailNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBEBEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailNavDeleteBtn: {
    backgroundColor: '#FDE8E8',
  },
  detailAmountText: {
    fontFamily: FontFamily.bold,
    fontSize: 38,
    color: '#111111',
    marginTop: 10,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  detailNameText: {
    fontFamily: FontFamily.regular,
    fontSize: 20,
    color: '#111111',
    marginTop: 8,
  },
  detailDescText: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: '#9E9EA4',
    marginTop: 4,
  },
  detailRowsWrapper: {
    marginTop: 32,
    paddingHorizontal: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  detailRowLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    color: '#111111',
  },
  detailRowValue: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    color: '#333333',
  },

  // =========================================================================
  // DATEPICKER MODAL STYLES
  // =========================================================================
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  datePickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  sheetHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
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
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  navSquareButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMonthTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: '#111111',
  },
  daysScrollViewWrapper: {
    width: '100%',
    marginBottom: 32,
  },
  daysScrollContent: {
    paddingHorizontal: 20,
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
  applyButtonWrapper: {
    width: '100%',
    paddingHorizontal: 12,
  },
  applyButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 30,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  applyButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 20,
    color: '#FFFFFF',
  },

  // Swipe to Confirm styles (Imagem 2)
  swipeWrapper: {
    paddingHorizontal: 22,
    marginTop: 'auto',
    width: '100%',
  },
  swipeTrack: {
    width: '100%',
    height: 66,
    borderRadius: 33,
    backgroundColor: '#ECECEC',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  swipeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 33,
    overflow: 'hidden',
  },
  swipeFillShine: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  swipeTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 46,
  },
  swipeText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: '#666666',
    letterSpacing: -0.2,
  },
  swipeArrowsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  swipeThumbWrapper: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  swipeAura: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00D09E',
  },
  swipeThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00A887',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00A887',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 6,
    elevation: 5,
  },

  // Confirm Modal Progress & Steps (Imagens 3 & 4)
  confirmProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
    width: '100%',
  },
  confirmProgressSegment: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCDCDC',
  },
  confirmProgressSegmentActive: {
    backgroundColor: '#1E1E1E',
  },
  confirmStepContent: {
    width: '100%',
    alignItems: 'center',
  },

  // DrumWheelPickerLight Styles (Imagem 3)
  drumLightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 170,
    height: 144,
  },
  drumLightVerticalLine: {
    width: 1.5,
    height: 120,
    backgroundColor: '#1E1E1E',
  },
  drumLightViewport: {
    flex: 1,
    height: 144,
    overflow: 'hidden',
  },
  drumLightScrollView: {
    flex: 1,
  },
  drumLightItem: {
    height: DRUM_LIGHT_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drumLightText: {
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },
  drumLightTextCenter: {
    fontSize: 27,
    color: '#1E1E1E',
    fontFamily: FontFamily.medium,
  },
  drumLightTextSide: {
    fontSize: 21,
    color: '#D1D1D6',
  },

  // Detail Bottom Actions Row
  detailBottomActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 22,
    marginTop: 32,
    width: '100%',
  },
  detailBottomEditBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F5F1',
    borderWidth: 1,
    borderColor: 'rgba(0, 84, 69, 0.2)',
  },
  detailBottomEditText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#005445',
  },
  detailBottomDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDE8E8',
  },
  detailBottomDeleteText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#E53935',
  },

  // Delete Modal Styles
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  deleteModalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDE8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#111111',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteModalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#333333',
  },
  deleteConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // Edit Modal Styles
  editModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingHorizontal: 22,
    paddingTop: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#111111',
  },
  editModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editErrorBanner: {
    backgroundColor: '#FDE8E8',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  editErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#E53935',
  },
  editFieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: '#111111',
    marginBottom: 14,
  },
  editChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  editChip: {
    backgroundColor: '#F0F0F2',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  editChipActive: {
    backgroundColor: '#005445',
  },
  editChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#333333',
  },
  editChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#00D09E',
  },
  editDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  editDateDisplayBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F5F1',
    height: 42,
    borderRadius: 12,
  },
  editDateDisplayText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#005445',
  },
  editDateQuickBtn: {
    backgroundColor: '#F0F0F2',
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editDateQuickText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#333333',
  },
  editSaveBtn: {
    backgroundColor: '#00382F',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  editSaveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#00D09E',
  },
});
