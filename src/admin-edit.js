const FIELDS = ['status', 'breed', 'color', 'gender', 'age', 'vaccine', 'price', 'supplier', 'supplierOriginalId', 'costPrice', 'description', 'rawDescription', 'verificationNote'];
const normalized = value => String(value ?? '').trim();

// Keep untouched optional, computed or differently typed Feishu fields out of
// the update. Numeric input elements return strings while the original data may
// contain numbers; their displayed values are equivalent.
export function changedCatFields(original, edited) {
  return Object.fromEntries(FIELDS.filter(key => normalized(original[key]) !== normalized(edited[key]))
    .map(key => [key, edited[key] ?? '']));
}
