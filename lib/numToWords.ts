// Indian-system rupees-in-words. e.g. 10864 -> "Rupees Ten Thousand Eight Hundred Sixty Four Only"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')).trim();
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (h) out += ONES[h] + ' Hundred';
  if (rest) out += (out ? ' ' : '') + twoDigit(rest);
  return out;
}

export function rupeesInWords(amount: number): string {
  let num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Rupees Zero Only';

  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000);   num %= 100000;
  const thousand = Math.floor(num / 1000);  num %= 1000;
  const hundred = num;

  const parts: string[] = [];
  if (crore)    parts.push(threeDigit(crore) + ' Crore');
  if (lakh)     parts.push(twoDigit(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigit(thousand) + ' Thousand');
  if (hundred)  parts.push(threeDigit(hundred));

  return 'Rupees ' + parts.join(' ') + ' Only';
}
