import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontFamily } from '../src/theme/typography';
import {
  BackArrowIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  CardIcon,
  TrayIcon,
  UserCircleIcon,
  WalletFolderIcon,
} from '../src/components/Icons';
import { categoriesApi, entitiesApi } from '../src/services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ManagementType =
  | 'categorias_receitas'
  | 'categorias_despesas'
  | 'colaboradores'
  | 'fornecedores';

export default function ManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: ManagementType }>();
  // Freeze the type so it never mutates or resets to default when route params pop on back
  const typeRef = useRef<ManagementType>((params.type as ManagementType) || 'categorias_despesas');
  const type = typeRef.current;
  const isLeavingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Add Item Bottom Sheet State & Animations
  const [addModalRendered, setAddModalRendered] = useState(false);
  const addFadeAnim = useRef(new Animated.Value(0)).current;
  const addSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isAddClosingRef = useRef(false);

  const [newName, setNewName] = useState('');
  const [newNif, setNewNif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    router.back();
  };

  // Configuration according to management type
  const config = {
    categorias_receitas: {
      title: 'Categorias de Receitas',
      subtitle: 'Fontes de rendimento e faturação',
      badgeText: 'Receitas',
      heroDesc: 'Organize os fluxos de entrada da sua atividade comercial.',
      placeholder: 'Pesquisar categoria de receita...',
      addTitle: 'Nova Categoria de Receita',
      nameLabel: 'Nome da Categoria',
      namePlaceholder: 'Ex: Consultoria, Venda a Balcão, Serviços...',
      hasNif: false,
      accentColor: '#008570',
      avatarBg: '#E6F7F2',
      avatarText: '#008570',
      icon: <TrayIcon size={22} color="#008570" active />,
    },
    categorias_despesas: {
      title: 'Categorias de Despesas',
      subtitle: 'Classificação de saídas de capital',
      badgeText: 'Despesas',
      heroDesc: 'Categorize despesas operacionais, custos fixos e variáveis.',
      placeholder: 'Pesquisar categoria de despesa...',
      addTitle: 'Nova Categoria de Despesa',
      nameLabel: 'Nome da Categoria',
      namePlaceholder: 'Ex: Renda, Combustível, Software, Fornecedores...',
      hasNif: false,
      accentColor: '#1E1E1E',
      avatarBg: '#F1F3F5',
      avatarText: '#1E1E1E',
      icon: <CardIcon size={22} color="#1E1E1E" active />,
    },
    colaboradores: {
      title: 'Colaboradores',
      subtitle: 'Membros da equipa e trabalhadores',
      badgeText: 'Equipa',
      heroDesc: 'Gestão de trabalhadores para associação a adiantamentos e tarefas.',
      placeholder: 'Pesquisar colaborador por nome ou NIF...',
      addTitle: 'Novo Colaborador',
      nameLabel: 'Nome do Colaborador',
      namePlaceholder: 'Ex: João Silva, Maria Santos...',
      hasNif: true,
      nifLabel: 'NIF ou Cargo (Opcional)',
      nifPlaceholder: 'Ex: 123456789 ou Gestor de Turno',
      accentColor: '#4F46E5',
      avatarBg: '#EEF2FF',
      avatarText: '#4F46E5',
      icon: <UserCircleIcon size={22} color="#4F46E5" />,
    },
    fornecedores: {
      title: 'Fornecedores',
      subtitle: 'Entidades e parceiros comerciais',
      badgeText: 'Parceiros',
      heroDesc: 'Parceiros e emissores de faturas para o OCR inteligente.',
      placeholder: 'Pesquisar fornecedor por nome ou NIF...',
      addTitle: 'Novo Fornecedor',
      nameLabel: 'Nome da Empresa / Fornecedor',
      namePlaceholder: 'Ex: EDP Comercial, Makro, Vodafone, Staples...',
      hasNif: true,
      nifLabel: 'NIF do Fornecedor (Opcional)',
      nifPlaceholder: 'Ex: 501234567',
      accentColor: '#D97706',
      avatarBg: '#FEF3C7',
      avatarText: '#D97706',
      icon: <WalletFolderIcon size={22} color="#D97706" />,
    },
  }[type];

  const loadData = useCallback(async () => {
    if (isLeavingRef.current) return;
    try {
      if (type === 'categorias_receitas') {
        const res = await categoriesApi.getCategories('receita');
        if (res.success) setItems(res.categories || []);
      } else if (type === 'categorias_despesas') {
        const res = await categoriesApi.getCategories('despesa');
        if (res.success) setItems(res.categories || []);
      } else if (type === 'colaboradores') {
        const res = await entitiesApi.getEntities('funcionario');
        if (res.success) setItems(res.entities || []);
      } else if (type === 'fornecedores') {
        const res = await entitiesApi.getEntities('fornecedor');
        if (res.success) setItems(res.entities || []);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAddModal = () => {
    setAddModalRendered(true);
    isAddClosingRef.current = false;
    addFadeAnim.setValue(0);
    addSlideAnim.setValue(SCREEN_HEIGHT);

    Animated.parallel([
      Animated.timing(addFadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(addSlideAnim, {
        toValue: 0,
        damping: 28,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeAddModal = (onFinished?: () => void) => {
    if (isAddClosingRef.current) return;
    isAddClosingRef.current = true;

    Animated.parallel([
      Animated.timing(addFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(addSlideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAddModalRendered(false);
      isAddClosingRef.current = false;
      if (onFinished) onFinished();
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setIsSubmitting(true);
      if (type === 'categorias_receitas') {
        await categoriesApi.createCategory(newName.trim(), 'receita');
      } else if (type === 'categorias_despesas') {
        await categoriesApi.createCategory(newName.trim(), 'despesa');
      } else if (type === 'colaboradores') {
        await entitiesApi.createEntity(newName.trim(), 'funcionario', newNif.trim() || undefined);
      } else if (type === 'fornecedores') {
        await entitiesApi.createEntity(newName.trim(), 'fornecedor', newNif.trim() || undefined);
      }
      setNewName('');
      setNewNif('');
      closeAddModal(() => {
        loadData();
      });
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      'Remover Registo',
      `Tem a certeza de que pretende remover "${item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'categorias_receitas' || type === 'categorias_despesas') {
                await categoriesApi.deleteCategory(item.id);
              } else {
                await entitiesApi.deleteEntity(item.id);
              }
              loadData();
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível remover este item.');
            }
          },
        },
      ]
    );
  };

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const matchName = item.name?.toLowerCase().includes(q);
    const matchNif = item.nif?.toLowerCase().includes(q);
    return matchName || matchNif;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* TOPBAR / HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backButton}
          onPress={handleBack}
        >
          <BackArrowIcon size={20} color="#111111" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {config.title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {config.subtitle}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.addPillButton}
          onPress={openAddModal}
        >
          <PlusIcon size={14} color="#FFFFFF" />
          <Text style={styles.addPillText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#111111"
          />
        }
      >
        {/* HERO / SUMMARY STRIP */}
        {/* <View style={styles.heroStrip}>
          <View style={[styles.heroIconCircle, { backgroundColor: config.avatarBg }]}>
            {config.icon}
          </View>
          <View style={styles.heroInfo}>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.countBadge, { backgroundColor: config.avatarBg }]}>
                <Text style={[styles.countBadgeText, { color: config.accentColor }]}>
                  {items.length} {items.length === 1 ? 'Registo' : 'Registos'}
                </Text>
              </View>
              <Text style={styles.heroBadgeLabel}>{config.badgeText}</Text>
            </View>
            <Text style={styles.heroDescription}>{config.heroDesc}</Text>
          </View>
        </View> */}

        {/* SEARCH BAR */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <SearchIcon size={18} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder={config.placeholder}
              placeholderTextColor="#8E8E93"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.clearSearchBtn}>
                  <CloseIcon size={12} color="#8E8E93" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CONTENT LIST */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#111111" />
            <Text style={styles.loadingText}>A carregar dados...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: config.avatarBg }]}>
              {config.icon}
            </View>
            <Text style={styles.emptyTitle}>
              {search.trim() ? 'Nenhum resultado encontrado' : 'Nenhum registo criado'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search.trim()
                ? `Não foram encontrados registos para "${search}".`
                : 'Toque no botão abaixo para adicionar o seu primeiro item e começar a organizar os seus lançamentos.'}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.emptyAddBtn, { backgroundColor: config.accentColor }]}
              onPress={openAddModal}
            >
              <PlusIcon size={16} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Adicionar Primeiro</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredItems.map((item, idx) => {
              const isDefault = item.is_default === true;
              const initialChar = item.name ? item.name[0].toUpperCase() : '•';

              return (
                <View key={item.id || idx} style={styles.itemCard}>
                  {/* Avatar */}
                  <View style={[styles.avatarCircle, { backgroundColor: config.avatarBg }]}>
                    <Text style={[styles.avatarText, { color: config.accentColor }]}>
                      {initialChar}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={styles.badgesRow}>
                      {isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>PADRÃO</Text>
                        </View>
                      ) : (
                        <View style={styles.customBadge}>
                          <Text style={styles.customBadgeText}>PERSONALIZADO</Text>
                        </View>
                      )}

                      {item.nif ? (
                        <View style={styles.nifBadge}>
                          <Text style={styles.nifBadgeText}>NIF {item.nif}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Delete Action (only if not system default) */}
                  {!isDefault ? (
                    <TouchableOpacity
                      activeOpacity={0.65}
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item)}
                    >
                      <TrashIcon size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.systemLockPlaceholder} />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ADD BOTTOM SHEET MODAL */}
      <Modal
        visible={addModalRendered}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeAddModal()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => closeAddModal()}>
            <Animated.View style={[styles.modalBackdrop, { opacity: addFadeAnim }]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.modalSheet,
              {
                paddingBottom: Math.max(insets.bottom + 20, 32),
                transform: [{ translateY: addSlideAnim }],
              },
            ]}
          >
            <View style={styles.sheetHandleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{config.addTitle}</Text>
                <Text style={styles.modalSubHeader}>Novo registo de gestão no Vault</Text>
              </View>

            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>{config.nameLabel}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={config.namePlaceholder}
                  placeholderTextColor="#8E8E93"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
              </View>

              {config.hasNif && (
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>{config.nifLabel}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={config.nifPlaceholder}
                    placeholderTextColor="#8E8E93"
                    value={newNif}
                    onChangeText={setNewNif}
                  />
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.submitBtn,
                  (!newName.trim() || isSubmitting) && styles.submitBtnDisabled,
                ]}
                disabled={!newName.trim() || isSubmitting}
                onPress={handleCreate}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Guardar Registo</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F2',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 19,
    color: '#111111',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  addPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  addPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 18,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: 14,
  },
  heroIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
  },
  heroBadgeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#8E8E93',
  },
  heroDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  searchBarWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEDED',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#111111',
    height: '100%',
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCDCDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#111111',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0F0F2',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#111111',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  defaultBadge: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#666666',
  },
  customBadge: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EFEFF4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#8E8E93',
  },
  nifBadge: {
    backgroundColor: '#F4F5F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nifBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#333333',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemLockPlaceholder: {
    width: 36,
    height: 36,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 4,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCDCDC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 19,
    color: '#111111',
  },
  modalSubHeader: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 16,
    marginTop: 6,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalInputLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#333333',
  },
  modalInput: {
    height: 50,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  submitBtn: {
    backgroundColor: '#111111',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
