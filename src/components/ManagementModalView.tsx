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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import { BackArrowIcon, SearchIcon, PlusIcon, TrashIcon, CloseIcon } from './Icons';
import { categoriesApi, entitiesApi } from '../services/api';

export type ManagementType =
  | 'categorias_receitas'
  | 'categorias_despesas'
  | 'colaboradores'
  | 'fornecedores';

interface ManagementModalViewProps {
  type: ManagementType;
  onClose: () => void;
}

export const ManagementModalView: React.FC<ManagementModalViewProps> = ({
  type,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Add Item Modal State & Bottom Sheet Animations
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalRendered, setAddModalRendered] = useState(false);
  const addFadeAnim = useRef(new Animated.Value(0)).current;
  const addSlideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const isAddClosingRef = useRef(false);

  const [newName, setNewName] = useState('');
  const [newNif, setNewNif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setIsAddModalOpen(true);
    setAddModalRendered(true);
    isAddClosingRef.current = false;
    addFadeAnim.setValue(0);
    addSlideAnim.setValue(Dimensions.get('window').height);

    Animated.parallel([
      Animated.timing(addFadeAnim, {
        toValue: 1,
        duration: 250,
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
        toValue: Dimensions.get('window').height,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAddModalOpen(false);
      setAddModalRendered(false);
      isAddClosingRef.current = false;
      if (onFinished) onFinished();
    });
  };

  // Configuration according to type
  const config = {
    categorias_receitas: {
      title: 'Categorias de Receitas',
      subtitle: 'Fontes de rendimento e faturado',
      placeholder: 'Pesquisar categoria de receita...',
      addTitle: 'Nova Categoria de Receita',
      nameLabel: 'Nome da Categoria',
      namePlaceholder: 'Ex: Consultoria, Venda de Serviços...',
      hasNif: false,
    },
    categorias_despesas: {
      title: 'Categorias de Despesas',
      subtitle: 'Classificação de saídas de capital',
      placeholder: 'Pesquisar categoria de despesa...',
      addTitle: 'Nova Categoria de Despesa',
      nameLabel: 'Nome da Categoria',
      namePlaceholder: 'Ex: Renda, Combustível, Software...',
      hasNif: false,
    },
    colaboradores: {
      title: 'Colaboradores',
      subtitle: 'Membros de equipa e funcionários',
      placeholder: 'Pesquisar colaborador...',
      addTitle: 'Novo Colaborador',
      nameLabel: 'Nome do Colaborador',
      namePlaceholder: 'Ex: João Silva, Maria Santos...',
      hasNif: true,
      nifLabel: 'NIF ou Cargo (Opcional)',
      nifPlaceholder: 'Ex: 123456789 ou Gestor',
    },
    fornecedores: {
      title: 'Fornecedores',
      subtitle: 'Parceiros e entidades prestadoras',
      placeholder: 'Pesquisar fornecedor...',
      addTitle: 'Novo Fornecedor',
      nameLabel: 'Nome do Fornecedor / Empresa',
      namePlaceholder: 'Ex: EDP, Vodafone, Staples...',
      hasNif: true,
      nifLabel: 'NIF do Fornecedor (Opcional)',
      nifPlaceholder: 'Ex: 501234567',
    },
  }[type];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
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
    }
  }, [type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      'Remover Item',
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

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backButton}
          onPress={onClose}
        >
          <BackArrowIcon size={20} color="#1E1E1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{config.title}</Text>
          <Text style={styles.headerSubtitle}>{config.subtitle}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.addButton}
          onPress={openAddModal}
        >
          <PlusIcon size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
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
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E1E1E" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 30, 50) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {filteredItems.length} {filteredItems.length === 1 ? 'registo' : 'registos'}
            </Text>
          </View>

          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum item encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Toque no botão + no topo para adicionar o primeiro item.
              </Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              {filteredItems.map((item, idx) => {
                const isLast = idx === filteredItems.length - 1;
                const isDefault = item.is_default === true;

                return (
                  <React.Fragment key={item.id || idx}>
                    <View style={styles.itemRow}>
                      <View style={styles.itemAvatar}>
                        <Text style={styles.itemAvatarText}>
                          {item.name ? item.name[0].toUpperCase() : '•'}
                        </Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSub}>
                          {isDefault
                            ? 'Padrão do Sistema'
                            : item.nif
                            ? `NIF: ${item.nif}`
                            : 'Personalizado'}
                        </Text>
                      </View>

                      {!isDefault && (
                        <TouchableOpacity
                          activeOpacity={0.6}
                          style={styles.deleteButton}
                          onPress={() => handleDelete(item)}
                        >
                          <TrashIcon size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {!isLast && <View style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Modal (True Bottom Sheet) */}
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
              <Text style={styles.modalTitle}>{config.addTitle}</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.closeBtn}
                onPress={() => closeAddModal()}
              >
                <CloseIcon size={20} color="#111111" />
              </TouchableOpacity>
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
                activeOpacity={0.8}
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
                  <Text style={styles.submitBtnText}>Adicionar</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#111111',
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#111111',
  },
  countRow: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  countText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#8E8E93',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  itemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#1E1E1E',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#111111',
  },
  itemSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
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
    backgroundColor: '#E0E0E0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#111111',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 12,
    color: '#666666',
  },
  modalInput: {
    height: 48,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  submitBtn: {
    backgroundColor: '#1E1E1E',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#BDB7B3',
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
