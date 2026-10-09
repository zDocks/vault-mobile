import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ScannerIcon,
  SparkleIcon,
  ChevronDownIcon,
  CardIcon,
  TrayIcon,
  HomeTabIcon,
  BarsIcon,
  GridIcon,
} from '../src/components/Icons';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { AddScreenView } from '../src/components/AddScreenView';
import { ExpensesScreenView } from '../src/components/ExpensesScreenView';
import { MoreMenuScreenView } from '../src/components/MoreMenuScreenView';
import { InvoiceScannerModal } from '../src/components/InvoiceScannerModal';
import { Colors } from '../src/theme/colors';
import { FontFamily } from '../src/theme/typography';
import { dashboardApi, authApi, appUpdatesApi, AppVersionInfo, isNewerVersion, API_BASE_URL } from '../src/services/api';
import { AppUpdateModal } from '../src/components/AppUpdateModal';
import { getCurrentUser, UserSession } from '../src/services/session';
import { formatCurrency } from '../src/utils/format';
import { initNotifications, setupNotificationListener } from '../src/services/notifications';

const PHYSICAL_SCREEN_HEIGHT = Math.max(
  Dimensions.get('screen').height,
  Dimensions.get('window').height
);
const SCREEN_HEIGHT = PHYSICAL_SCREEN_HEIGHT;
const OFFSCREEN_Y = PHYSICAL_SCREEN_HEIGHT + 200;

const PERIOD_OPTIONS = [
  { id: 'diario', label: 'Diario', pillText: 'diario' },
  { id: 'mensal', label: 'Mensal', pillText: 'mensal' },
  { id: 'trimestral', label: 'Trimestral', pillText: 'trimestral' },
  { id: 'anual', label: 'Anual', pillText: 'anual' },
  { id: 'total', label: 'Total', pillText: 'total' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState('mensal');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [pendingSelectedTxId, setPendingSelectedTxId] = useState<string | null>(null);

  // Inicialização do sistema de notificações (AlarmManager / OS level)
  useEffect(() => {
    initNotifications();

    const sub = setupNotificationListener((transactionId) => {
      setActiveTab('pendentes');
      setPendingSelectedTxId(transactionId);
    });

    return () => {
      sub?.remove();
    };
  }, []);

  // Sistema de Verificação e Atualização Automática de Versão
  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);

  const localVersion = Constants.expoConfig?.version || '1.0.7';

  const checkForAppUpdates = async (silent = true) => {
    try {
      if (!silent) setIsCheckingUpdate(true);
      const info = await appUpdatesApi.checkVersion();
      if (info && info.success && info.version) {
        if (isNewerVersion(info.version, localVersion)) {
          setAvailableUpdate(info);
          setIsUpdateModalVisible(true);
          return;
        }
      }
      if (!silent) {
        setUpdateStatusMessage('A aplicação já está na versão mais recente!');
        setTimeout(() => setUpdateStatusMessage(null), 3500);
      }
    } catch {
      if (!silent) {
        setUpdateStatusMessage('Não foi possível verificar atualizações no momento.');
        setTimeout(() => setUpdateStatusMessage(null), 3500);
      }
    } finally {
      if (!silent) setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    // Verificação automática ao abrir a aplicação
    checkForAppUpdates(true);
  }, []);

  const handleDownloadUpdate = async () => {
    if (!availableUpdate) return;
    const fullUrl = availableUpdate.downloadUrl.startsWith('http')
      ? availableUpdate.downloadUrl
      : `${API_BASE_URL}${availableUpdate.downloadUrl}`;

    try {
      await Linking.openURL(fullUrl);
    } catch (err: any) {
      console.warn('Erro ao abrir link de atualização:', err.message);
    }
  };

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setCurrentUser(u);
      } else {
        router.replace('/login');
      }
    });
  }, [activeTab]);

  const handleLogout = async () => {
    await authApi.logout();
    router.replace('/login');
  };

  const [summary, setSummary] = useState({
    lucro: '0.00€',
    despesas: '0.00€',
    receita: '0.00€',
  });

  const loadSummary = async () => {
    try {
      const res = await dashboardApi.getSummary(selectedPeriod);
      if (res && res.data) {
        setSummary({
          lucro: res.data.lucro || '0.00€',
          despesas: res.data.despesas || '0.00€',
          receita: res.data.receitas || '0.00€',
        });
      }
    } catch (e) {
      console.log('Error loading dashboard summary:', e);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedPeriod, activeTab, isAddVisible]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(PHYSICAL_SCREEN_HEIGHT)).current;
  const isClosingRef = useRef(false);

  // Add Screen pull-up animation & PanResponder
  const addScreenAnim = useRef(new Animated.Value(OFFSCREEN_Y)).current;

  const openAddScreen = () => {
    setIsAddVisible(true);
    Animated.spring(addScreenAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };

  const closeAddScreen = () => {
    Animated.timing(addScreenAnim, {
      toValue: OFFSCREEN_Y,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsAddVisible(false);
    });
  };

  const pullTabPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        setIsAddVisible(true);
        addScreenAnim.setValue(PHYSICAL_SCREEN_HEIGHT);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          addScreenAnim.setValue(Math.max(0, PHYSICAL_SCREEN_HEIGHT + gestureState.dy));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -60 || gestureState.vy < -0.4) {
          openAddScreen();
        } else if (Math.abs(gestureState.dy) < 6) {
          openAddScreen();
        } else {
          closeAddScreen();
        }
      },
    })
  ).current;

  // Fade out and subtle scale down of Home content while Add screen slides up
  const homeOpacity = addScreenAnim.interpolate({
    inputRange: [0, PHYSICAL_SCREEN_HEIGHT * 0.55, PHYSICAL_SCREEN_HEIGHT],
    outputRange: [0, 0.35, 1],
    extrapolate: 'clamp',
  });

  const homeScale = addScreenAnim.interpolate({
    inputRange: [0, PHYSICAL_SCREEN_HEIGHT],
    outputRange: [0.93, 1],
    extrapolate: 'clamp',
  });

  const handleOpenSheet = () => {
    isClosingRef.current = false;
    fadeAnim.setValue(0);
    slideAnim.setValue(SCREEN_HEIGHT);
    setIsSheetOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (onComplete?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSheetOpen(false);
      isClosingRef.current = false;
      onComplete?.();
    });
  };

  const handleSelectPeriod = (periodId: string) => {
    setSelectedPeriod(periodId);
    closeSheet();
  };

  const currentPeriod =
    PERIOD_OPTIONS.find((p) => p.id === selectedPeriod) || PERIOD_OPTIONS[1];

  const renderBottomSheet = (isFloating?: boolean) => (
    <Animated.View
      style={[
        styles.bottomSheet,
        isFloating && styles.bottomSheetFloating,
        {
          paddingBottom: Math.max(insets.bottom + 8, 20),
          opacity: homeOpacity,
        },
      ]}
    >
      {/* Top Tab Area with Handle and Prompt (F9F9F9) */}
      <View
        {...pullTabPanResponder.panHandlers}
        style={styles.topDrawerTab}
      >
        {/* Drag Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Drag Action Prompt */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.promptContainer}
          onPress={openAddScreen}
        >
          <Text style={styles.promptText}>
            Deslize para cima para adicionar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Bar Tabs */}
      <View style={styles.navBar}>
        {/* Tab 1: Despesa */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.navItem}
          onPress={() => setActiveTab('despesa')}
        >
          <CardIcon
            size={26}
            active={activeTab === 'despesa'}
            color="#2B2B2B"
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'despesa' && styles.navLabelActive,
            ]}
          >
            Despesa
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Faturacao */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.navItem}
          onPress={() => setActiveTab('faturacao')}
        >
          <TrayIcon
            size={26}
            active={activeTab === 'faturacao'}
            color="#2B2B2B"
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'faturacao' && styles.navLabelActive,
            ]}
          >
            Receita
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Home */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <HomeTabIcon
            size={28}
            active={activeTab === 'home'}
            color="#2B2B2B"
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'home' && styles.navLabelActive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Pendentes */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.navItem}
          onPress={() => setActiveTab('pendentes')}
        >
          <BarsIcon
            size={24}
            active={activeTab === 'pendentes'}
            color="#2B2B2B"
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'pendentes' && styles.navLabelActive,
            ]}
          >
            Pendentes
          </Text>
        </TouchableOpacity>

        {/* Tab 5: Mais */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.navItem}
          onPress={() => setActiveTab('mais')}
        >
          <GridIcon
            size={24}
            active={activeTab === 'mais'}
            color="#2B2B2B"
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'mais' && styles.navLabelActive,
            ]}
          >
            Menu
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const formattedLucro = formatCurrency(summary.lucro);
  const formattedDespesas = formatCurrency(summary.despesas);
  const formattedReceita = formatCurrency(summary.receita);

  return (
    <View
      style={[
        styles.container,
        activeTab !== 'home' && {
          backgroundColor: '#FFFFFF',
        },
      ]}
    >
      <StatusBar
        style={activeTab === 'home' ? 'light' : 'dark'}
      />

      {activeTab === 'home' ? (
        <LinearGradient
          colors={[
            Colors.homeGradStart,
            Colors.homeGradMid1,
            Colors.homeGradMid2,
            Colors.homeGradEnd,
          ]}
          locations={[0, 0.3, 0.65, 1]}
          style={styles.gradient}
        >
          <Animated.View
            style={[
              styles.mainContent,
              {
                paddingTop: Math.max(insets.top + 12, 40),
                opacity: homeOpacity,
                transform: [{ scale: homeScale }],
              },
            ]}
          >
            {/* Header Row */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {/* Scanner button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.iconButton}
                  onPress={() => setIsScannerVisible(true)}
                >
                  <ScannerIcon size={15} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Assistente button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.assistantButton}
                  onPress={() => router.push('/assistant')}
                >
                  <SparkleIcon size={18} color="#FFFFFF" />
                  <Text style={styles.assistantText}>Assistente</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Balance Content */}
            <View style={styles.middleSection}>
              {/* Period Selector (mensal v) */}
              <View style={styles.selectorWrapper}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.periodPill}
                  onPress={handleOpenSheet}
                >
                  <Text style={styles.periodText}>{currentPeriod.pillText}</Text>
                  <ChevronDownIcon size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Main Balance Section */}
              <View style={styles.balanceSection}>
                <Text style={styles.balanceLabel}>Lucro</Text>
                <Text
                  style={[
                    styles.balanceAmount,
                    formattedLucro.length > 13
                      ? styles.balanceAmountHuge
                      : formattedLucro.length > 9
                        ? styles.balanceAmountLarge
                        : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formattedLucro}
                </Text>
              </View>
            </View>

            {/* Translucent Split Card: Despesas | Receita */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.splitCard}
              onPress={() => router.push('/statistics')}
            >
              <View style={styles.cardColumn}>
                <Text style={styles.columnLabel}>Despesas</Text>
                <Text
                  style={[
                    styles.columnValue,
                    formattedDespesas.length > 10 && styles.columnValueLarge,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formattedDespesas}
                </Text>
              </View>

              <View style={styles.columnDivider} />

              <View style={styles.cardColumn}>
                <Text style={styles.columnLabel}>Receita</Text>
                <Text
                  style={[
                    styles.columnValue,
                    formattedReceita.length > 10 && styles.columnValueLarge,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formattedReceita}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom Sheet / Navigation Area */}
          {renderBottomSheet(false)}
        </LinearGradient>
      ) : activeTab === 'despesa' ? (
        <View style={styles.tabContentContainer}>
          <Animated.View
            style={[
              styles.expensesContentWrapper,
              {
                opacity: homeOpacity,
                transform: [{ scale: homeScale }],
              },
            ]}
          >
            <ExpensesScreenView key="despesa" type="despesa" onOpenAddScreen={openAddScreen} />
          </Animated.View>

          {/* Bottom Sheet / Navigation Area */}
          {renderBottomSheet(true)}
        </View>
      ) : activeTab === 'faturacao' ? (
        <View style={styles.tabContentContainer}>
          <Animated.View
            style={[
              styles.expensesContentWrapper,
              {
                opacity: homeOpacity,
                transform: [{ scale: homeScale }],
              },
            ]}
          >
            <ExpensesScreenView key="receita" type="receita" onOpenAddScreen={openAddScreen} />
          </Animated.View>

          {/* Bottom Sheet / Navigation Area */}
          {renderBottomSheet(true)}
        </View>
      ) : activeTab === 'pendentes' ? (
        <View style={styles.tabContentContainer}>
          <Animated.View
            style={[
              styles.expensesContentWrapper,
              {
                opacity: homeOpacity,
                transform: [{ scale: homeScale }],
              },
            ]}
          >
            <ExpensesScreenView
              key="pendentes"
              type="pendentes"
              initialSelectedId={pendingSelectedTxId}
              onOpenAddScreen={openAddScreen}
            />
          </Animated.View>

          {/* Bottom Sheet / Navigation Area */}
          {renderBottomSheet(true)}
        </View>
      ) : (
        <View style={styles.tabContentContainer}>
          <MoreMenuScreenView
            currentUser={currentUser}
            localVersion={localVersion}
            isCheckingUpdate={isCheckingUpdate}
            onCheckUpdate={() => checkForAppUpdates(false)}
            updateStatusMessage={updateStatusMessage}
            onLogout={handleLogout}
          />

          {/* Bottom Sheet / Navigation Area */}
          {renderBottomSheet(true)}
        </View>
      )}

      {/* Full-Screen Add Modal Screen with Pull-up Animation */}
      <Animated.View
        pointerEvents={isAddVisible ? 'auto' : 'none'}
        style={[
          styles.addScreenWrapper,
          {
            opacity: isAddVisible ? 1 : 0,
            transform: [{ translateY: addScreenAnim }],
          },
        ]}
      >
        <AddScreenView onClose={closeAddScreen} />
      </Animated.View>

      {/* DatePicker Bottom Sheet Modal */}
      <Modal
        visible={isSheetOpen}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeSheet()}
      >
        <View style={styles.sheetOverlay}>
          {/* Backdrop with Fade In / Fade Out */}
          <TouchableWithoutFeedback onPress={() => closeSheet()}>
            <Animated.View
              style={[
                styles.sheetBackdrop,
                { opacity: fadeAnim },
              ]}
            />
          </TouchableWithoutFeedback>

          {/* Bottom Sheet Card with Slide In / Slide Out */}
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                paddingBottom: Math.max(insets.bottom + 18, 30),
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Drag Handle Bar */}
            <View style={styles.sheetHandle} />

            {/* Options List */}
            <View style={styles.sheetList}>
              {PERIOD_OPTIONS.map((option, index) => {
                const isSelected = option.id === selectedPeriod;
                const isLast = index === PERIOD_OPTIONS.length - 1;
                return (
                  <React.Fragment key={option.id}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.sheetItem}
                      onPress={() => handleSelectPeriod(option.id)}
                    >
                      <Text
                        style={[
                          styles.sheetItemText,
                          isSelected && styles.sheetItemTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                    {!isLast && <View style={styles.sheetDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal de Atualização da App */}
      <AppUpdateModal
        visible={isUpdateModalVisible}
        onClose={() => setIsUpdateModalVisible(false)}
        updateInfo={availableUpdate}
      />

      {/* Modal de Digitalização de Faturas com Vault AI */}
      <InvoiceScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onSuccess={() => {
          loadSummary();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  moreCheckUpdateButton: {
    backgroundColor: '#F0F0F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  moreCheckUpdateText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#111111',
  },
  updateStatusMessageText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#00875A',
    marginTop: 6,
  },
  updateSheetContainer: {
    paddingTop: 12,
  },
  updateSheetBody: {
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  updateVaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F4EC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  updateVaultBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0B5244',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  updateVaultTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#111111',
    textAlign: 'center',
    marginBottom: 4,
  },
  updateVaultVersionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  updateVaultNotesBox: {
    width: '100%',
    backgroundColor: '#F8F8F9',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  updateVaultNoteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
  },
  updateVaultNoteDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  updateVaultBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0B5244',
    marginTop: 6,
    marginRight: 10,
  },
  updateVaultNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#333333',
    flex: 1,
    lineHeight: 19,
  },
  updateVaultPrimaryButton: {
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  updateVaultPrimaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  updateVaultSecondaryButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  updateVaultSecondaryText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#8E8E93',
  },
  container: {
    flex: 1,
    backgroundColor: '#02231E',
  },
  gradient: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  assistantText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  avatarButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0A0D0C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarText: {
    fontFamily: FontFamily.black,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 1,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorWrapper: {
    alignItems: 'center',
    marginBottom: 44,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  periodPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  periodText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 17,
  },
  balanceSection: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
    fontSize: 30,
    letterSpacing: 3,
    opacity: 0.95,
  },
  balanceAmount: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 46,
    letterSpacing: -0.5,
    marginTop: 6,
    textAlign: 'center',
  },
  balanceAmountLarge: {
    fontSize: 37,
    letterSpacing: -0.3,
  },
  balanceAmountHuge: {
    fontSize: 30,
    letterSpacing: 0,
  },
  splitCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  cardColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  columnLabel: {
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginBottom: 6,
  },
  columnValue: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
  },
  columnValueLarge: {
    fontSize: 16,
  },
  columnDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    height: '80%',
    alignSelf: 'center',
  },
  tabContentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  expensesContentWrapper: {
    flex: 1,
    zIndex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomSheetFloating: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 20,
  },
  topDrawerTab: {
    backgroundColor: '#F9F9F9',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    paddingBottom: 4,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  handle: {
    width: 54,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6D2CF',
  },
  promptContainer: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  promptText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#222222',
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  navLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#2B2B2B',
  },
  navLabelActive: {
    color: '#2B2B2B',
  },
  indicatorContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    bottom: -100,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetContainer: {
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
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C5C0BC',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetList: {
    paddingHorizontal: 26,
  },
  sheetItem: {
    paddingVertical: 14,
    justifyContent: 'center',
  },
  sheetItemText: {
    fontSize: 20,
    fontFamily: FontFamily.regular,
    color: '#222222',
  },
  sheetItemTextSelected: {
    fontFamily: FontFamily.semiBold,
    color: '#000000',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#E8E4E0',
  },
  addScreenWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  moreScreenContainer: {
    flex: 1,
    backgroundColor: '#F7F6F4',
  },
  moreScreenContent: {
    paddingHorizontal: 22,
  },
  moreScreenTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  moreProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  moreAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  moreAvatarChar: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#FFFFFF',
  },
  moreProfileInfo: {
    flex: 1,
  },
  moreProfileName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    color: '#111111',
    marginBottom: 2,
  },
  moreProfileEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  moreSecurityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moreSecurityText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#2E7D32',
  },
  moreSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  moreSectionHeader: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  moreOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreOptionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: '#222222',
  },
  moreOptionValue: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#777777',
  },
  moreDivider: {
    height: 1,
    backgroundColor: '#F0ECE8',
    marginVertical: 4,
  },
  moreLogoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E53935',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  moreLogoutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#E53935',
  },
});
