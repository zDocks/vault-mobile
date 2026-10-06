import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import { SparkleIcon } from './Icons';
import { AppVersionInfo, API_BASE_URL } from '../services/api';

interface AppUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  updateInfo: AppVersionInfo | null;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  visible,
  onClose,
  updateInfo,
}) => {
  const insets = useSafeAreaInsets();

  if (!updateInfo) return null;

  const handleDownload = async () => {
    const rawUrl = updateInfo.downloadUrl || '/api/app/download';
    const fullUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${API_BASE_URL}${rawUrl}`;

    try {
      await Linking.openURL(fullUrl);
    } catch (err: any) {
      console.warn('Erro ao abrir link de atualização:', err.message);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.sheetHandle} />

          <View style={styles.updateSheetBody}>
            {/* Badge no estilo Vault */}
            <View style={styles.updateVaultBadge}>
              <SparkleIcon size={14} color="#0B5244" />
              <Text style={styles.updateVaultBadgeText}>NOVA VERSÃO DISPONÍVEL</Text>
            </View>

            {/* Title & Version Subtitle */}
            <Text style={styles.updateVaultTitle}>
              {updateInfo.title || 'Atualização do Sistema'}
            </Text>
            <Text style={styles.updateVaultVersionSubtitle}>
              Versão {updateInfo.version} disponível para instalação
            </Text>

            {/* Release Notes List */}
            {updateInfo.notes && updateInfo.notes.length > 0 && (
              <View style={styles.updateVaultNotesBox}>
                {updateInfo.notes.map((note, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.updateVaultNoteItem,
                      idx > 0 && styles.updateVaultNoteDivider,
                    ]}
                  >
                    <View style={styles.updateVaultBullet} />
                    <Text style={styles.updateVaultNoteText}>{note}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.updateVaultPrimaryButton}
              onPress={handleDownload}
            >
              <Text style={styles.updateVaultPrimaryText}>Instalar Atualização</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.updateVaultSecondaryButton}
              onPress={onClose}
            >
              <Text style={styles.updateVaultSecondaryText}>Lembrar Mais Tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  updateSheetBody: {
    paddingHorizontal: 24,
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
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ECEEF0',
  },
  updateVaultNoteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  updateVaultNoteDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EBECEE',
    marginTop: 4,
    paddingTop: 8,
  },
  updateVaultBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00875A',
    marginTop: 6,
    marginRight: 10,
  },
  updateVaultNoteText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#2D3748',
    lineHeight: 18,
  },
  updateVaultPrimaryButton: {
    width: '100%',
    backgroundColor: '#00875A',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#00875A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateVaultPrimaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  updateVaultSecondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  updateVaultSecondaryText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#8E8E93',
  },
});
