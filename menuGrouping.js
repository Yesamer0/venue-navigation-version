function normalized(value) {
  return String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u');
}

export function getMenuCategoryKey(value) {
  return normalized(String(value || '').normalize('NFKC')).replace(/&/g, ' ve ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ') || 'diger';
}

export function getMenuCategoryLabel(value) {
  const key = getMenuCategoryKey(value);
  return new Map([['sicak icecekler', 'Sıcak İçecekler'], ['soguk icecekler', 'Soğuk İçecekler'],
    ['sandvic ve tost', 'Sandviç & Tost'], ['diger', 'Diğer']]).get(key)
    || String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ') || 'Diğer';
}

export function groupMenuCategories(items) {
  const labels = new Map();
  const groups = Object.create(null);
  for (const item of items) {
    const key = getMenuCategoryKey(item.category);
    if (!labels.has(key)) labels.set(key, getMenuCategoryLabel(item.category));
    const label = labels.get(key);
    (groups[label] ||= []).push(item);
  }
  return groups;
}

export function getMenuGroup(category, name = '', storedGroup = null) {
  if (['yiyecek', 'icecek', 'diger'].includes(storedGroup)) return storedGroup;
  const heading = normalized(category);
  // Keep the original heading for display; only choose the parent tab here.
  if (/kahve|cay|icecek|espresso|milkshake|frozen|limonata|frappe|coffee|drinks?|beverages?|smoothie|kokteyl|mesrubat|meyve suyu|ice bar/.test(heading)
    || /\b(tea|water|juice|soda)\b/.test(heading)) return 'icecek';
  if (/yiyecek|yemek|tatli|atistirmalik|kahvalti|kruvasan|sandvic|salata|tost|burger|pizza|makarna|corba|pasta|kurabiye|dessert|snack|breakfast|food|bakery|croissant|sandwich/.test(heading)) return 'yiyecek';
  // A missing/unknown heading can still contain an unmistakable product name.
  const product = normalized(name);
  if (/\b(latte|americano|cappuccino|espresso|macchiato|mocha|flat white|kahve|cay|limonata|milkshake)\b/.test(product)) return 'icecek';
  if (/\b(cheesecake|tiramisu|brownie|bagel|kruvasan|tost|sandvic|salata|pizza|burger)\b/.test(product)) return 'yiyecek';
  return 'diger';
}
