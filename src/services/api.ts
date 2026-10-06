import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuthToken, saveSession, clearSession } from './session';

// Determina a URL da API (Nuvem em Produção, dinâmico em desenvolvimento)
const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Em modo de desenvolvimento local (Expo Go / simulador)
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:3001`;
    }
    return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
  }

  // Em build de Produção (APK final instalado no telemóvel)
  return 'https://api.zdocks.me';
};

export const API_BASE_URL = getBaseUrl();

/**
 * Cliente HTTP autenticado com injeção automática de Bearer Token
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export interface TransactionDTO {
  id: string;
  name: string;
  amount: string;
  rawAmount: number;
  type: 'despesa' | 'receita';
  category: string;
  method: string;
  date: string;
  rawDate: string;
  description: string;
  avatarChar: string;
  isPaid: boolean;
  status: 'pago' | 'pendente' | 'atrasada';
  isRecurring: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  restante: string;
  rawRestante: number;
  despesas: string;
  rawDespesas: number;
  lucro: string;
  rawLucro: number;
  pendentes: string;
  rawPendentes: number;
  receitas: string;
  rawReceitas: number;
}

// ============================================================================
// SERVIÇOS DE AUTENTICAÇÃO E OTP
// ============================================================================
export const authApi = {
  // Envia código OTP de 6 dígitos para o email exclusivo
  sendOtp: async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.warn('⚠️ [API Send OTP Fallback]:', error.message);
      return { success: false, error: 'Não foi possível ligar ao servidor API.' };
    }
  },

  // Valida o código OTP na base de dados e grava a sessão de forma segura
  verifyOtp: async (email: string, code: string) => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });
    } catch (error: any) {
      console.warn('⚠️ [API Verify OTP Connection Error]:', error.message);
      throw new Error('Não foi possível conectar ao servidor backend.');
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Código de verificação incorreto ou expirado.');
    }

    if (data.token && data.user) {
      // Grava o token e utilizador de forma segura e encriptada
      await saveSession(data.token, data.user);
    }

    return data;
  },

  // Valida a sessão persistente guardada
  checkSession: async (): Promise<{ isValid: boolean; user?: any }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { isValid: false };

      const response = await authFetch(`${API_BASE_URL}/api/auth/me`);
      if (response.status === 401) {
        await clearSession();
        return { isValid: false };
      }

      const data = await response.json();
      if (data.success && data.user) {
        return { isValid: true, user: data.user };
      }
      return { isValid: false };
    } catch (error) {
      return { isValid: false };
    }
  },

  // Terminar sessão
  logout: async () => {
    await clearSession();
  },
};

// ============================================================================
// SERVIÇOS DE TRANSAÇÕES (DESPESAS, RECEITAS E PENDENTES) COM ISOLAMENTO DE USER
// ============================================================================
export const transactionsApi = {
  // Lista transações do utilizador autenticado
  getTransactions: async (params?: {
    type?: 'despesa' | 'receita' | 'pendentes';
    search?: string;
    category?: string;
    date?: string;
    limit?: number | string;
    offset?: number;
  }): Promise<{ success: boolean; items: TransactionDTO[]; error?: string }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.category) queryParams.append('category', params.category);
      if (params?.date) queryParams.append('date', params.date);
      if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));
      if (params?.offset !== undefined) queryParams.append('offset', String(params.offset));

      const url = `${API_BASE_URL}/api/transactions?${queryParams.toString()}`;
      const response = await authFetch(url);
      const data = await response.json();
      if (data.success) {
        return { success: true, items: data.items };
      }
      return { success: false, items: [], error: data.error };
    } catch (error: any) {
      console.warn('⚠️ [API Get Transactions Fallback]:', error.message);
      return { success: false, items: [], error: error.message };
    }
  },

  // Cria uma nova transação associada ao utilizador autenticado
  createTransaction: async (tx: {
    type: 'despesa' | 'receita';
    name: string;
    amount: number;
    category?: string;
    method?: string;
    isPaid: boolean;
    isRecurring?: boolean;
    paymentDate?: string;
    description?: string;
  }) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/transactions`, {
        method: 'POST',
        body: JSON.stringify(tx),
      });
      return await response.json();
    } catch (error: any) {
      console.warn('⚠️ [API Create Transaction Fallback]:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Confirma pagamento de despesa pendente (Slide to Confirm)
  confirmPayment: async (id: string, data: { method: string; paymentDate?: string }) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/transactions/${id}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      console.warn('⚠️ [API Confirm Payment Fallback]:', error.message);
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// SERVIÇOS DE DASHBOARD E SUMÁRIO ISOLADO POR UTILIZADOR
// ============================================================================
export const dashboardApi = {
  getSummary: async (period?: string): Promise<{ success: boolean; data?: DashboardSummary; error?: string }> => {
    try {
      const url = period ? `${API_BASE_URL}/api/dashboard/summary?period=${period}` : `${API_BASE_URL}/api/dashboard/summary`;
      const response = await authFetch(url);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.warn('⚠️ [API Dashboard Summary Fallback]:', error.message);
      return { success: false, error: error.message };
    }
  },

  getStats: async (period?: string): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> => {
    try {
      const url = period ? `${API_BASE_URL}/api/dashboard/stats?period=${period}` : `${API_BASE_URL}/api/dashboard/stats`;
      const response = await authFetch(url);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.warn('⚠️ [API Dashboard Stats Fallback]:', error.message);
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// SERVIÇOS DE CATEGORIAS E ENTIDADES
// ============================================================================
export const metadataApi = {
  getCategories: async (type?: 'despesa' | 'receita') => {
    try {
      const url = `${API_BASE_URL}/api/categories${type ? `?type=${type}` : ''}`;
      const response = await authFetch(url);
      return await response.json();
    } catch (error: any) {
      return { success: false, categories: [] };
    }
  },

  getEntities: async (type?: 'fornecedor' | 'funcionario') => {
    try {
      const url = `${API_BASE_URL}/api/entities${type ? `?type=${type}` : ''}`;
      const response = await authFetch(url);
      return await response.json();
    } catch (error: any) {
      return { success: false, entities: [] };
    }
  },

  createEntity: async (name: string, type: 'fornecedor' | 'funcionario', nif?: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/entities`, {
        method: 'POST',
        body: JSON.stringify({ name, type, nif }),
      });
      return await response.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  deleteEntity: async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/entities/${id}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  createCategory: async (name: string, type: 'despesa' | 'receita') => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        body: JSON.stringify({ name, type }),
      });
      return await response.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  deleteCategory: async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/categories/${id}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export const categoriesApi = {
  getCategories: metadataApi.getCategories,
  createCategory: metadataApi.createCategory,
  deleteCategory: metadataApi.deleteCategory,
};

export const entitiesApi = {
  getEntities: metadataApi.getEntities,
  createEntity: metadataApi.createEntity,
  deleteEntity: metadataApi.deleteEntity,
};

// ============================================================================
// SERVIÇOS DE ATUALIZAÇÃO AUTOMÁTICA DA APLICAÇÃO (SEM PLAY STORE)
// ============================================================================
export interface AppVersionInfo {
  success: boolean;
  version: string;
  versionCode: number;
  releaseDate: string;
  title: string;
  notes: string[];
  downloadUrl: string;
}

export const appUpdatesApi = {
  checkVersion: async (): Promise<AppVersionInfo | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/app/version`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },
  getDownloadUrl: (): string => {
    return `${API_BASE_URL}/api/app/download`;
  },
};

// ============================================================================
// SERVIÇOS DE VAULT AI
// ============================================================================
export interface PurchaseAdviceDTO {
  score: number;
  verdict: string;
  tone: 'success' | 'warning' | 'danger';
  summary: string;
  contextAnalysis?: string | null;
  strategicRecommendation: string;
  savingsPlan: {
    recommendedAction: 'pronto' | 'prestacoes' | 'poupar_primeiro';
    monthsToSave: number;
    monthlyAmountToSave: number;
    explanation: string;
  };
  keyPoints: string[];
}

export const aiApi = {
  getPurchaseAdvice: async (data: {
    productName: string;
    price: number;
    paymentMethod: 'pronto' | 'prestacoes' | 'credito';
    installments?: number;
    monthlyPayment?: number;
    tan?: number;
    taeg?: number;
    commissions?: number;
    totalInterest?: number;
    mtic?: number;
    necessity: 'essencial' | 'importante' | 'superfluo';
    urgency: 'urgente' | 'moderada' | 'sem_pressa';
    context?: string;
  }): Promise<{
    success: boolean;
    advice?: PurchaseAdviceDTO;
    financialContext?: any;
    error?: string;
  }> => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/ai/purchase-advice`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      console.warn('⚠️ [API AI Advice Error]:', error.message);
      return { success: false, error: error.message };
    }
  },

  scanInvoice: async (imageBase64: string, mimeType: string = 'image/jpeg'): Promise<{
    success: boolean;
    invoice?: {
      supplier: string;
      total: number;
      date: string;
      category: string;
      description: string;
      taxNumber?: string | null;
      items?: string[];
    };
    error?: string;
  }> => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/ai/scan-invoice`, {
        method: 'POST',
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        if (response.status === 413) {
          return {
            success: false,
            error: 'O documento é demasiado grande. Por favor tente com um ficheiro mais leve ou com menor resolução.',
          };
        }
        return {
          success: false,
          error: `Erro de comunicação com o servidor (${response.status}).`,
        };
      }
    } catch (error: any) {
      console.warn('⚠️ [API Scan Invoice Error]:', error.message);
      return { success: false, error: error.message };
    }
  },

  chat: async (
    message: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    success: boolean;
    reply?: string;
    error?: string;
  }> => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      });
      return await response.json();
    } catch (error: any) {
      console.warn('⚠️ [API AI Chat Error]:', error.message);
      return { success: false, error: error.message };
    }
  },

  getUsage: async (): Promise<{
    success: boolean;
    limits?: {
      chat: { limit: number; used: number; remaining: number };
      scan: { limit: number; used: number; remaining: number };
      advisor: { limit: number; used: number; remaining: number };
    };
    error?: string;
  }> => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/ai/usage`);
      return await response.json();
    } catch (error: any) {
      console.warn('⚠️ [API AI Usage Error]:', error.message);
      return { success: false, error: error.message };
    }
  },
};


