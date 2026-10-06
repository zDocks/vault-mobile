import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '../theme/typography';
import { BackArrowIcon, SparkleIcon, BarsIcon } from './Icons';
import { dashboardApi } from '../services/api';

interface StatsScreenViewProps {
  onClose: () => void;
}

export const StatsScreenView: React.FC<StatsScreenViewProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);

  const formatEuro = (val: number) => {
    const isNeg = val < 0;
    const abs = Math.abs(val);
    const parts = abs.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = parts[1];
    return `${isNeg ? '-' : ''}${integerPart},${decimalPart} €`;
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await dashboardApi.getStats();
      if (res.success && res.stats) {
        setStatsData(res.stats);
      }
    } catch (err) {
      console.warn('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const saldo = statsData?.saldoAtual || 0;
  const receitas = statsData?.totalReceitas || 0;
  const despesas = statsData?.totalDespesas || 0;
  const taxaPoupanca = statsData?.taxaPoupanca || 0;
  const categories = statsData?.categoriesExpenses || [];
  const projections = statsData?.projections;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backButton}
          onPress={onClose}
        >
          <BackArrowIcon size={20} color="#1E1E1E" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Estatísticas & Previsões</Text>
          <Text style={styles.headerSubtitle}>Mês Atual • Gestão Financeira</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E1E1E" />
          <Text style={styles.loadingText}>A calcular números e previsões...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E1E1E" />
          }
        >
          {/* Main Balance Card */}
          <View style={styles.mainCard}>
            <View style={styles.mainCardTop}>
              <Text style={styles.mainCardLabel}>SALDO LÍQUIDO MENSAL</Text>
              <View style={[styles.badgePill, { backgroundColor: saldo >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
                <Text style={[styles.badgeText, { color: saldo >= 0 ? '#2E7D32' : '#D32F2F' }]}>
                  {saldo >= 0 ? 'Positivo' : 'Défice'}
                </Text>
              </View>
            </View>
            <Text style={[styles.mainCardValue, { color: saldo >= 0 ? '#111111' : '#D32F2F' }]}>
              {formatEuro(saldo)}
            </Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Receitas</Text>
                <Text style={[styles.summaryValue, { color: '#008570' }]}>
                  +{formatEuro(receitas)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Despesas</Text>
                <Text style={[styles.summaryValue, { color: '#1E1E1E' }]}>
                  -{formatEuro(despesas)}
                </Text>
              </View>
            </View>

            {/* Savings Rate Bar */}
            <View style={styles.savingsContainer}>
              <View style={styles.savingsHeader}>
                <Text style={styles.savingsTitle}>Taxa de Poupança</Text>
                <Text style={styles.savingsPercent}>{taxaPoupanca}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(Math.max(taxaPoupanca, 0), 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.savingsHint}>
                {taxaPoupanca >= 20
                  ? '🎯 Excelente margem de retenção de capital.'
                  : taxaPoupanca > 0
                  ? '⚡ Poupança positiva, monitorize os gastos supérfluos.'
                  : '⚠️ Despesas equivalentes ou superiores às receitas.'}
              </Text>
            </View>
          </View>

          {/* Projection Card */}
          {projections && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBadge}>
                  <SparkleIcon size={16} color="#008570" />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Previsão até ao Fim do Mês</Text>
                  <Text style={styles.sectionSubtitle}>
                    Dia {projections.currentDay} de {projections.lastDayOfMonth} ({projections.daysRemaining} dias restantes)
                  </Text>
                </View>
              </View>

              <View style={styles.projectionGrid}>
                <View style={styles.projectionBox}>
                  <Text style={styles.projBoxLabel}>MÉDIA DIÁRIA</Text>
                  <Text style={styles.projBoxValue}>
                    {formatEuro(projections.mediaDiariaDespesa)}
                  </Text>
                  <Text style={styles.projBoxSub}>gasto / dia</Text>
                </View>

                <View style={styles.projectionBox}>
                  <Text style={styles.projBoxLabel}>ESTIMATIVA TOTAL</Text>
                  <Text style={[styles.projBoxValue, { color: '#D32F2F' }]}>
                    {formatEuro(projections.projecaoDespesasFimMes)}
                  </Text>
                  <Text style={styles.projBoxSub}>ao fecho do mês</Text>
                </View>
              </View>

              <View style={styles.projResultBox}>
                <Text style={styles.projResultLabel}>Saldo Final Projetado:</Text>
                <Text
                  style={[
                    styles.projResultValue,
                    { color: projections.projecaoSaldoFimMes >= 0 ? '#008570' : '#D32F2F' },
                  ]}
                >
                  {formatEuro(projections.projecaoSaldoFimMes)}
                </Text>
              </View>
            </View>
          )}

          {/* Expenses Breakdown by Category */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconBadge}>
                <BarsIcon size={16} color="#1E1E1E" active />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Despesas por Categoria</Text>
                <Text style={styles.sectionSubtitle}>Onde o seu dinheiro foi investido</Text>
              </View>
            </View>

            {categories.length === 0 ? (
              <View style={styles.emptyCategories}>
                <Text style={styles.emptyCategoriesText}>
                  Ainda não existem despesas registadas neste período.
                </Text>
              </View>
            ) : (
              <View style={styles.categoriesList}>
                {categories.map((cat: any, idx: number) => (
                  <View key={idx} style={styles.categoryItem}>
                    <View style={styles.catTopRow}>
                      <Text style={styles.catName} numberOfLines={1}>
                        {cat.category}
                      </Text>
                      <View style={styles.catAmountWrap}>
                        <Text style={styles.catAmount}>{formatEuro(cat.total)}</Text>
                        <Text style={styles.catPercent}>({cat.percentage}%)</Text>
                      </View>
                    </View>
                    <View style={styles.catProgressBg}>
                      <View
                        style={[
                          styles.catProgressFill,
                          {
                            width: `${Math.min(cat.percentage, 100)}%`,
                            backgroundColor: idx === 0 ? '#1E1E1E' : idx === 1 ? '#4A4A4A' : '#8E8E93',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#8E8E93',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  mainCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainCardLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#8E8E93',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
  mainCardValue: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E5EA',
  },
  savingsContainer: {
    marginTop: 18,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savingsTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#333333',
  },
  savingsPercent: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#EFEFF4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#008570',
    borderRadius: 4,
  },
  savingsHint: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#111111',
  },
  sectionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  projectionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  projectionBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  projBoxLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#8E8E93',
    marginBottom: 6,
  },
  projBoxValue: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#111111',
  },
  projBoxSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  projResultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  projResultLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#333333',
  },
  projResultValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  categoriesList: {
    gap: 14,
  },
  categoryItem: {
    gap: 6,
  },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#222222',
    flex: 1,
  },
  catAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  catPercent: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
  },
  catProgressBg: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyCategories: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCategoriesText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
