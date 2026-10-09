import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Detectar se está a correr no cliente de desenvolvimento Expo Go
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;

// No Android dentro do Expo Go (a partir do SDK 53), expo-notifications lança um erro nativo.
// Carregamos de forma segura com require() e protegemos com try/catch para garantir que
// funciona 100% no APK final / Development Build sem fazer crash no Expo Go.
if (!isExpoGo || Platform.OS !== 'android') {
  try {
    Notifications = require('expo-notifications');
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: Notifications?.AndroidNotificationPriority?.MAX ?? 2,
        }),
      });
    }
  } catch (err: any) {
    console.warn('⚠️ [expo-notifications indisponível no Expo Go Android]:', err?.message);
    Notifications = null;
  }
}

export const REMINDER_CHANNEL_ID = 'vault-reminders';

/**
 * Cria o canal de notificações de alta prioridade no Android.
 * lockscreenVisibility: PUBLIC garante que a notificação acende o ecrã
 * e é visível com o ecrã bloqueado e a aplicação totalmente fechada.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Lembretes de Pagamento',
      description: 'Avisos das datas limite de pagamento de faturas e despesas pendentes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#00D09E',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (err: any) {
    console.warn('⚠️ [Setup Notification Channel Error]:', err?.message);
  }
}

/**
 * Pede permissão ao utilizador para enviar notificações.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;

  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return requested.granted;
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ [Request Notification Permissions Error]:', err?.message);
    return false;
  }
}

/**
 * Inicializa os canais e pede permissões.
 */
export async function initNotifications(): Promise<void> {
  if (!Notifications) {
    console.log('ℹ️ [Notifications]: Modo Expo Go detetado. Lembretes serão simulados localmente (alertas reais no SO funcionam na build APK).');
    return;
  }
  await setupNotificationChannel();
  await requestNotificationPermissions();
}

export interface InvoiceReminderPayload {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // formato YYYY-MM-DD
}

/**
 * Agenda notificações automáticas para a data limite de uma fatura pendente:
 * - 2 dias antes (às 09:00)
 * - 1 dia antes (às 09:00)
 * - No próprio dia limite (às 09:00)
 *
 * Como são agendadas diretamente no AlarmManager (Android) e UserNotifications (iOS),
 * disparam mesmo com a aplicação totalmente fechada ou o telemóvel bloqueado.
 */
export async function scheduleInvoicePaymentReminders(invoice: InvoiceReminderPayload): Promise<void> {
  if (!invoice.dueDate) return;

  if (!Notifications) {
    console.log(`🔔 [Lembrete de Pagamento]: Agendado virtualmente para ${invoice.name} (${invoice.amount}€) com data limite ${invoice.dueDate}. (No APK final, acorda o ecrã bloqueado)`);
    return;
  }

  try {
    const hasPerm = await requestNotificationPermissions();
    if (!hasPerm) {
      console.warn('⚠️ [Notifications]: Permissão de notificações não concedida.');
      return;
    }

    const parts = invoice.dueDate.split('-');
    if (parts.length !== 3) return;

    const dueYear = parseInt(parts[0], 10);
    const dueMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    const dueDay = parseInt(parts[2], 10);

    const now = new Date();
    const formattedAmount = Number(invoice.amount).toFixed(2).replace('.', ',');

    // Offsets em dias: -2 (2 dias antes), -1 (1 dia antes), 0 (no dia)
    const offsets = [-2, -1, 0];

    for (const offset of offsets) {
      const scheduledDate = new Date(dueYear, dueMonth, dueDay, 9, 0, 0, 0);
      scheduledDate.setDate(scheduledDate.getDate() + offset);

      let targetTime = scheduledDate.getTime();

      // Se a data calculada já passou no tempo:
      if (targetTime <= now.getTime()) {
        const isSameDay =
          now.getFullYear() === scheduledDate.getFullYear() &&
          now.getMonth() === scheduledDate.getMonth() &&
          now.getDate() === scheduledDate.getDate();

        // Se for hoje mas as 09:00 já passaram (e ainda for antes das 21:00),
        // agendar para daqui a 1 minuto para o utilizador receber o aviso de hoje
        if (isSameDay && now.getHours() < 21) {
          targetTime = now.getTime() + 60 * 1000;
        } else {
          continue;
        }
      }

      let title = '⚠️ Lembrete de Pagamento';
      let body = '';

      if (offset === -2) {
        body = `Faltam 2 dias para a data limite do pagamento de ${invoice.name} (${formattedAmount} €).`;
      } else if (offset === -1) {
        body = `Falta 1 dia para a data limite do pagamento de ${invoice.name} (${formattedAmount} €).`;
      } else {
        title = '🚨 Data Limite de Pagamento Hoje!';
        body = `Hoje é a data limite do pagamento de ${invoice.name} (${formattedAmount} €)!`;
      }

      const identifier = `vault_due_${invoice.id}_day_${offset}`;

      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {}

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          sound: 'default',
          data: {
            transactionId: invoice.id,
            name: invoice.name,
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            screen: 'pendentes',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(targetTime),
          channelId: REMINDER_CHANNEL_ID,
        },
      });

      console.log(`🔔 [Notification Scheduled]: ${identifier} para ${new Date(targetTime).toLocaleString('pt-PT')}`);
    }
  } catch (err: any) {
    console.warn('⚠️ [Schedule Notification Error]:', err?.message);
  }
}

/**
 * Cancela todas as notificações de lembrete agendadas para uma fatura
 * (ex: quando o utilizador marca a fatura como paga).
 */
export async function cancelInvoiceReminders(transactionId: string): Promise<void> {
  if (!transactionId || !Notifications) return;

  try {
    for (const offset of [-2, -1, 0]) {
      const identifier = `vault_due_${transactionId}_day_${offset}`;
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
    console.log(`🔕 [Notifications Cancelled]: Lembretes da fatura ${transactionId} removidos.`);
  } catch (err: any) {
    console.warn('⚠️ [Cancel Notification Error]:', err?.message);
  }
}

/**
 * Regista o ouvinte para quando o utilizador toca na notificação (mesmo vindo de background ou app fechada).
 */
export function setupNotificationListener(
  onSelectInvoice: (transactionId: string) => void
): { remove: () => void } {
  if (!Notifications) {
    return { remove: () => {} };
  }

  try {
    // Verificar se a aplicação foi aberta diretamente a partir de uma notificação (Cold Start)
    Notifications.getLastNotificationResponseAsync?.()?.then((response: any) => {
      const rawId = response?.notification?.request?.content?.data?.transactionId;
      if (rawId && typeof rawId === 'string') {
        console.log('📱 [Cold Start from Notification]:', rawId);
        onSelectInvoice(rawId);
      }
    });

    // Ouvir toques na notificação com a app aberta ou minimizada
    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const rawId = response?.notification?.request?.content?.data?.transactionId;
      if (rawId && typeof rawId === 'string') {
        console.log('📱 [Notification Clicked]:', rawId);
        onSelectInvoice(rawId);
      }
    });

    return sub;
  } catch {
    return { remove: () => {} };
  }
}
