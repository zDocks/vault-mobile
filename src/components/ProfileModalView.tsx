import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import { CloseIcon, SparkleIcon } from './Icons';
import { SafeAnimatedIcon } from './SafeAnimatedIcon';

interface ProfileModalViewProps {
  visible: boolean;
  onClose: () => void;
  currentUser: any;
  localVersion: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void;
  updateStatusMessage: string | null;
  onLogout?: () => void;
}

export const ProfileModalView: React.FC<ProfileModalViewProps> = ({
  visible,
  onClose,
  currentUser,
  localVersion,
  isCheckingUpdate,
  onCheckUpdate,
  updateStatusMessage,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();

  const userInitial = currentUser?.avatarChar ||
    (currentUser?.name ? currentUser.name[0].toUpperCase() : 'Z');

  const userEmail = currentUser?.email || 'admin@vault.pt';
  const userName = currentUser?.name || userEmail.split('@')[0];

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={onClose}
        />

        <View
          style={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Conta Vault</Text>
              <Text style={styles.headerSubtitle}>Gestão financeira & segurança</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeBtn}
              onPress={onClose}
            >
              <CloseIcon size={18} color="#111111" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* VIP Platinum Card */}
            <LinearGradient
              colors={['#051B15', '#082E23', '#03140F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.vipCard}
            >
              <View style={styles.vipCardHeader}>
                <View style={styles.vaultBadge}>
                  <SafeAnimatedIcon size={16} color="#00D09E" strokeWidth={5} animated={false} />
                  <Text style={styles.vaultBadgeText}>VAULT PRIVATE</Text>
                </View>
                <View style={styles.activePill}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.activePillText}>Ativo</Text>
                </View>
              </View>

              <View style={styles.vipCardBody}>
                <View style={styles.vipAvatarContainer}>
                  <Text style={styles.vipAvatarText}>{userInitial}</Text>
                </View>
                <View style={styles.vipUserInfo}>
                  <Text style={styles.vipUserName} numberOfLines={1}>{userName}</Text>
                  <Text style={styles.vipUserEmail} numberOfLines={1}>{userEmail}</Text>
                </View>
              </View>

              <View style={styles.vipCardFooter}>
                <View style={styles.securityTag}>
                  <Text style={styles.securityTagText}>🔒 Sessão Criptografada JWT (60d)</Text>
                </View>
                <Text style={styles.accountNumber}>PT • 2026</Text>
              </View>
            </LinearGradient>

            {/* System Infrastructure Card */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>SISTEMA & INFRAESTRUTURA</Text>
              
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoRowLeft}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconEmoji}>🌐</Text>
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Servidor em Nuvem</Text>
                      <Text style={styles.infoSubtext}>Cloudflare Zero Trust Tunnel</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadgeGreen}>
                    <Text style={styles.statusBadgeText}>api.zdocks.me</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoRowLeft}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconEmoji}>🐘</Text>
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Base de Dados</Text>
                      <Text style={styles.infoSubtext}>PostgreSQL (Dokploy Cloud)</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadgeGreen}>
                    <Text style={styles.statusBadgeText}>Conectada</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoRowLeft}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconEmoji}>📱</Text>
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>Versão da App</Text>
                      <Text style={styles.infoSubtext}>v{localVersion} (Android Release)</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.updateBtn}
                    onPress={onCheckUpdate}
                    disabled={isCheckingUpdate}
                  >
                    <SparkleIcon size={14} color="#0B5244" />
                    <Text style={styles.updateBtnText}>
                      {isCheckingUpdate ? 'A verificar...' : 'Verificar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {updateStatusMessage && (
                  <View style={styles.updateMessageBanner}>
                    <Text style={styles.updateMessageText}>{updateStatusMessage}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Logout Action if provided */}
            {onLogout && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.logoutButton}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
              >
                <Text style={styles.logoutButtonText}>Terminar Sessão</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  container: {
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#111111',
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EBECEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  vipCard: {
    borderRadius: 22,
    padding: 20,
    shadowColor: '#00D09E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.25)',
  },
  vipCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 208, 158, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 208, 158, 0.3)',
  },
  vaultBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#00D09E',
    letterSpacing: 0.8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00FFA8',
  },
  activePillText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#E0FFF5',
  },
  vipCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  vipAvatarContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00FFA8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00FFA8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  vipAvatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#03140F',
  },
  vipUserInfo: {
    flex: 1,
  },
  vipUserName: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  vipUserEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 3,
  },
  vipCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  securityTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  securityTagText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#A0F0D8',
  },
  accountNumber: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
  },
  cardSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEEF0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 16,
  },
  infoLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#1A202C',
  },
  infoSubtext: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  statusBadgeGreen: {
    backgroundColor: '#E6F8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#00875A',
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E4F4EC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 135, 90, 0.2)',
  },
  updateBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#0B5244',
  },
  updateMessageBanner: {
    backgroundColor: '#F0F9F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  updateMessageText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#00875A',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F4',
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  logoutButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#FF3B30',
  },
});
