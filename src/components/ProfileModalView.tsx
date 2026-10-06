import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import { CloseIcon, SparkleIcon } from './Icons';

interface ProfileModalViewProps {
  visible: boolean;
  onClose: () => void;
  currentUser: any;
  localVersion: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void;
  updateStatusMessage: string | null;
}

export const ProfileModalView: React.FC<ProfileModalViewProps> = ({
  visible,
  onClose,
  currentUser,
  localVersion,
  isCheckingUpdate,
  onCheckUpdate,
  updateStatusMessage,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
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
            { paddingBottom: Math.max(insets.bottom + 20, 32) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Perfil & Conta</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.closeBtn}
              onPress={onClose}
            >
              <CloseIcon size={20} color="#111111" />
            </TouchableOpacity>
          </View>

          {/* User Card */}
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {currentUser?.avatarChar ||
                  (currentUser?.name ? currentUser.name[0].toUpperCase() : 'U')}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {currentUser?.name || 'Sessão Ativa'}
              </Text>
              <Text style={styles.userEmail}>
                {currentUser?.email || 'utilizador@vault.pt'}
              </Text>
              <View style={styles.securityBadge}>
                <Text style={styles.securityText}>🔒 Sessão Segura Encriptada</Text>
              </View>
            </View>
          </View>

          {/* Preferences & System Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Moeda do Sistema</Text>
              <Text style={styles.infoValue}>Euro (€)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Base de Dados</Text>
              <Text style={styles.infoValue}>PostgreSQL (Ativo)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>Versão da App</Text>
                <Text style={styles.versionSub}>v{localVersion} (Build Seguro)</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.updateBtn}
                onPress={onCheckUpdate}
                disabled={isCheckingUpdate}
              >
                <SparkleIcon size={14} color="#111111" />
                <Text style={styles.updateBtnText}>
                  {isCheckingUpdate ? 'A verificar...' : 'Verificar'}
                </Text>
              </TouchableOpacity>
            </View>
            {updateStatusMessage && (
              <Text style={styles.updateMessage}>{updateStatusMessage}</Text>
            )}
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
  },
  userEmail: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  securityBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  securityText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#2E7D32',
  },
  infoCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#333333',
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#111111',
  },
  versionSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  updateBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#111111',
  },
  updateMessage: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#008570',
    marginTop: 8,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
  },
});
