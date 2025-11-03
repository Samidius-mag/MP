const testString = '"[""https://goods-photos.static1-sima-land.com/items/2804723/0/1700666015.jpg"", ""https://goods-photos.static1-sima-land.com/items/2804723/1/1700666002.jpg""]"';

console.log('Original string:', testString);

let cleaned = testString.trim();
console.log('After trim:', cleaned);

// Если строка начинается и заканчивается кавычками, убираем их
if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
  cleaned = cleaned.slice(1, -1);
  console.log('After removing outer quotes:', cleaned);
}

// Пробуем распарсить
try {
  const parsed = JSON.parse(cleaned);
  console.log('✅ Parsed successfully:', parsed);
  console.log('URLs:', parsed.map(url => url.replace(/^"+|"+$/g, '')));
} catch (parseError) {
  console.log('❌ First parse failed:', parseError.message);
  // Пробуем заменить двойные кавычки
  cleaned = cleaned.replace(/""/g, '"');
  console.log('After replacing double quotes:', cleaned);
  try {
    const parsed = JSON.parse(cleaned);
    console.log('✅ Parsed after replace:', parsed);
    console.log('URLs:', parsed.map(url => url.replace(/^"+|"+$/g, '')));
  } catch (e2) {
    console.log('❌ Second parse also failed:', e2.message);
  }
}

