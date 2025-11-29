// Formatting utility functions

export const formatTokenAmount = (amount: bigint, decimals: number, precision?: number): string => {
  const divisor = BigInt(10 ** decimals);
  const quotient = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return quotient.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  let trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  // Apply precision if specified
  if (precision !== undefined && trimmedRemainder.length > precision) {
    trimmedRemainder = trimmedRemainder.slice(0, precision);
  }
  
  return trimmedRemainder ? `${quotient}.${trimmedRemainder}` : quotient.toString();
};

export const parseTokenAmount = (amount: string, decimals: number): bigint => {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
};

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatUsdAmount = (amount: number): string => {
  if (amount < 0.01) {
    return '<$0.01';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
};

export const formatUSD = formatUsdAmount;

export const formatNumber = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};