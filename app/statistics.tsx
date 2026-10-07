import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontFamily } from '../src/theme/typography';
import {
  BackArrowIcon,
  SparkleIcon,
  BarsIcon,
  CardIcon,
  TrayIcon,
  CloseIcon,
} from '../src/components/Icons';
import { dashboardApi } from '../src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PeriodType = 'diario' | 'mensal' | 'trimestral' | 'anual' | 'todos';

const PALETTE = [
  '#111111',
  '#008570',
  '#ED6C02',
  '#6366F1',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#8E8E93',
];

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<PeriodType>('mensal');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'despesas' | 'receitas'>('despesas');

  // Modal para explicar o Score de Saúde Financeira (Verdadeiro Bottom Sheet)
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoreModalRendered, setScoreModalRendered] = useState(false);
  const scoreFadeAnim = useRef(new Animated.Value(0)).current;
  const scoreSlideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const isScoreClosingRef = useRef(false);

  const openScoreModal = () => {
    isScoreClosingRef.current = false;
    setScoreModalRendered(true);
    setIsScoreModalOpen(true);
    scoreFadeAnim.setValue(0);
    scoreSlideAnim.setValue(Dimensions.get('window').height);

    Animated.parallel([
      Animated.timing(scoreFadeAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scoreSlideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeScoreModal = () => {
    if (isScoreClosingRef.current) return;
    isScoreClosingRef.current = true;

    Animated.parallel([
      Animated.timing(scoreFadeAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scoreSlideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsScoreModalOpen(false);
      setScoreModalRendered(false);
    });
  };

  const formatEuro = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0,00 €';
    const isNeg = val < 0;
    const abs = Math.abs(val);
    const parts = abs.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = parts[1];
    return `${isNeg ? '-' : ''}${integerPart},${decimalPart} €`;
  };

  const loadStatistics = useCallback(async (selectedPeriod: PeriodType) => {
    try {
      const res = await dashboardApi.getStats(selectedPeriod);
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStatistics(period);
  }, [period, loadStatistics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStatistics(period);
  };

  const kpis = stats?.kpis || {};
  const monthlyHistory = stats?.monthlyHistory || [];
  const categoriesExpenses = stats?.categoriesExpenses || [];
  const categoriesRevenues = stats?.categoriesRevenues || [];
  const paymentMethods = stats?.paymentMethods || [];
  const dayOfWeekExpenses = stats?.dayOfWeekExpenses || [];
  const topExpenses = stats?.topExpenses || [];
  const dailyTrend = stats?.dailyTrend || [];
  const recorrentes = stats?.recorrentes || {};
  const projections = stats?.projections || {};
  const diagnostics = stats?.diagnostics || {};

  const saldo = kpis.saldoLiquido || 0;
  const receitas = kpis.totalReceitas || 0;
  const despesas = kpis.totalDespesas || 0;
  const taxaPoupanca = kpis.taxaPoupanca || 0;
  const margemLucro = kpis.margemLucro || 0;
  const healthScore = diagnostics.healthScore || 70;
  const scoreFactors = diagnostics.scoreFactors || [];

  // 1. Escala para Gráfico Mensal
  const maxMonthlyVal = Math.max(
    ...monthlyHistory.map((m: any) => Math.max(m.receitas, m.despesas)),
    100
  );

  // 2. Escala para Gráfico por Dia da Semana
  const maxDowVal = Math.max(...dayOfWeekExpenses.map((d: any) => d.total), 50);

  // 3. Donut Chart Math (Categorias de Despesa)
  const donutRadius = 60;
  const donutStrokeWidth = 22;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedPercent = 0;

  // 4. Line Chart Math (Tendência Diária de Saldo/Despesas)
  const chartWidth = SCREEN_WIDTH - 72;
  const chartHeight = 110;
  const maxTrendVal = Math.max(
    ...dailyTrend.map((d: any) => Math.max(d.receitas, d.despesas)),
    10
  );

  // Montagem do SVG Path para a linha de despesa diária
  const buildTrendPath = (key: 'despesas' | 'receitas') => {
    if (dailyTrend.length < 2) return '';
    const stepX = chartWidth / (dailyTrend.length - 1);
    return dailyTrend.reduce((acc: string, point: any, index: number) => {
      const x = index * stepX;
      const y = chartHeight - (point[key] / maxTrendVal) * (chartHeight - 20) - 10;
      return index === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  const trendDespesasPath = buildTrendPath('despesas');
  const trendReceitasPath = buildTrendPath('receitas');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <BackArrowIcon size={20} color="#111111" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Estatísticas Globais</Text>
          <Text style={styles.headerSubtitle}>Analytics 360º de Desempenho</Text>
        </View>

        {/* Badge Clicável do Score de Saúde Financeira */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.headerScorePill}
          onPress={openScoreModal}
        >
          <SparkleIcon size={13} color="#008570" />
          <View>
            <Text style={styles.headerScoreLabel}>SAÚDE</Text>
            <Text style={styles.headerScoreText}>{healthScore}/100</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Period Filter Pills */}
      <View style={styles.periodBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScrollContent}
        >
          {(
            [
              { id: 'diario', label: 'Hoje' },
              { id: 'mensal', label: 'Este Mês' },
              { id: 'trimestral', label: 'Trimestre' },
              { id: 'anual', label: 'Ano Atual' },
              { id: 'todos', label: 'Todo o Histórico' },
            ] as const
          ).map((item) => {
            const isSelected = period === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                style={[
                  styles.periodChip,
                  isSelected && styles.periodChipActive,
                ]}
                onPress={() => setPeriod(item.id)}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    isSelected && styles.periodChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.loadingText}>A processar análise financeira completa...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 36, 54) },
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
          {/* SECTION 1: HERO METRICS CARD */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroLabel}>RESULTADO LÍQUIDO</Text>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: saldo >= 0 ? '#E8F5E9' : '#FFEBEE' },
                ]}
              >
                <Text
                  style={[
                    styles.heroBadgeText,
                    { color: saldo >= 0 ? '#2E7D32' : '#D32F2F' },
                  ]}
                >
                  {saldo >= 0 ? 'Lucro Acumulado' : 'Défice Orçamental'}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.heroBigValue,
                { color: saldo >= 0 ? '#111111' : '#D32F2F' },
              ]}
            >
              {formatEuro(saldo)}
            </Text>

            {/* In & Out Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardItem}>
                <View style={styles.kpiItemHeader}>
                  <View style={[styles.kpiDot, { backgroundColor: '#008570' }]} />
                  <Text style={styles.kpiCardLabel}>Entradas</Text>
                </View>
                <Text style={[styles.kpiCardValue, { color: '#008570' }]}>
                  +{formatEuro(receitas)}
                </Text>
                <Text style={styles.kpiSubText}>
                  {kpis.countReceitas || 0} recebimentos (méd. {formatEuro(kpis.ticketMedioReceita)})
                </Text>
              </View>

              <View style={styles.kpiCardItem}>
                <View style={styles.kpiItemHeader}>
                  <View style={[styles.kpiDot, { backgroundColor: '#1E1E1E' }]} />
                  <Text style={styles.kpiCardLabel}>Saídas</Text>
                </View>
                <Text style={[styles.kpiCardValue, { color: '#111111' }]}>
                  -{formatEuro(despesas)}
                </Text>
                <Text style={styles.kpiSubText}>
                  {kpis.countDespesas || 0} compras (méd. {formatEuro(kpis.ticketMedioDespesa)})
                </Text>
              </View>
            </View>

            {/* Savings & Margins Bar */}
            <View style={styles.heroBarSection}>
              <View style={styles.heroBarRow}>
                <Text style={styles.heroBarTitle}>Taxa de Poupança & Retenção</Text>
                <Text style={styles.heroBarPercent}>{taxaPoupanca}%</Text>
              </View>
              <View style={styles.heroBarBg}>
                <View
                  style={[
                    styles.heroBarFill,
                    {
                      width: `${Math.min(Math.max(taxaPoupanca, 0), 100)}%`,
                      backgroundColor:
                        taxaPoupanca >= 25 ? '#008570' : taxaPoupanca > 0 ? '#ED6C02' : '#D32F2F',
                    },
                  ]}
                />
              </View>
              <View style={styles.heroBarFooter}>
                <Text style={styles.heroFooterText}>
                  Margem de Lucro: <Text style={{ fontFamily: FontFamily.bold }}>{margemLucro}%</Text>
                </Text>
                <Text style={styles.heroFooterText}>
                  Pendentes: <Text style={{ fontFamily: FontFamily.bold, color: '#D32F2F' }}>{formatEuro(kpis.totalPendentes)}</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 2: GRÁFICO CIRCULAR / DONUT CHART DE CATEGORIAS */}
          {categoriesExpenses.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <CardIcon size={16} color="#111111" active />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Proporção de Despesas (Donut)</Text>
                  <Text style={styles.sectionSubTitle}>Visualização circular dos gastos</Text>
                </View>
              </View>

              <View style={styles.donutRow}>
                {/* SVG Donut */}
                <View style={styles.donutChartWrap}>
                  <Svg width={160} height={160} viewBox="0 0 160 160">
                    <G rotation="-90" origin="80, 80">
                      {/* Background circle */}
                      <Circle
                        cx="80"
                        cy="80"
                        r={donutRadius}
                        stroke="#EFEFF4"
                        strokeWidth={donutStrokeWidth}
                        fill="none"
                      />
                      {/* Segments */}
                      {categoriesExpenses.slice(0, 6).map((cat: any, idx: number) => {
                        const strokeDasharray = `${(cat.percentage / 100) * donutCircumference} ${donutCircumference}`;
                        const strokeDashoffset = -((accumulatedPercent / 100) * donutCircumference);
                        accumulatedPercent += cat.percentage;

                        return (
                          <Circle
                            key={idx}
                            cx="80"
                            cy="80"
                            r={donutRadius}
                            stroke={PALETTE[idx % PALETTE.length]}
                            strokeWidth={donutStrokeWidth}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="none"
                          />
                        );
                      })}
                    </G>
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutCenterLabel}>TOTAL</Text>
                    <Text style={styles.donutCenterValue} numberOfLines={1}>
                      {formatEuro(despesas)}
                    </Text>
                  </View>
                </View>

                {/* Donut Legend */}
                <View style={styles.donutLegend}>
                  {categoriesExpenses.slice(0, 5).map((cat: any, idx: number) => (
                    <View key={idx} style={styles.donutLegendItem}>
                      <View
                        style={[
                          styles.donutLegendBullet,
                          { backgroundColor: PALETTE[idx % PALETTE.length] },
                        ]}
                      />
                      <Text style={styles.donutLegendText} numberOfLines={1}>
                        {cat.category}
                      </Text>
                      <Text style={styles.donutLegendPercent}>{cat.percentage}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* SECTION 3: EVOLUÇÃO MENSAL (BARRAS RECEITAS VS DESPESAS) */}
          {monthlyHistory.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <BarsIcon size={16} color="#111111" active />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Evolução Histórica Mensal</Text>
                  <Text style={styles.sectionSubTitle}>Comparativo de Receitas vs Despesas</Text>
                </View>
              </View>

              {/* Chart Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#008570' }]} />
                  <Text style={styles.legendText}>Receitas</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#1E1E1E' }]} />
                  <Text style={styles.legendText}>Despesas</Text>
                </View>
              </View>

              {/* Bar Chart Visualizer */}
              <View style={styles.chartContainer}>
                {monthlyHistory.map((item: any, idx: number) => {
                  const recHeight = Math.max(Math.round((item.receitas / maxMonthlyVal) * 120), 6);
                  const despHeight = Math.max(Math.round((item.despesas / maxMonthlyVal) * 120), 6);

                  return (
                    <View key={idx} style={styles.chartColumnWrap}>
                      <View style={styles.chartBarsGroup}>
                        <View style={[styles.chartBar, styles.barReceita, { height: recHeight }]} />
                        <View style={[styles.chartBar, styles.barDespesa, { height: despHeight }]} />
                      </View>
                      <Text style={styles.chartMonthLabel}>{item.month}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION 4: TENDÊNCIA TEMPORAL DE FLUXO (ÁREA / LINHA SVG) */}
          {dailyTrend.length > 1 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <SparkleIcon size={16} color="#008570" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Trajetória de Fluxo Diário</Text>
                  <Text style={styles.sectionSubTitle}>Tendência dos últimos 14 dias</Text>
                </View>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#008570' }]} />
                  <Text style={styles.legendText}>Receitas</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#1E1E1E' }]} />
                  <Text style={styles.legendText}>Despesas</Text>
                </View>
              </View>

              <View style={styles.lineChartWrap}>
                <Svg width={chartWidth} height={chartHeight}>
                  {/* Linha de despesas */}
                  {trendDespesasPath ? (
                    <Path
                      d={trendDespesasPath}
                      stroke="#111111"
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : null}

                  {/* Linha de receitas */}
                  {trendReceitasPath ? (
                    <Path
                      d={trendReceitasPath}
                      stroke="#008570"
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : null}
                </Svg>

                <View style={styles.lineChartLabelsRow}>
                  <Text style={styles.lineLabelText}>{dailyTrend[0]?.label}</Text>
                  <Text style={styles.lineLabelText}>
                    {dailyTrend[Math.floor(dailyTrend.length / 2)]?.label}
                  </Text>
                  <Text style={styles.lineLabelText}>
                    {dailyTrend[dailyTrend.length - 1]?.label}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* SECTION 5: GASTOS POR DIA DA SEMANA (SEG A DOM) */}
          {dayOfWeekExpenses.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <BarsIcon size={16} color="#111111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Padrão por Dia da Semana</Text>
                  <Text style={styles.sectionSubTitle}>Em que dias gasta mais dinheiro</Text>
                </View>
              </View>

              <View style={styles.dowChartContainer}>
                {dayOfWeekExpenses.map((d: any, idx: number) => {
                  const barH = Math.max(Math.round((d.total / maxDowVal) * 90), 4);
                  const isPeak = d.total === maxDowVal && d.total > 0;

                  return (
                    <View key={idx} style={styles.dowColumn}>
                      <Text style={[styles.dowPercent, isPeak && { color: '#008570', fontFamily: FontFamily.bold }]}>
                        {d.percentage}%
                      </Text>
                      <View style={styles.dowBarTrack}>
                        <View
                          style={[
                            styles.dowBarFill,
                            {
                              height: barH,
                              backgroundColor: isPeak ? '#008570' : '#1E1E1E',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.dowLabel, isPeak && { color: '#111111', fontFamily: FontFamily.bold }]}>
                        {d.day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION 6: TOP 5 MAIORES DESPESAS INDIVIDUAIS */}
          {topExpenses.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <CardIcon size={16} color="#111111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Maiores Despesas do Período</Text>
                  <Text style={styles.sectionSubTitle}>As transações mais avultadas</Text>
                </View>
              </View>

              <View style={styles.topExpensesList}>
                {topExpenses.map((exp: any, idx: number) => (
                  <View key={idx} style={styles.topExpItem}>
                    <View style={styles.topExpRank}>
                      <Text style={styles.topExpRankText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.topExpInfo}>
                      <Text style={styles.topExpName} numberOfLines={1}>
                        {exp.name}
                      </Text>
                      <Text style={styles.topExpCategory}>{exp.category || 'Geral'}</Text>
                    </View>
                    <Text style={styles.topExpAmount}>-{formatEuro(exp.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* SECTION 7: CATEGORY DISTRIBUTION WITH TABS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconBadge}>
                <CardIcon size={16} color="#111111" active />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionMainTitle}>Detalhamento por Categorias</Text>
                <Text style={styles.sectionSubTitle}>Classificação e peso percentual</Text>
              </View>
            </View>

            {/* Toggle Tabs */}
            <View style={styles.toggleTabs}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.tabToggleBtn,
                  activeCategoryTab === 'despesas' && styles.tabToggleBtnActive,
                ]}
                onPress={() => setActiveCategoryTab('despesas')}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    activeCategoryTab === 'despesas' && styles.tabToggleTextActive,
                  ]}
                >
                  Despesas ({categoriesExpenses.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.tabToggleBtn,
                  activeCategoryTab === 'receitas' && styles.tabToggleBtnActive,
                ]}
                onPress={() => setActiveCategoryTab('receitas')}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    activeCategoryTab === 'receitas' && styles.tabToggleTextActive,
                  ]}
                >
                  Receitas ({categoriesRevenues.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* List */}
            {activeCategoryTab === 'despesas' ? (
              categoriesExpenses.length === 0 ? (
                <Text style={styles.emptyText}>Sem registos de despesas no período selecionado.</Text>
              ) : (
                <View style={styles.catItemsList}>
                  {categoriesExpenses.map((cat: any, i: number) => (
                    <View key={i} style={styles.catRow}>
                      <View style={styles.catRowTop}>
                        <Text style={styles.catTitle} numberOfLines={1}>
                          {cat.category}
                        </Text>
                        <View style={styles.catValuesWrap}>
                          <Text style={styles.catAmountText}>{formatEuro(cat.total)}</Text>
                          <Text style={styles.catPercentBadge}>{cat.percentage}%</Text>
                        </View>
                      </View>
                      <View style={styles.catProgressBarBg}>
                        <View
                          style={[
                            styles.catProgressBarFill,
                            {
                              width: `${Math.min(cat.percentage, 100)}%`,
                              backgroundColor: PALETTE[i % PALETTE.length],
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.catDetailsText}>
                        {cat.count} registos • média de {formatEuro(cat.averageTicket)} / compra
                      </Text>
                    </View>
                  ))}
                </View>
              )
            ) : categoriesRevenues.length === 0 ? (
              <Text style={styles.emptyText}>Sem registos de receitas no período selecionado.</Text>
            ) : (
              <View style={styles.catItemsList}>
                {categoriesRevenues.map((cat: any, i: number) => (
                  <View key={i} style={styles.catRow}>
                    <View style={styles.catRowTop}>
                      <Text style={styles.catTitle} numberOfLines={1}>
                        {cat.category}
                      </Text>
                      <View style={styles.catValuesWrap}>
                        <Text style={[styles.catAmountText, { color: '#008570' }]}>
                          +{formatEuro(cat.total)}
                        </Text>
                        <Text style={styles.catPercentBadge}>{cat.percentage}%</Text>
                      </View>
                    </View>
                    <View style={styles.catProgressBarBg}>
                      <View
                        style={[
                          styles.catProgressBarFill,
                          { width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: '#008570' },
                        ]}
                      />
                    </View>
                    <Text style={styles.catDetailsText}>{cat.count} entradas registadas</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* SECTION 8: SMART PROJECTIONS & FORECAST */}
          {projections.currentDay && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <SparkleIcon size={16} color="#008570" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>
                    {projections.periodTitle || 'Previsão Financeira & Ritmo'}
                  </Text>
                  <Text style={styles.sectionSubTitle}>
                    {projections.periodSubtitle ||
                      `Dia ${projections.currentDay} de ${projections.lastDayOfMonth} (${projections.daysRemaining} dias até fecho)`}
                  </Text>
                </View>
              </View>

              <View style={styles.forecastGrid}>
                <View style={styles.forecastBox}>
                  <Text style={styles.forecastLabel}>RITMO DIÁRIO DE GASTO</Text>
                  <Text style={styles.forecastValue}>
                    {formatEuro(projections.mediaDiariaDespesa)}
                  </Text>
                  <Text style={styles.forecastSub}>média gasta / dia</Text>
                </View>

                <View style={styles.forecastBox}>
                  <Text style={styles.forecastLabel}>
                    {projections.projectionCardLabel || 'PROJEÇÃO TOTAL'}
                  </Text>
                  <Text style={[styles.forecastValue, { color: '#D32F2F' }]}>
                    {formatEuro(projections.projecaoDespesasFimMes)}
                  </Text>
                  <Text style={styles.forecastSub}>despesas estimadas</Text>
                </View>
              </View>

              <View style={styles.forecastResultBox}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.forecastResultLabel}>
                    {projections.projectionResultLabel || 'Saldo Estimado no Fecho'}
                  </Text>
                  <Text style={styles.forecastResultSub}>
                    Receitas projetadas: {formatEuro(projections.projecaoReceitasFimMes)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.forecastResultValue,
                    { color: projections.projecaoSaldoFimMes >= 0 ? '#008570' : '#D32F2F' },
                  ]}
                >
                  {formatEuro(projections.projecaoSaldoFimMes)}
                </Text>
              </View>
            </View>
          )}

          {/* SECTION 9: RECURRING COSTS & PAYMENT METHODS */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconBadge}>
                <TrayIcon size={16} color="#111111" active />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionMainTitle}>Custos Fixos & Recorrentes</Text>
                <Text style={styles.sectionSubTitle}>Subscrições, rendas e encargos periódicos</Text>
              </View>
            </View>

            <View style={styles.recorrenteRow}>
              <View style={styles.recorrenteCol}>
                <Text style={styles.recorrenteBigVal}>{formatEuro(recorrentes.totalRecorrentes)}</Text>
                <Text style={styles.recorrenteSubLabel}>
                  {recorrentes.countRecorrentes || 0} despesas recorrentes ativas
                </Text>
              </View>
              <View style={styles.recorrenteBadge}>
                <Text style={styles.recorrenteBadgePercent}>{recorrentes.percentagemReceita || 0}%</Text>
                <Text style={styles.recorrenteBadgeLabel}>do rendimento</Text>
              </View>
            </View>

            <Text style={styles.recorrenteTip}>
              {recorrentes.percentagemReceita <= 50
                ? '✅ Excelente: Os seus custos fixos estão dentro da regra dourada dos 50%.'
                : '⚠️ Atenção: Os seus custos fixos superam 50% do seu rendimento total.'}
            </Text>

            {/* Lista dos Principais Encargos Fixos Detetados */}
            {recorrentes.items && recorrentes.items.length > 0 && (
              <View style={styles.recorrentesListWrap}>
                <Text style={styles.recorrentesListTitle}>ENCARGOS FIXOS IDENTIFICADOS</Text>
                {recorrentes.items.map((item: any, idx: number) => (
                  <View key={idx} style={styles.recorrenteItemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.recorrenteItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.isAutoDetected ? (
                          <View style={styles.autoDetectBadge}>
                            <Text style={styles.autoDetectBadgeText}>Auto-detetado</Text>
                          </View>
                        ) : (
                          <View style={styles.explicitBadge}>
                            <Text style={styles.explicitBadgeText}>Recorrente</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.recorrenteItemSub}>
                        {item.category} • {item.count > 0 ? `${item.count} ${item.count === 1 ? 'pagamento' : 'pagamentos'}` : 'Compromisso ativo'} • {formatEuro(item.unitAmount ?? item.avgAmount)}/mês
                      </Text>
                    </View>
                    <Text style={styles.recorrenteItemTotal}>
                      {formatEuro(item.count > 0 ? item.total : (item.unitAmount ?? item.avgAmount))}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* SECTION 10: PAYMENT METHODS */}
          {paymentMethods.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <CardIcon size={16} color="#111111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Métodos de Pagamento</Text>
                  <Text style={styles.sectionSubTitle}>Canais mais utilizados</Text>
                </View>
              </View>

              <View style={styles.methodsList}>
                {paymentMethods.map((m: any, idx: number) => (
                  <View key={idx} style={styles.methodItem}>
                    <View style={styles.methodInfoRow}>
                      <Text style={styles.methodName}>{m.method || 'Não especificado'}</Text>
                      <Text style={styles.methodAmount}>{formatEuro(m.total)}</Text>
                    </View>
                    <View style={styles.methodProgressBg}>
                      <View
                        style={[styles.methodProgressFill, { width: `${Math.min(m.percentage, 100)}%` }]}
                      />
                    </View>
                    <Text style={styles.methodSub}>{m.count} movimentos ({m.percentage}%)</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* SECTION 11: EMERGENCY FUND DIAGNOSTIC */}
          {diagnostics.reservaRecomendada3Meses && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconBadge}>
                  <SparkleIcon size={16} color="#008570" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionMainTitle}>Fundo de Reserva Recomendado</Text>
                  <Text style={styles.sectionSubTitle}>Resiliência financeira contra imprevistos</Text>
                </View>
              </View>

              <View style={styles.reservaGrid}>
                <View style={styles.reservaBox}>
                  <Text style={styles.reservaBoxLabel}>RESERVA 3 MESES</Text>
                  <Text style={styles.reservaBoxValue}>{formatEuro(diagnostics.reservaRecomendada3Meses)}</Text>
                </View>
                <View style={styles.reservaBox}>
                  <Text style={styles.reservaBoxLabel}>RESERVA 6 MESES</Text>
                  <Text style={styles.reservaBoxValue}>{formatEuro(diagnostics.reservaRecomendada6Meses)}</Text>
                </View>
              </View>

              <View style={styles.reservaStatusWrap}>
                <View style={styles.reservaStatusTop}>
                  <Text style={styles.reservaStatusLabel}>Cobertura Atual com Saldo Disponível</Text>
                  <Text style={styles.reservaStatusPercent}>{diagnostics.coberturaReserva}%</Text>
                </View>
                <View style={styles.reservaProgressBarBg}>
                  <View
                    style={[
                      styles.reservaProgressBarFill,
                      { width: `${Math.min(diagnostics.coberturaReserva, 100)}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* MODAL EXPLICATIVO DO SCORE DE SAÚDE FINANCEIRA (VERDADEIRO BOTTOM SHEET) */}
      <Modal
        visible={scoreModalRendered}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={closeScoreModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeScoreModal}>
            <Animated.View
              style={[
                styles.modalBackdrop,
                { opacity: scoreFadeAnim },
              ]}
            />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.modalSheet,
              {
                paddingBottom: Math.max(insets.bottom + 20, 32),
                transform: [{ translateY: scoreSlideAnim }],
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            <View style={styles.modalSheetHeader}>
              <View style={styles.modalSheetBadge}>
                <SparkleIcon size={16} color="#008570" />
                <Text style={styles.modalSheetBadgeText}>ÍNDICE VAULT</Text>
              </View>

            </View>

            <Text style={styles.modalSheetTitle}>
              O que é a pontuação {healthScore}/100?
            </Text>
            <Text style={styles.modalSheetSubtitle}>
              É o <Text style={{ fontFamily: FontFamily.bold }}>Score de Saúde Financeira</Text> calculado em tempo real pelo algoritmo do Vault com base na estabilidade do seu capital.
            </Text>

            {/* Score Big Display */}
            <View style={styles.modalScoreCard}>
              <Text style={styles.modalScoreNumber}>{healthScore}</Text>
              <Text style={styles.modalScoreScale}>de 100 pontos</Text>
              <Text style={styles.modalScoreVerdict}>
                {healthScore >= 80
                  ? 'Finanças Blindadas & Excelente Saúde'
                  : healthScore >= 60
                    ? 'Saúde Equilibrada com Boa Margem'
                    : 'Atenção: Risco de Liquidez Elevado'}
              </Text>
            </View>

            {/* Factors Breakdown */}
            <Text style={styles.factorsTitle}>Fatores que Compõem a sua Pontuação:</Text>
            <View style={styles.factorsList}>
              {scoreFactors.map((factor: any, i: number) => (
                <View key={i} style={styles.factorItem}>
                  <View
                    style={[
                      styles.factorDot,
                      { backgroundColor: factor.points >= 0 ? '#008570' : '#D32F2F' },
                    ]}
                  />
                  <Text style={styles.factorName}>{factor.name}</Text>
                  <Text
                    style={[
                      styles.factorImpact,
                      { color: factor.points >= 0 ? '#008570' : '#D32F2F' },
                    ]}
                  >
                    {factor.impact}
                  </Text>
                </View>
              ))}
            </View>

            {/* <TouchableOpacity
              activeOpacity={0.8}
              style={styles.modalOkBtn}
              onPress={closeScoreModal}
            >
              <Text style={styles.modalOkBtnText}>Entendido</Text>
            </TouchableOpacity> */}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

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
    fontSize: 18,
    color: '#111111',
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  headerScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  headerScoreLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: '#008570',
  },
  headerScoreText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#008570',
  },
  periodBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  periodScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  periodChipActive: {
    backgroundColor: '#111111',
  },
  periodChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#666666',
  },
  periodChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
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
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#8E8E93',
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
  heroBigValue: {
    fontFamily: FontFamily.bold,
    fontSize: 36,
    marginTop: 8,
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  kpiCardItem: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 14,
  },
  kpiItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiCardLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#666666',
  },
  kpiCardValue: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  kpiSubText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 14,
  },
  heroBarSection: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 16,
  },
  heroBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroBarTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#333333',
  },
  heroBarPercent: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  heroBarBg: {
    height: 8,
    backgroundColor: '#EFEFF4',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  heroBarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#666666',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionMainTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
  },
  sectionSubTitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  donutChartWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#8E8E93',
    letterSpacing: 0.6,
  },
  donutCenterValue: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
    maxWidth: 90,
    textAlign: 'center',
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donutLegendBullet: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  donutLegendText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  donutLegendPercent: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#111111',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingLeft: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#666666',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  chartColumnWrap: {
    alignItems: 'center',
    gap: 8,
  },
  chartBarsGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 120,
  },
  chartBar: {
    width: 12,
    borderRadius: 4,
  },
  barReceita: {
    backgroundColor: '#008570',
  },
  barDespesa: {
    backgroundColor: '#1E1E1E',
  },
  chartMonthLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#8E8E93',
  },
  lineChartWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineChartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  lineLabelText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
  },
  dowChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  dowColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dowPercent: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#8E8E93',
  },
  dowBarTrack: {
    height: 90,
    width: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dowBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  dowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#666666',
  },
  topExpensesList: {
    gap: 12,
  },
  topExpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  topExpRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topExpRankText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#111111',
  },
  topExpInfo: {
    flex: 1,
  },
  topExpName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#111111',
  },
  topExpCategory: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  topExpAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#D32F2F',
  },
  toggleTabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  tabToggleText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#8E8E93',
  },
  tabToggleTextActive: {
    fontFamily: FontFamily.bold,
    color: '#111111',
  },
  catItemsList: {
    gap: 14,
  },
  catRow: {
    gap: 6,
  },
  catRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#222222',
    flex: 1,
  },
  catValuesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catAmountText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  catPercentBadge: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
  },
  catProgressBarBg: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  catDetailsText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
  },
  forecastGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  forecastBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  forecastLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#8E8E93',
    marginBottom: 6,
  },
  forecastValue: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#111111',
  },
  forecastSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  forecastResultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  forecastResultLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#222222',
  },
  forecastResultSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    maxWidth: SCREEN_WIDTH * 0.55,
  },
  forecastResultValue: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
  },
  recorrenteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recorrenteCol: {
    flex: 1,
  },
  recorrenteBigVal: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: '#111111',
  },
  recorrenteSubLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  recorrenteBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EFEFF4',
  },
  recorrenteBadgePercent: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: '#111111',
  },
  recorrenteBadgeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: '#8E8E93',
  },
  recorrenteTip: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
  recorrentesListWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4',
    gap: 10,
  },
  recorrentesListTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  recorrenteItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  recorrenteItemName: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#111111',
  },
  recorrenteItemSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  recorrenteItemTotal: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#111111',
  },
  autoDetectBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoDetectBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#2E7D32',
  },
  explicitBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  explicitBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#1565C0',
  },
  methodsList: {
    gap: 12,
  },
  methodItem: {
    gap: 4,
  },
  methodInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodName: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#222222',
  },
  methodAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
  },
  methodProgressBg: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  methodProgressFill: {
    height: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 3,
  },
  methodSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#8E8E93',
  },
  reservaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reservaBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  reservaBoxLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: '#8E8E93',
    marginBottom: 4,
  },
  reservaBoxValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#111111',
  },
  reservaStatusWrap: {
    gap: 6,
  },
  reservaStatusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reservaStatusLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#666666',
  },
  reservaStatusPercent: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#008570',
  },
  reservaProgressBarBg: {
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  reservaProgressBarFill: {
    height: '100%',
    backgroundColor: '#008570',
    borderRadius: 4,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  modalSheetBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#008570',
    letterSpacing: 0.6,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#111111',
  },
  modalSheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  modalScoreCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginVertical: 4,
  },
  modalScoreNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 52,
    color: '#008570',
  },
  modalScoreScale: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#8E8E93',
  },
  modalScoreVerdict: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#111111',
    marginTop: 8,
  },
  factorsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#111111',
    marginTop: 6,
  },
  factorsList: {
    gap: 10,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  factorName: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#333333',
    flex: 1,
  },
  factorImpact: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
  modalOkBtn: {
    backgroundColor: '#111111',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalOkBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
