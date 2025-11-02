# Анализ передачи данных: Sima Land → Магазин → Яндекс.Маркет

## 1. Данные, забираемые с Sima Land API

### Текущее состояние

**Что забираем:**
- ✅ `description` - описание товара (из полей: `stuff`, `description`, `full_description`, `about`)
- ✅ `name` - название товара
- ✅ `brand` - бренд
- ✅ `category` - категория
- ✅ `purchase_price` - цена закупки
- ✅ `available_quantity` - количество на складе
- ✅ `image_url` - изображение

**Что НЕ забираем:**
- ❌ **Цвет** товара - не извлекается
- ❌ **Размер** товара - не извлекается
- ❌ **Характеристики/параметры** товара - не извлекаются

**Код:** `server/services/simaLandService.js`, метод `parseProduct()` (строки 154-175)

```javascript
// Текущий код извлекает только:
const description = product.stuff || 
                   product.description || 
                   product.full_description || 
                   product.about || 
                   null;
```

### Рекомендации

Нужно проверить документацию Sima Land API v3 на наличие следующих полей:
- `color` / `цвет` - цвет товара
- `size` / `размер` - размер товара  
- `parameters` / `params` / `attributes` - массив характеристик товара
- `specifications` - спецификации товара

**Следующий шаг:** Проверить реальный ответ API Sima Land для товара с характеристиками.

---

## 2. Формирование карточки для Яндекс.Маркет через API

### Требования Яндекс.Маркет Partner API

Согласно документации Яндекс.Маркет Partner API:

#### Метод: `POST /v2/businesses/{businessId}/offer-mappings/update`

**Обязательные поля в `offer`:**
- ✅ `offerId` - артикул товара
- ✅ `name` - название товара
- ✅ `marketCategoryId` - ID категории на Яндекс.Маркет
- ✅ `pictures` - массив URL изображений (минимум 1)
- ✅ `vendor` - бренд/производитель
- ✅ `description` - **описание товара** (обязательное поле!)

**Опциональные поля:**
- `parameterValues` - массив характеристик товара (цвет, размер и т.д.)
- ❌ `price` - **НЕ должен передаваться в offer-mappings!**

**Цена должна передаваться отдельно через:**
- `POST /v2/campaigns/{campaignId}/offer-prices/updates` (для конкретного магазина)
- или `POST /v2/businesses/{businessId}/offer-prices/updates` (для бизнеса)

#### Формат `parameterValues`:

```json
{
  "parameterValues": [
    {
      "parameterId": 7893318,  // ID параметра из категории
      "valueId": 12345678,     // ID значения (если справочное)
      "value": "Красный"       // или текстовое значение
    }
  ]
}
```

**Источник:** [Документация Яндекс.Маркет Partner API](https://yandex.ru/dev/market/partner-api/doc/ru/reference/business-assortment/updateOfferMappings)

---

## 3. Анализ передачи данных

### Проблема #1: Цена передается в offer-mappings

**Текущий код:** `server/services/yandexMarketService.js`, метод `addProduct()` (строки 187)

```javascript
...(productData.price ? { price: { value: productData.price, currencyId: 'RUR' } } : {})
```

**Проблема:** Яндекс.Маркет **не принимает** поле `price` в `offer-mappings/update`. Цена должна передаваться только через отдельный API pricing.

**Решение:** Убрать `price` из метода `addProduct()`.

### Проблема #2: Описание может быть пустым

**Текущий код:** `server/services/yandexMarketService.js`, метод `uploadProductToMarket()` (строка 418)

```javascript
description: product.description || product.name,
```

**Проблема:** Если `product.description` пустое, передается `name`, но по правилам Яндекс.Маркет описание должно быть минимум 50 символов и отличаться от названия.

**Решение:** 
- Если `description` пустое, генерировать описание на основе других полей
- Или требовать заполнение описания перед загрузкой в Яндекс.Маркет

### Проблема #3: Не передаются характеристики (цвет, размер)

**Текущий код:** `server/services/yandexMarketService.js`, метод `uploadProductToMarket()` (строка 420)

```javascript
parameterValues: Array.isArray(options.parameterValues) ? options.parameterValues : undefined
```

**Проблема:** 
- Характеристики не забираются с Sima Land
- Даже если бы были, они не сохраняются в БД
- При загрузке в Яндекс.Маркет `parameterValues` не заполняется

**Решение:** 
1. Добавить извлечение характеристик из Sima Land API
2. Сохранять их в БД (JSONB поле)
3. При загрузке в Яндекс.Маркет получать список параметров категории через `getCategoryParameters()`
4. Маппить характеристики Sima Land на параметры Яндекс.Маркет

### Проблема #4: Цена может не передаваться

**Текущий код:** `server/services/yandexMarketService.js`, метод `uploadProductToMarket()` (строки 427-454)

```javascript
if (sellingPrice && sellingPrice > 0) {
  // Устанавливаем цену через pricing API
  ...
}
```

**Проблема:** Если `sellingPrice` = 0 или `undefined`, цена не передается, но ошибка не логируется явно.

**Решение:** Добавить явную проверку и логирование, если цена не установлена.

---

## 4. Рекомендации по исправлению

### Шаг 1: Исправить передачу цены в Яндекс.Маркет

Убрать поле `price` из метода `addProduct()` в `offer-mappings`:

```javascript
// БЫЛО:
offer: {
  ...
  ...(productData.price ? { price: { value: productData.price, currencyId: 'RUR' } } : {})
}

// ДОЛЖНО БЫТЬ:
offer: {
  // price НЕ передается здесь!
}
```

Цена передается ТОЛЬКО через `updateCampaignPrices()` или `updatePrices()`.

### Шаг 2: Улучшить передачу описания

Добавить валидацию описания перед загрузкой:

```javascript
// Проверяем описание
let description = product.description || '';
if (!description || description.length < 50) {
  // Генерируем описание из других полей
  description = `${product.name}. ${product.brand ? `Бренд: ${product.brand}.` : ''} ${product.category ? `Категория: ${product.category}.` : ''}`;
}
```

### Шаг 3: Добавить извлечение характеристик с Sima Land

Расширить метод `parseProduct()`:

```javascript
// Извлекаем характеристики из API Sima Land
const parameters = product.parameters || product.attributes || product.specifications || [];
const color = product.color || product.цвет || null;
const size = product.size || product.размер || null;
```

### Шаг 4: Сохранять характеристики в БД

Добавить JSONB поле для хранения характеристик:

```sql
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'::jsonb;
```

### Шаг 5: Маппить характеристики при загрузке в Яндекс.Маркет

1. Получить список параметров категории через `getCategoryParameters()`
2. Найти соответствия (например, "Цвет" → parameterId цвета)
3. Сформировать массив `parameterValues`
4. Передать в `addProduct()`

---

## 5. Проверка текущего потока данных

### Sima Land → Магазин (`wb_products_cache`)

✅ **Передается:**
- `name` → `name`
- `description` → `description`
- `purchase_price` → `purchase_price`
- `image_url` → `image_url`
- `brand` → `brand`

❌ **НЕ передается:**
- Цвет
- Размер  
- Характеристики

### Магазин → Яндекс.Маркет

✅ **Передается:**
- `name` → `offer.name`
- `description` → `offer.description` (или `name` если пусто)
- `image_url` → `offer.pictures[0]`
- `brand` → `offer.vendor`
- Цена → через `updateCampaignPrices()` (отдельно)

❌ **Проблемы:**
- `price` передается и в `offer-mappings` (не должно!)
- `description` может быть слишком коротким
- Характеристики не передаются (`parameterValues` пустой)

---

## 6. Выводы

1. **С Sima Land:** Забираем описание, но не забираем цвет, размер, характеристики
2. **В Яндекс.Маркет:** 
   - Описание передается, но может быть пустым/коротким
   - Цена передается дважды (неправильно)
   - Характеристики не передаются

3. **Основные проблемы:**
   - Цена в `offer-mappings` - Яндекс.Маркет игнорирует это поле
   - Отсутствие характеристик товара
   - Возможное пустое/недостаточное описание

---

## 7. Приоритеты исправления

1. **Критично:** Убрать `price` из `offer-mappings` (это может быть причиной отсутствия цены)
2. **Важно:** Улучшить валидацию и генерацию описания
3. **Желательно:** Добавить поддержку характеристик (цвет, размер)

