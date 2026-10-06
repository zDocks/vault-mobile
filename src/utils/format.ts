/**
 * Utilitários de Formatação Financeira para a Vault App
 */

export interface FormatCurrencyOptions {
  keepSign?: boolean;
  forceSign?: boolean;
  removeSign?: boolean;
  hideSymbol?: boolean;
}

/**
 * Formata um valor numérico ou string com separadores de milhares e decimais europeus (pt-PT).
 * Ex: 126768.38 -> "126.768,38 €"
 * Ex: "-23008.93€" -> "-23.008,93 €"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: FormatCurrencyOptions
): string {
  if (value === null || value === undefined || value === '') {
    return options?.hideSymbol ? '0,00' : '0,00 €';
  }

  let num: number;
  let hasExplicitPlus = false;
  let hasExplicitMinus = false;

  if (typeof value === 'number') {
    num = value;
    hasExplicitMinus = num < 0;
  } else {
    const trimmed = String(value).trim();
    if (trimmed.startsWith('+')) hasExplicitPlus = true;
    if (trimmed.startsWith('-')) hasExplicitMinus = true;

    const cleaned = trimmed
      .replace(/[^\d.,-]/g, '')
      .replace(/\./g, (match, offset, str) => {
        return str.indexOf(',') > offset ? '' : '.';
      })
      .replace(',', '.');

    num = parseFloat(cleaned);
  }

  if (isNaN(num)) {
    return typeof value === 'string' ? value : '0,00 €';
  }

  const isNeg = num < 0 || hasExplicitMinus;
  const abs = Math.abs(num);
  const parts = abs.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];

  let sign = '';
  if (!options?.removeSign) {
    if (options?.forceSign) {
      sign = isNeg ? '-' : '+';
    } else if (options?.keepSign) {
      if (isNeg) sign = '-';
      else if (hasExplicitPlus) sign = '+';
    } else if (isNeg) {
      sign = '-';
    }
  }

  const symbol = options?.hideSymbol ? '' : ' €';
  return `${sign}${integerPart},${decimalPart}${symbol}`;
}

/**
 * Retorna as partes estruturadas de uma quantia (inteiro, decimais, símbolo)
 * Permite renderizar os cêntimos ligeiramente mais subtis se desejado.
 */
export function formatCurrencyParts(value: number | string | null | undefined) {
  const formatted = formatCurrency(value);
  const match = formatted.match(/^([+-]?[\d.]+)(?:,(\d{2}))?\s*(€)?$/);
  if (!match) {
    return {
      integer: formatted,
      decimals: '00',
      symbol: '€',
      formatted,
    };
  }
  return {
    integer: match[1],
    decimals: match[2] || '00',
    symbol: match[3] || '€',
    formatted,
  };
}
