import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FontFamily } from '../theme/typography';
import {
  SearchIcon,
  UserCircleIcon,
  LineChartUpIcon,
  WalletFolderIcon,
  PowerIcon,
  CloseIcon,
} from './Icons';
import { ProfileModalView } from './ProfileModalView';

interface MoreMenuScreenViewProps {
  currentUser: any;
  localVersion: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void;
  updateStatusMessage: string | null;
  onLogout: () => void;
}

export const MoreMenuScreenView: React.FC<MoreMenuScreenViewProps> = ({
  currentUser,
  localVersion,
  isCheckingUpdate,
  onCheckUpdate,
  updateStatusMessage,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Navigation state
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const confirmLogout = () => {
    Alert.alert(
      'Terminar Sessão',
      'Tem a certeza de que pretende sair da sua conta com segurança?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  const showProdutosSection =
    matchesSearch('Estatisticas') || matchesSearch('Conselheiro de compra');

  const showGestaoSection =
    matchesSearch('Categorias Receitas') ||
    matchesSearch('Categorias Despesas') ||
    matchesSearch('Colaboradores') ||
    matchesSearch('Fornecedores');

  const showSairSection = matchesSearch('Sair');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top + 12, 48) },
        ]}
      >
        <Text style={styles.headerTitle}>Menu</Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.headerIconButton,
              isSearchActive && styles.headerIconButtonActive,
            ]}
            onPress={() => {
              setIsSearchActive(!isSearchActive);
              if (isSearchActive) setSearchQuery('');
            }}
          >
            <SearchIcon size={20} color="#111111" />
          </TouchableOpacity>

          {/* <TouchableOpacity
            activeOpacity={0.7}
            style={styles.headerIconButton}
            onPress={() => setIsProfileOpen(true)}
          >
            <UserCircleIcon size={22} color="#111111" />
          </TouchableOpacity> */}
        </View>
      </View>

      {/* Quick Search Bar (Animated / Conditional) */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <SearchIcon size={18} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar no menu..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <CloseIcon size={16} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Main Menu Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 130 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: PRODUTOS */}
        {showProdutosSection && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>PRODUTOS</Text>
            <View style={styles.cardContainer}>
              {matchesSearch('Estatisticas') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push('/statistics')}
                >
                  <View style={styles.iconWrap}>
                    <LineChartUpIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Estatisticas</Text>
                </TouchableOpacity>
              )}

              {matchesSearch('Estatisticas') && matchesSearch('Conselheiro de compra') && (
                <View style={styles.rowDivider} />
              )}

              {matchesSearch('Conselheiro de compra') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push('/advisor')}
                >
                  <View style={styles.iconWrap}>
                    <WalletFolderIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Conselheiro de compra</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* SECTION 2: GESTÃO */}
        {showGestaoSection && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>GESTAO</Text>
            <View style={styles.cardContainer}>
              {matchesSearch('Categorias Receitas') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push({ pathname: '/management', params: { type: 'categorias_receitas' } })}
                >
                  <View style={styles.iconWrap}>
                    <LineChartUpIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Categorias Receitas</Text>
                </TouchableOpacity>
              )}

              {matchesSearch('Categorias Receitas') && matchesSearch('Categorias Despesas') && (
                <View style={styles.rowDivider} />
              )}

              {matchesSearch('Categorias Despesas') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push({ pathname: '/management', params: { type: 'categorias_despesas' } })}
                >
                  <View style={styles.iconWrap}>
                    <WalletFolderIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Categorias Despesas</Text>
                </TouchableOpacity>
              )}

              {matchesSearch('Categorias Despesas') && matchesSearch('Colaboradores') && (
                <View style={styles.rowDivider} />
              )}

              {matchesSearch('Colaboradores') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push({ pathname: '/management', params: { type: 'colaboradores' } })}
                >
                  <View style={styles.iconWrap}>
                    <WalletFolderIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Colaboradores</Text>
                </TouchableOpacity>
              )}

              {matchesSearch('Colaboradores') && matchesSearch('Fornecedores') && (
                <View style={styles.rowDivider} />
              )}

              {matchesSearch('Fornecedores') && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuRow}
                  onPress={() => router.push({ pathname: '/management', params: { type: 'fornecedores' } })}
                >
                  <View style={styles.iconWrap}>
                    <WalletFolderIcon size={20} color="#111111" />
                  </View>
                  <Text style={styles.menuRowText}>Fornecedores</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* SECTION 3: SAIR */}
        {showSairSection && (
          <View style={styles.sectionGroup}>
            <View style={styles.cardContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.menuRow}
                onPress={confirmLogout}
              >
                <View style={styles.iconWrap}>
                  <PowerIcon size={20} color="#E02020" />
                </View>
                <Text style={styles.logoutText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL: Perfil do Utilizador & Atualizações */}
      <ProfileModalView
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        localVersion={localVersion}
        isCheckingUpdate={isCheckingUpdate}
        onCheckUpdate={onCheckUpdate}
        updateStatusMessage={updateStatusMessage}
        onLogout={onLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    color: '#111111',
    letterSpacing: -0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonActive: {
    backgroundColor: '#E5E5EA',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#111111',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 20,
  },
  sectionGroup: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#8E8E93',
    paddingLeft: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  iconWrap: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuRowText: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: '#111111',
    flex: 1,
  },
  logoutText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
    flex: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EFEFF4',
    marginLeft: 50,
    marginRight: 18,
  },
});
