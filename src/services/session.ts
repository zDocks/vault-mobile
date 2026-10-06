import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'vault_secure_auth_token_v1';
const USER_KEY = 'vault_secure_auth_user_v1';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatarChar: string;
}

// Armazenamento em memória para ambientes web ou sem keychain nativo
const memoryStore: { [key: string]: string } = {};

const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Guarda o token e os dados do utilizador de forma encriptada
 */
export async function saveSession(token: string, user: UserSession): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(TOKEN_KEY, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } else {
      memoryStore[TOKEN_KEY] = token;
      memoryStore[USER_KEY] = JSON.stringify(user);
    }
  } catch (error) {
    console.warn('⚠️ [Session Save Error]:', error);
  }
}

/**
 * Recupera o token de sessão ativo
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    if (isSecureStoreAvailable) {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
    return memoryStore[TOKEN_KEY] || null;
  } catch (error) {
    console.warn('⚠️ [Session Get Token Error]:', error);
    return null;
  }
}

/**
 * Recupera os dados do utilizador autenticado
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    let raw: string | null = null;
    if (isSecureStoreAvailable) {
      raw = await SecureStore.getItemAsync(USER_KEY);
    } else {
      raw = memoryStore[USER_KEY] || null;
    }

    if (raw) {
      return JSON.parse(raw);
    }
    return null;
  } catch (error) {
    console.warn('⚠️ [Session Get User Error]:', error);
    return null;
  }
}

/**
 * Elimina os dados da sessão (Logout seguro)
 */
export async function clearSession(): Promise<void> {
  try {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
    delete memoryStore[TOKEN_KEY];
    delete memoryStore[USER_KEY];
  } catch (error) {
    console.warn('⚠️ [Session Clear Error]:', error);
  }
}
