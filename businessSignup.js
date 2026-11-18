import { VENUE_CATEGORIES } from './venueCategories';

export const businessSignupFields = [
  { key: 'sign_name', label: 'Tabela adı', maxLength: 120 },
  { key: 'owner_name', label: 'İşletme sahibinin adı soyadı', maxLength: 120 },
  { key: 'legal_name', label: 'Şirket unvanı veya şahıs işletmesinin kayıtlı adı', maxLength: 160 },
  { key: 'tax_office', label: 'Vergi dairesi', maxLength: 80 },
  { key: 'tax_number', label: 'Vergi kimlik numarası (VKN)', keyboardType: 'number-pad', maxLength: 10 },
  { key: 'business_type', label: 'İş tipi', maxLength: 80 },
  { key: 'branch_count', label: 'Şube sayısı (bu mekân dahil)', keyboardType: 'number-pad', maxLength: 6 },
  { key: 'employee_count', label: 'Çalışan sayısı (isteğe bağlı)', keyboardType: 'number-pad', maxLength: 6, optional: true },
  { key: 'phone', label: 'İşletme telefon numarası', keyboardType: 'phone-pad', maxLength: 25 },
  { key: 'address', label: 'İlk mekânın açık adresi', maxLength: 250 },
];

export function validateBusinessSignup(values) {
  const details = {};
  for (const { key, label, maxLength, optional } of businessSignupFields) {
    const value = (values[key] || '').trim();
    if (!value && optional) continue;
    if (!value) throw new Error(label + ' alanını doldur.');
    if (value.length > maxLength) throw new Error(label + ' alanı çok uzun.');
    details[key] = value;
  }

  if (!VENUE_CATEGORIES.includes(details.business_type)) throw new Error('Listeden bir iş tipi seç.');
  if (!/^\d{10}$/.test(details.tax_number)) throw new Error('VKN 10 rakam olmalı.');
  if (!/^\+?[\d ().-]+$/.test(details.phone)) throw new Error('Geçerli bir işletme telefonu yaz.');
  const phone = details.phone.replace(/[ ().-]/g, '');
  if (!/^\+?\d{10,15}$/.test(phone)) throw new Error('Telefon numarası 10–15 rakam içermeli.');
  if (!/^\d+$/.test(details.branch_count) || Number(details.branch_count) < 1) {
    throw new Error('Şube sayısı en az 1 olmalı.');
  }
  if (details.employee_count !== undefined && !/^\d+$/.test(details.employee_count)) {
    throw new Error('Çalışan sayısı 0 veya pozitif bir tam sayı olmalı.');
  }

  return {
    ...details,
    phone,
    branch_count: Number(details.branch_count),
    ...(details.employee_count === undefined ? {} : { employee_count: Number(details.employee_count) }),
  };
}
