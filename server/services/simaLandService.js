const axios = require('axios');
const { pool } = require('../config/database');
const imageProcessingService = require('./imageProcessingService');

class SimaLandService {
  constructor() {
    this.baseUrl = 'https://www.sima-land.ru/api/v3';
  }

  /**
   * Парсинг товара из API sima-land v3
   * Правильный парсер на основе официальной документации API v3
   * @param {Object} product - Объект товара из API
   * @param {Array} stockData - Массив данных об остатках (опционально)
   * @returns {Object} - Распарсенные данные товара
   */
  parseProduct(product, stockData = []) {
    if (!product || typeof product !== 'object') {
      return null;
    }

    // ID товара - приоритет id, затем sid
    const id = product.id || product.sid || null;

    // Артикул (SID - служебный идентификатор) - это основной артикул товара
    const article = product.sid?.toString() || 
                   product.article?.toString() || 
                   product.id?.toString() || 
                   '';

    // Название товара
    const name = product.name || 
                 product.title || 
                 product.full_name || 
                 'Без названия';

    // Бренд - из объекта trademark или прямого поля brand
    const brand = product.trademark?.name || 
                  product.brand?.name || 
                  product.brand || 
                  null;

    // Категория - правильное поле для категории (не series!)
    // API v3 может возвращать категорию в разных форматах:
    // - объект {id, name} 
    // - просто ID (число)
    // - массив категорий [{id, name}]
    // - поле category_id отдельно
    let categoryId = null;
    let categoryName = null;
    
    // Приоритет 1: объект category с полями id и name
    if (product.category) {
      if (Array.isArray(product.category)) {
        // Если category - массив, берем первую категорию
        const firstCategory = product.category[0];
        if (firstCategory && typeof firstCategory === 'object') {
          categoryId = firstCategory.id || firstCategory.category_id || null;
          categoryName = firstCategory.name || firstCategory.title || null;
        }
      } else if (typeof product.category === 'object') {
        categoryId = product.category.id || product.category.category_id || null;
        categoryName = product.category.name || product.category.title || null;
      } else {
        // Если category - просто число (ID)
        categoryId = product.category;
      }
    }
    
    // Приоритет 2: отдельное поле category_id
    if (!categoryId && product.category_id) {
      categoryId = product.category_id;
    }
    
    // Приоритет 3: categories (множественное число) - массив категорий
    if (!categoryId && product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
      const firstCategory = product.categories[0];
      if (firstCategory && typeof firstCategory === 'object') {
        categoryId = firstCategory.id || firstCategory.category_id || null;
        categoryName = firstCategory.name || firstCategory.title || null;
      }
    }

    // Если есть category_id но нет названия, пытаемся получить из других полей
    if (categoryId && !categoryName) {
      if (product.categoryName) {
        categoryName = product.categoryName;
      } else if (product.category_name) {
        categoryName = product.category_name;
      }
    }

    // Серия товара (series - это НЕ категория, а серия товара!)
    // Можно использовать как дополнительную информацию
    const series = product.series?.name || 
                   product.series || 
                   null;

    // Цена закупки
    // Согласно API v3, поле price содержит цену закупки
    const purchasePrice = product.price || 
                         product.purchase_price || 
                         product.base_price || 
                         product.cost_price || 
                         0;

    // Остаток на складе
    let availableQuantity = 0;
    
    // Сначала пытаемся найти в stockData по артикулу
    if (article && stockData && stockData.length > 0) {
      const stockItem = stockData.find(s => 
        (s.sid?.toString() === article) || 
        (s.article?.toString() === article) || 
        (s.id?.toString() === article)
      );
      if (stockItem) {
        availableQuantity = stockItem.balance || 
                           stockItem.quantity || 
                           stockItem.available_quantity || 
                           0;
      }
    }

    // Если не нашли в stockData, используем balance из товара
    if (availableQuantity === 0 && product.balance !== undefined && product.balance !== null) {
      availableQuantity = parseInt(product.balance) || 0;
    }

    // Изображения товара - извлекаем ВСЕ изображения в полном разрешении
    // API может возвращать изображения в разных форматах:
    // - массив images/photos/gallery
    // - url_part + version (нужно собрать URL)
    // - одно изображение img
    const extractImageUrl = (img, index = 0) => {
      if (!img) return null;
      
      let url = null;
      let timestamp = null; // Для query параметра ?v=
      
      if (typeof img === 'string') {
        url = img;
      } else if (typeof img === 'object' && img !== null) {
        // Специальная обработка для формата url_part + version
        // Формат Sima Land: /items/{itemId}/{index}/{filename}.jpg?v={timestamp}
        // url_part может быть: "https://goods-photos.static1-sima-land.com/items/3182383/0/"
        //   где 3182383 - ID товара, 0 - индекс изображения (0, 1, 2, 3, 4, 5...)
        // version - это timestamp для query параметра ?v= (НЕ имя файла!)
        // Имя файла может быть разным (140, 700, 500 и т.д.), но обычно это timestamp или стандартные значения
        if (img.url_part && img.version) {
          const urlPart = img.url_part.toString().replace(/\/$/, ''); // Убираем trailing slash
          const version = img.version.toString();
          const versionNum = parseInt(version);
          
          // Проверяем, не является ли url_part уже полным URL (содержит .jpg)
          if (urlPart.includes('.jpg')) {
            // url_part уже содержит полный URL
            url = urlPart;
            // Извлекаем timestamp из URL, если он есть в query параметре
            try {
              const urlObj = new URL(urlPart);
              timestamp = urlObj.searchParams.get('v') || version;
            } catch (e) {
              timestamp = version;
            }
          } else {
            // ВАЖНО: Имя файла может быть разным. Из логов видно, что в img поле используется 140.jpg
            // Пробуем стандартные имена файлов, начиная с наиболее распространенных
            // Стандартные имена файлов: 140, 700, 500, 1000, 800, и т.д.
            // Также пробуем использовать version как имя файла (может работать для некоторых товаров)
            
            // Сначала пробуем стандартные имена файлов (140 - наиболее распространенный)
            const commonFilenames = ['140', '700', '500', '1000', '800', '600'];
            // Используем первый вариант (140 - наиболее распространенный по логам)
            url = `${urlPart}/${commonFilenames[0]}.jpg`;
            timestamp = version;
            
            // Если version выглядит как timestamp (больше 1000000000), 
            // возможно имя файла другое - используем стандартные значения
            // В реальности API может требовать разные имена файлов для разных товаров
          }
          
          // Устанавливаем timestamp для query параметра
          timestamp = img.version || 
                     img.timestamp || 
                     img.updated_at_ts || 
                     img.ts || 
                     img.v ||
                     img.version_ts ||
                     (img.updated_at ? Math.floor(new Date(img.updated_at).getTime() / 1000) : null) ||
                     version;
        } else if (img.url_part) {
          // Если есть только url_part, пробуем добавить .jpg
          // Но без version мы не знаем имя файла, поэтому пробуем стандартные значения
          const urlPart = img.url_part.toString().replace(/\/$/, '');
          // Пробуем стандартные имена файлов
          const commonFilenames = ['140', '700', '500', '1000', '800'];
          // Используем первый вариант (140 - наиболее распространенный)
          url = `${urlPart}/${commonFilenames[0]}.jpg`;
          timestamp = img.timestamp || img.updated_at_ts || img.ts || img.v || img.version || Math.floor(Date.now() / 1000);
        } else {
          // Обычные поля
          url = img.url || img.src || img.link || img.original || img.full || img.image || null;
          timestamp = img.timestamp || img.updated_at_ts || img.ts || img.v;
        }
      }
      
      // Преобразуем URL в полное разрешение (если это не специальный формат)
      if (url && !url.includes('url_part')) {
        url = this.getFullResolutionImageUrl(url);
      }
      
      // Добавляем query параметр ?v= если его еще нет и есть timestamp
      // Формат должен быть: https://goods-photos.static1-sima-land.com/items/2804723/0/1700666015.jpg?v=1700666015
      if (url && url.includes('goods-photos.static1-sima-land.com') && url.endsWith('.jpg') && !url.includes('?v=')) {
        // Если timestamp есть, используем его, иначе используем текущий timestamp
        const vParam = timestamp || Math.floor(Date.now() / 1000);
        url = `${url}?v=${vParam}`;
      }
      
      return url;
    };

    let imageUrls = [];
    
    // Согласно документации API v3:
    // - photos - массив фотографий (требует expand=photos)
    // - images - массив изображений с url_part и version
    // - img - URL основной картинки
    // - photoUrl - ссылка на изображение товара
    // - photo_sizes - доступные размеры изображений (expand=photo_sizes)
    
    // ВАЖНО: API возвращает изображения в поле photos, а не images!
    // Приоритет 1: массив photos (основной способ получения всех фото)
    // Формат: [{ url_part: "https://...", version: timestamp }, ...]
    // url_part содержит путь до папки: /items/{itemId}/{index}/
    // version - это timestamp для query параметра ?v=
    // Имя файла нужно извлекать из url_part или использовать стандартные значения
    if (product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
      console.log(`[SIMA LAND] 🔍 Product ${product.id || product.sid || 'unknown'}: Found ${product.photos.length} photos in API response`);
      // Логируем структуру всех фото для отладки
      product.photos.forEach((photo, idx) => {
        if (photo && typeof photo === 'object') {
          console.log(`[SIMA LAND]   Photo ${idx}:`, JSON.stringify(photo, null, 2));
        } else {
          console.log(`[SIMA LAND]   Photo ${idx}:`, photo);
        }
      });
      
      // Если есть поле img, используем его для первого изображения (главная картинка)
      // и извлекаем имя файла оттуда для остальных изображений
      let mainImageFilename = null;
      if (product.img && typeof product.img === 'string' && product.img.includes('goods-photos.static1-sima-land.com')) {
        // Извлекаем имя файла из img (например, 140.jpg из .../0/140.jpg)
        const imgMatch = product.img.match(/\/(\d+)\.jpg/);
        if (imgMatch && imgMatch[1]) {
          mainImageFilename = imgMatch[1];
          console.log(`[SIMA LAND] 🔍 Extracted filename from img field: ${mainImageFilename}.jpg`);
        }
      }
      
      imageUrls = product.photos.map((photo, index) => {
        // Если это первое изображение и есть поле img, используем его
        if (index === 0 && product.img && typeof product.img === 'string' && product.img.includes('goods-photos.static1-sima-land.com')) {
          const url = product.img;
          console.log(`[SIMA LAND] ✅ Using img field for first image: ${url}`);
          return url;
        }
        
        // Для остальных изображений формируем URL из photos
        // Используем имя файла из img, если оно было извлечено, иначе стандартные значения
        if (photo && typeof photo === 'object' && photo.url_part && photo.version) {
          const urlPart = photo.url_part.toString().replace(/\/$/, '');
          const version = photo.version.toString();
          
          // Пробуем использовать имя файла из img для всех изображений
          // Если не получилось, пробуем стандартные значения
          const filenamesToTry = mainImageFilename ? [mainImageFilename] : ['140', '700', '500', '1000', '800'];
          
          for (const filename of filenamesToTry) {
            const testUrl = `${urlPart}/${filename}.jpg?v=${version}`;
            // Пока используем первый вариант (будет проверен при загрузке)
            const url = testUrl;
            console.log(`[SIMA LAND] ✅ Formed URL from photos[${index}]: ${url}`);
            return url;
          }
        }
        
        // Fallback: используем extractImageUrl
        const url = extractImageUrl(photo, index);
        if (url) {
          console.log(`[SIMA LAND] ✅ Extracted URL from photos[${index}]: ${url}`);
        } else {
          console.warn(`[SIMA LAND] ⚠️ Failed to extract URL from photos[${index}]:`, JSON.stringify(photo));
        }
        return url;
      }).filter(url => url !== null);
      
      // Удаляем дубликаты, но сохраняем порядок
      const uniqueUrls = [];
      const seenUrls = new Set();
      for (const url of imageUrls) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          uniqueUrls.push(url);
        }
      }
      imageUrls = uniqueUrls;
      console.log(`[SIMA LAND] 📸 Extracted ${imageUrls.length} unique image URLs from ${product.photos.length} photos`);
    }
    
    // Приоритет 2: массив images (fallback, если photos нет)
    if (imageUrls.length === 0 && product.images && Array.isArray(product.images) && product.images.length > 0) {
      console.log(`[SIMA LAND] 🔍 Using images field (fallback): ${product.images.length} images found`);
      // Проверяем, есть ли url_part (новый формат)
      const hasUrlPart = product.images.some(img => img && typeof img === 'object' && img.url_part);
      if (hasUrlPart) {
        imageUrls = product.images.map((img, index) => {
          const url = extractImageUrl(img, index);
          if (url) {
            console.log(`[SIMA LAND] ✅ Extracted URL for image ${index}: ${url}`);
          } else if (img && typeof img === 'object') {
            console.warn(`[SIMA LAND] ⚠️ Failed to extract URL for image ${index}:`, JSON.stringify(img));
          }
          return url;
        }).filter(url => url !== null);
      } else {
        // Старый формат - обычные URL
        imageUrls = product.images.map((img, index) => extractImageUrl(img, index)).filter(url => url !== null);
      }
    }
    // Приоритет 3: photo_sizes (если есть размеры, берем максимальный/оригинальный)
    // ВНИМАНИЕ: photo_sizes может прийти как строка, а не массив!
    if (imageUrls.length === 0 && product.photo_sizes) {
      if (Array.isArray(product.photo_sizes) && product.photo_sizes.length > 0) {
        // photo_sizes может содержать информацию о разных размерах
        // Ищем оригинальный размер или максимальный (обычно самый большой размер)
        let maxSize = null;
        let maxDimensions = 0;
        
        product.photo_sizes.forEach(photoSize => {
          // Если есть размеры, выбираем максимальный
          if (photoSize && typeof photoSize === 'object' && photoSize.width && photoSize.height) {
            const dimensions = photoSize.width * photoSize.height;
            if (dimensions > maxDimensions) {
              maxDimensions = dimensions;
              maxSize = photoSize;
            }
          }
        });
        
        // Если нашли максимальный размер - используем его
        if (maxSize) {
          const url = extractImageUrl(maxSize);
          if (url) imageUrls.push(url);
        } else {
          // Если размеры не указаны, берем все доступные
          product.photo_sizes.forEach(photoSize => {
            // Пропускаем числа (размеры в пикселях) - это не URL
            if (photoSize && typeof photoSize !== 'number') {
              const url = extractImageUrl(photoSize);
              if (url && !imageUrls.includes(url)) imageUrls.push(url);
            }
          });
        }
        
        // Если ничего не нашлось, пробуем стандартные поля
        if (imageUrls.length === 0) {
          product.photo_sizes.forEach(photoSize => {
            if (photoSize && typeof photoSize === 'object') {
              if (photoSize.url) {
                const url = extractImageUrl(photoSize.url);
                if (url && !imageUrls.includes(url)) imageUrls.push(url);
              } else if (photoSize.original) {
                const url = extractImageUrl(photoSize.original);
                if (url && !imageUrls.includes(url)) imageUrls.push(url);
              } else if (photoSize.full) {
                const url = extractImageUrl(photoSize.full);
                if (url && !imageUrls.includes(url)) imageUrls.push(url);
              }
            }
          });
        }
      } else if (typeof product.photo_sizes === 'string') {
        // Если photo_sizes - это строка, возможно это просто число размера
        // Игнорируем и продолжаем поиск в других местах
        console.warn(`[SIMA LAND] photo_sizes is a string (value: ${product.photo_sizes}), skipping...`);
      }
    }
    // Приоритет 4: массив gallery (fallback)
    if (imageUrls.length === 0 && product.gallery && Array.isArray(product.gallery)) {
      imageUrls = product.gallery.map(extractImageUrl).filter(url => url !== null);
    }
    // Приоритет 5: массив img (fallback)
    if (imageUrls.length === 0 && Array.isArray(product.img)) {
      imageUrls = product.img.map(extractImageUrl).filter(url => url !== null);
    }
    // Приоритет 6: одно изображение img (основное изображение из документации)
    // ВАЖНО: img содержит готовый URL с правильным именем файла
    if (imageUrls.length === 0 && product.img) {
      console.log(`[SIMA LAND] 🔍 Using img field: ${product.img}`);
      const url = extractImageUrl(product.img);
      if (url) {
        imageUrls.push(url);
        console.log(`[SIMA LAND] ✅ Extracted URL from img: ${url}`);
      } else {
        // Если extractImageUrl не сработал, используем img напрямую
        if (typeof product.img === 'string' && product.img.includes('goods-photos.static1-sima-land.com')) {
          imageUrls.push(product.img);
          console.log(`[SIMA LAND] ✅ Using img field directly: ${product.img}`);
        }
      }
    }
    // Приоритет 7: photoUrl (ссылка на изображение из документации)
    if (imageUrls.length === 0 && product.photoUrl) {
      const url = extractImageUrl(product.photoUrl);
      if (url) imageUrls.push(url);
    }
    // Приоритет 8: другие поля для одного изображения (fallback)
    if (imageUrls.length === 0) {
      const url = extractImageUrl(product.photo_url) ||
                  extractImageUrl(product.image_url) ||
                  extractImageUrl(product.imageUrl) ||
                  extractImageUrl(product.image) ||
                  extractImageUrl(product.photo);
      if (url) imageUrls.push(url);
    }

    // Убираем дубликаты
    imageUrls = [...new Set(imageUrls)];
    
    // Логируем для отладки (только первые несколько товаров)
    if (process.env.NODE_ENV === 'development' || Math.random() < 0.01) {
      console.log(`[SIMA LAND] Product ${product.id || product.sid || 'unknown'}: Found ${imageUrls.length} images`);
      if (imageUrls.length > 0) {
        console.log(`[SIMA LAND] First image URL: ${imageUrls[0]}`);
        if (imageUrls.length > 1) {
          console.log(`[SIMA LAND] All image URLs:`, imageUrls.slice(0, 3).map(url => url.substring(0, 80) + '...'));
        }
      } else {
        console.log(`[SIMA LAND] ⚠️  NO IMAGES FOUND for product ${product.id || product.sid}`);
        console.log(`[SIMA LAND] Available fields:`, {
          has_img: !!product.img,
          has_photoUrl: !!product.photoUrl,
          has_images: !!product.images,
          has_photos: !!product.photos,
          has_photo_sizes: !!product.photo_sizes,
          img_type: typeof product.img,
          images_type: Array.isArray(product.images) ? 'array' : typeof product.images,
          photos_type: Array.isArray(product.photos) ? 'array' : typeof product.photos,
          photo_sizes_type: Array.isArray(product.photo_sizes) ? 'array' : typeof product.photo_sizes
        });
        if (product.img) {
          console.log(`[SIMA LAND] img value:`, typeof product.img === 'string' ? product.img.substring(0, 100) : JSON.stringify(product.img).substring(0, 200));
        }
        if (product.images) {
          console.log(`[SIMA LAND] images value:`, JSON.stringify(product.images).substring(0, 300));
        }
        if (product.photos) {
          console.log(`[SIMA LAND] photos value:`, JSON.stringify(product.photos).substring(0, 300));
        }
        if (product.photo_sizes) {
          console.log(`[SIMA LAND] photo_sizes value:`, JSON.stringify(product.photo_sizes).substring(0, 300));
        }
      }
    }
    
    // Основное изображение (первое) - для обратной совместимости
    const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

    // Описание товара
    // Согласно документации API v3:
    // - stuff - материалы, строка со списком материалов через запятую
    // - description - полное описание (требует expand=description)
    // - ext_description - дополнительное описание (expand=ext_description)
    const description = product.description ||  // Полное описание (приоритет)
                       product.ext_description ||  // Дополнительное описание
                       product.stuff ||  // Материалы как fallback
                       product.full_description || 
                       product.about || 
                       null;

    // Извлекаем характеристики товара
    // Проверяем различные возможные поля для цвета
    const color = product.color || 
                  product.цвет || 
                  product.colour ||
                  product.color_name ||
                  product.colour_name ||
                  null;

    // Проверяем различные возможные поля для размера
    // Согласно документации: size - это строка "глубина × ширина × высота"
    // Также могут быть отдельные поля: width, height, depth
    let size = product.size || 
               product.размер || 
               null;
    
    // Если size не задан, но есть габариты - формируем размер из них
    if (!size && (product.width || product.height || product.depth || product.length)) {
      const parts = [];
      if (product.depth || product.length) parts.push(`${product.depth || product.length} см`);
      if (product.width) parts.push(`${product.width} см`);
      if (product.height) parts.push(`${product.height} см`);
      if (parts.length > 0) {
        size = parts.join(' × ');
      }
    }
    
    // Fallback: sizes (может быть массивом)
    if (!size && product.sizes) {
      if (Array.isArray(product.sizes) && product.sizes.length > 0) {
        size = product.sizes[0];
      } else if (typeof product.sizes === 'string') {
        size = product.sizes;
      }
    }

    // Извлекаем материал
    // Согласно документации:
    // - stuff - материалы, строка со списком материалов через запятую
    // - materials - материалы товара (массив, требует expand=materials)
    let material = null;
    
    // Приоритет 1: массив materials (расширенная информация)
    if (product.materials && Array.isArray(product.materials) && product.materials.length > 0) {
      // materials может быть массивом объектов или строк
      material = product.materials.map(m => {
        if (typeof m === 'string') {
          return m;
        } else if (typeof m === 'object' && m !== null) {
          return m.name || m.title || m.material || String(m);
        }
        return String(m);
      }).filter(Boolean).join(', ');
    }
    
    // Приоритет 2: stuff (строка со списком материалов)
    if (!material && product.stuff && typeof product.stuff === 'string') {
      material = product.stuff;
    }
    
    // Приоритет 3: другие поля
    if (!material) {
      material = product.material || 
                 product.материал || 
                 product.material_name ||
                 product.composition || 
                 null;
    }

    // Извлекаем массив параметров/характеристик
    // Согласно документации API v3:
    // - attrs - атрибуты товара (требует expand=attrs)
    // - grouped_attrs_list - список атрибутов по группам (expand=grouped_attrs_list)
    let parameters = [];
    
    // Приоритет 1: grouped_attrs_list (разбито по группам, более структурировано)
    if (product.grouped_attrs_list && Array.isArray(product.grouped_attrs_list)) {
      // grouped_attrs_list - массив групп атрибутов
      // Каждая группа: { group_name: "...", attrs: [...] }
      product.grouped_attrs_list.forEach(group => {
        if (group.attrs && Array.isArray(group.attrs)) {
          group.attrs.forEach(attr => {
            if (attr && typeof attr === 'object') {
              parameters.push({
                name: attr.name || attr.attribute_name || attr.title || '',
                value: attr.value || attr.attribute_value || attr.val || attr.text || null,
                id: attr.id || attr.attribute_id || null,
                group: group.group_name || group.name || null
              });
            }
          });
        }
      });
    }
    
    // Приоритет 2: attrs (плоский массив атрибутов)
    if (parameters.length === 0 && product.attrs && Array.isArray(product.attrs)) {
      parameters = product.attrs.map(attr => {
        if (typeof attr === 'object' && attr !== null) {
          return {
            name: attr.name || attr.attribute_name || attr.title || attr.key || '',
            value: attr.value || attr.attribute_value || attr.val || attr.text || null,
            id: attr.id || attr.attribute_id || null,
            group: attr.group || attr.group_name || null
          };
        }
        return null;
      }).filter(a => a !== null);
    }
    
    // Приоритет 3: массив attributes (fallback)
    if (parameters.length === 0 && product.attributes && Array.isArray(product.attributes)) {
      parameters = product.attributes.map(attr => {
        if (typeof attr === 'object' && attr !== null) {
          return {
            name: attr.name || attr.attribute_name || attr.key || '',
            value: attr.value || attr.attribute_value || attr.val || null,
            id: attr.id || attr.attribute_id || null
          };
        }
        return null;
      }).filter(a => a !== null);
    }
    
    // Приоритет 4: массив parameters (fallback)
    if (parameters.length === 0 && product.parameters && Array.isArray(product.parameters)) {
      parameters = product.parameters.map(param => {
        if (typeof param === 'string') {
          return { name: param, value: null };
        } else if (typeof param === 'object' && param !== null) {
          return {
            name: param.name || param.title || param.key || '',
            value: param.value || param.val || param.text || null,
            id: param.id || null
          };
        }
        return null;
      }).filter(p => p !== null);
    }
    
    // Приоритет 5: объект specifications или specs (fallback)
    if (parameters.length === 0 && (product.specifications || product.specs)) {
      const specs = product.specifications || product.specs;
      if (typeof specs === 'object' && specs !== null && !Array.isArray(specs)) {
        parameters = Object.entries(specs).map(([key, value]) => ({
          name: key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          id: null
        }));
      }
    }

    // Формируем объект характеристик
    const characteristics = {};
    if (color) characteristics.color = color;
    if (size) characteristics.size = size;
    if (material) characteristics.material = material;
    if (parameters.length > 0) characteristics.parameters = parameters;
    
    // Добавляем другие возможные характеристики из документации API
    // Физические характеристики
    if (product.weight) characteristics.weight = product.weight; // Вес, г
    if (product.width) characteristics.width = product.width; // Ширина, см
    if (product.height) characteristics.height = product.height; // Высота, см
    if (product.depth) characteristics.depth = product.depth; // Глубина, см
    if (product.length) characteristics.length = product.length; // Длина, см
    if (product.volume) characteristics.volume = product.volume; // Объем, л
    if (product.surface_area) characteristics.surface_area = product.surface_area; // Площадь поверхности, кв. м
    if (product.linear_meters) characteristics.linear_meters = product.linear_meters; // Погонные метры
    
    // Упаковка
    if (product.box_width) characteristics.box_width = product.box_width; // Ширина упаковки, см
    if (product.box_height) characteristics.box_height = product.box_height; // Высота упаковки, см
    if (product.box_depth) characteristics.box_depth = product.box_depth; // Глубина упаковки, см
    if (product.in_box) characteristics.in_box = product.in_box; // Количество в боксе
    if (product.in_set) characteristics.in_set = product.in_set; // Количество в наборе
    if (product.package_volume) characteristics.package_volume = product.package_volume; // Объем упаковки, куб. дм
    
    // Страна и возраст
    if (product.country) {
      // country может быть объектом или ID
      if (typeof product.country === 'object' && product.country !== null) {
        characteristics.country = product.country.name || product.country.title || null;
        characteristics.country_id = product.country.id || null;
      } else {
        characteristics.country = product.country;
      }
    }
    if (product.country_id) characteristics.country_id = product.country_id;
    
    if (product.min_age) characteristics.min_age = product.min_age; // Рекомендуемый возраст
    if (product.age || product.age_group) {
      characteristics.age = product.age || product.age_group;
    }
    if (product.gender || product.sex) {
      characteristics.gender = product.gender || product.sex;
    }
    
    // Дополнительные поля
    if (product.minimum_order_quantity) characteristics.minimum_order_quantity = product.minimum_order_quantity;
    if (product.page_count) characteristics.page_count = product.page_count; // Количество страниц
    if (product.isbn) characteristics.isbn = product.isbn;
    
    // Штрихкоды (expand=barcodes)
    if (product.barcodes && Array.isArray(product.barcodes)) {
      characteristics.barcodes = product.barcodes;
    }

    const parsedProduct = {
      id,
      article,
      name,
      brand,
      category_id: categoryId,
      category: categoryName || series, // Если нет категории, используем серию как fallback
      series, // Сохраняем серию отдельно если нужно
      purchase_price: parseFloat(purchasePrice) || 0,
      available_quantity: parseInt(availableQuantity) || 0,
      image_url: imageUrl, // Основное изображение для обратной совместимости
      image_urls: imageUrls, // Массив всех изображений
      description,
      characteristics: Object.keys(characteristics).length > 0 ? characteristics : null
    };

    return parsedProduct;
  }

  /**
   * Преобразует URL изображения Sima Land в полное разрешение
   * Убирает параметры размера и получает оригинальное изображение
   * @param {string} url - URL изображения
   * @returns {string} URL в полном разрешении
   */
  getFullResolutionImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return url;
    }

    // Для Sima Land CDN НЕ ОБРАБАТЫВАЕМ URL - возвращаем как есть
    // API уже возвращает правильные URL, не нужно их менять
    if (url.includes('goods-photos.static1-sima-land.com') || 
        url.includes('sima-land') || 
        url.includes('simaland')) {
      // Просто возвращаем URL как есть, без обработки
      // API Sima Land уже возвращает правильные URL
      return url;
    }

    try {
      // Для других URL обрабатываем как раньше
      // Если URL содержит параметры размера (например, ?w=200&h=200 или ?size=thumb)
      // убираем их для получения оригинала
      const urlObj = new URL(url);
      
      // Удаляем параметры размера
      const sizeParams = ['w', 'h', 'width', 'height', 'size', 'resize', 'thumb', 'thumbnail', 'format'];
      sizeParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // Если URL содержит путь с размером (например, /thumb/, /small/, /200x200/)
      let path = urlObj.pathname;
      
      // Убираем префиксы размеров из пути
      const sizePrefixes = ['/thumb/', '/thumbnail/', '/small/', '/medium/', '/large/', '/resize/'];
      for (const prefix of sizePrefixes) {
        if (path.includes(prefix)) {
          path = path.replace(prefix, '/');
          break;
        }
      }
      
      // Убираем паттерны типа /200x200/, /150x150/ из пути
      path = path.replace(/\/\d+x\d+\//g, '/');
      path = path.replace(/\/\d+x\d+\./g, '.');
      
      // ВАЖНО: Для Sima Land путь /items/0/ или /items/1/ - это часть правильного пути!
      // Сохраняем оригинальный путь перед обработкой
      const originalPath = path;
      const itemsMatch = originalPath.match(/\/items\/\d+\//);
      
      // Убираем паттерны с одним размером /200/ или .200.
      // НО НЕ убираем /items/0/ - это часть пути к изображению!
      // Используем более точное регулярное выражение, которое НЕ трогает /items/N/
      path = path.replace(/\/(?!items\/\d+\/)\d+\//g, '/');
      path = path.replace(/\.\d+\./g, '.');
      
      // Восстанавливаем путь /items/N/, если он был поврежден
      if (itemsMatch && !path.includes(itemsMatch[0])) {
        const filename = path.split('/').pop();
        if (filename) {
          path = itemsMatch[0] + filename;
        }
      }
      
      urlObj.pathname = path;

      // Для CDN Sima Land: убираем ограничения размера и добавляем качество
      if (urlObj.hostname.includes('sima-land') || urlObj.hostname.includes('simaland') || 
          urlObj.hostname.includes('goods-photos.static1-sima-land.com') ||
          urlObj.hostname.includes('static1-sima-land.com')) {
        // Убираем все параметры размера
        urlObj.searchParams.delete('w');
        urlObj.searchParams.delete('h');
        urlObj.searchParams.delete('width');
        urlObj.searchParams.delete('height');
        
        // Для статических CDN обычно не нужны параметры качества
        // Просто возвращаем чистый URL без параметров размера
      }

      return urlObj.toString();
    } catch (error) {
      // Если URL некорректен, возвращаем как есть
      console.warn(`Failed to process image URL ${url}:`, error.message);
      return url;
    }
  }

  /**
   * Получить детальную информацию о товаре по ID
   * Может содержать больше изображений, чем в списке товаров
   * @param {string} token - API токен
   * @param {number|string} itemId - ID товара
   * @returns {Object} Детальная информация о товаре
   */
  async fetchProductDetails(token, itemId) {
    try {
      console.log(`[SIMA LAND] Fetching product details for item ${itemId}`);
      
      // Запрашиваем все дополнительные поля через expand
      const expandFields = ['description', 'attrs', 'photos', 'materials', 'photo_sizes', 'images',
                           'grouped_attrs_list', 'categories', 'photo_3d_urls', 'ext_description',
                           'barcodes', 'all_categories'];
      
      const response = await axios.get(`${this.baseUrl}/item/${itemId}/`, {
        params: {
          expand: expandFields.join(',')
        },
        headers: {
          'x-api-key': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const productData = response.data || null;
      
      // Логируем структуру изображений из API для отладки
      if (productData && productData.images) {
        console.log(`[SIMA LAND] 📸 Product ${itemId} details - images field:`, JSON.stringify(productData.images, null, 2));
      } else if (productData) {
        console.log(`[SIMA LAND] ⚠️ Product ${itemId} details - no images field. Available fields:`, Object.keys(productData));
        if (productData.img) {
          console.log(`[SIMA LAND]   img field:`, productData.img);
        }
        if (productData.photos) {
          console.log(`[SIMA LAND]   photos field:`, JSON.stringify(productData.photos, null, 2));
        }
      }
      
      return productData;
    } catch (error) {
      console.error(`[SIMA LAND] Failed to fetch product details for item ${itemId}:`, error.response?.data || error.message);
      // Не критичная ошибка, возвращаем null
      return null;
    }
  }

  /**
   * Получить категории из API sima-land v3
   * Согласно документации API v3: https://www.sima-land.ru/api/v3/help/#Категория-товаров
   * Категории возвращаются с полями: id, name, parent_id, depth (уровень вложенности)
   * Поддерживается пагинация для больших списков категорий
   */
  async fetchCategories(token, options = {}) {
    try {
      const perPage = options.perPage || 1000;
      const allCategories = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(`${this.baseUrl}/category/`, {
          params: {
            'per-page': perPage,
            page: page
          },
          headers: {
            'x-api-key': token,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const items = response.data.items || [];
        const meta = response.data._meta || {};

        // Обрабатываем категории согласно структуре API v3
        // Поля: id, name, parent_id, depth (уровень вложенности)
        for (const category of items) {
          allCategories.push({
            id: category.id,
            name: category.name || '',
            parent_id: category.parent_id || null,
            depth: category.depth || category.level || null
          });
        }

        // Проверяем, есть ли еще страницы
        const currentPage = meta.currentPage || page;
        const pageCount = meta.pageCount || 1;
        hasMore = currentPage < pageCount && items.length > 0;
        page++;

        // Защита от бесконечного цикла
        if (page > 100) {
          console.warn('Sima-land categories: слишком много страниц, прерываем загрузку');
          break;
        }

        // Небольшая задержка между запросами для соблюдения rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📚 Загружено ${allCategories.length} категорий из API sima-land`);
      return allCategories;
    } catch (error) {
      console.error('Sima-land categories API error:', error.response?.data || error.message);
      // При ошибке возвращаем пустой массив, резервное заполнение будет из каталога
      return [];
    }
  }

  /**
   * Получить токен API клиента
   */
  async getClientToken(clientId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT api_keys FROM clients WHERE id = $1',
        [clientId]
      );

      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      const apiKeys = result.rows[0].api_keys || {};
      return apiKeys.sima_land?.token;
    } finally {
      client.release();
    }
  }

  /**
   * Получить товары из API СИМА ЛЕНД
   * Документация: https://www.sima-land.ru/api/v3/help/
   */
  async fetchProducts(token, page = 1, perPage = 50, idGreaterThan = null, options = {}) {
    const maxRetries = 3;
    let attempt = 0;
    const makeRequest = async () => {
      const logPage = idGreaterThan ? `idGreaterThan ${idGreaterThan}` : `page ${page}`;
      console.log(`Fetching Sima-land products: ${logPage}, perPage ${perPage}`);

      // Запрос на получение товаров из каталога
      // Используем правильный endpoint и заголовок x-api-key согласно документации
      const params = {
        'per-page': perPage,
        ...(idGreaterThan ? { 'id-greater-than': idGreaterThan } : { page }),
      };
      
      // Добавляем expand параметр для получения дополнительных полей
      // Согласно документации: description, attrs, photos, materials, photo_sizes и т.д.
      const expandFields = ['description', 'attrs', 'photos', 'materials', 'photo_sizes', 'grouped_attrs_list', 'categories'];
      params['expand'] = expandFields.join(',');
      
      // Фильтрация по категориям согласно документации API v3
      // Параметр может быть category_id или category_ids
      if (options?.categories && Array.isArray(options.categories) && options.categories.length > 0) {
        // API v3 может принимать несколько значений категорий
        // Попробуем разные варианты форматов
        const categoryIds = options.categories.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (categoryIds.length > 0) {
          // Вариант 1: передаем как массив в query string (category_id[]=1&category_id[]=2)
          // Вариант 2: передаем через запятую (category_id=1,2)
          // Используем вариант с запятой, так как axios автоматически обработает массив
          if (categoryIds.length === 1) {
            params['category_id'] = categoryIds[0];
          } else {
            params['category_id'] = categoryIds.join(',');
          }
        }
      }

      const response = await axios.get(`${this.baseUrl}/item/`, {
        params,
        headers: {
          'x-api-key': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        httpAgent: new (require('http').Agent)({ keepAlive: true }),
        httpsAgent: new (require('https').Agent)({ keepAlive: true })
      });

      return {
        items: response.data.items || [],
        total: response.data._meta?.totalCount || 0,
        pageCount: response.data._meta?.pageCount || 1,
        currentPage: response.data._meta?.currentPage || 1
      };
    };

    try {
      return await makeRequest();
    } catch (error) {
      // Обработка rate limit'ов и временных ошибок
      const status = error?.response?.status;
      if (status === 429 || status === 503 || status === 504) {
        const retryAfter = Number(error?.response?.headers?.['retry-after']) || 3;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return await makeRequest();
      }
      // Сетевые ошибки (ECONNRESET/ETIMEDOUT и т.п.) — повторим до 3 раз с экспоненциальной задержкой
      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED'];
      if (transientCodes.includes(error?.code) && attempt < maxRetries) {
        attempt++;
        const delayMs = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s
        console.warn(`Transient error ${error.code}. Retry ${attempt}/${maxRetries} in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs));
        return await makeRequest();
      }
      console.error('Sima-land API error:', error.response?.data || error.message);
      const wrapped = new Error(`Failed to fetch products: ${error.response?.statusText || error.message}`);
      if (error.response) wrapped.response = error.response; // preserve status for callers
      if (error.code) wrapped.code = error.code;
      throw wrapped;
    }
  }

  /**
   * Получить остатки товаров
   * Попробуем разные endpoints для получения остатков
   */
  async fetchStock(token) {
    try {
      console.log('Fetching Sima-land stock');

      // Попробуем разные endpoints для остатков
      const endpoints = [
        '/inventory/',
        '/stock/',
        '/warehouse/',
        '/balance/'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${this.baseUrl}${endpoint}`, {
            headers: {
              'x-api-key': token,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          console.log(`✅ Successfully fetched stock from ${endpoint}`);
          return response.data.items || response.data || [];
        } catch (err) {
          // Не логируем каждую попытку, только при полном провале
          continue;
        }
      }

      // Если все endpoints не работают, это нормально - используем balance из товаров
      console.log('ℹ️ Stock API endpoints not available, will use balance from products');
      return [];
    } catch (error) {
      console.error('Sima-land stock API error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Получить товары клиента из БД
   */
  async getClientProducts(clientId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, article, name, brand, category, purchase_price, available_quantity, image_url, image_urls, description, characteristics
         FROM sima_land_products
         WHERE client_id = $1
         ORDER BY created_at DESC`,
        [clientId]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Добавить товар клиента в каталог
   */
  async addClientProduct(clientId, productData) {
    const client = await pool.connect();
    try {
      // Проверяем, не существует ли уже товар с таким артикулом
      const existingProduct = await client.query(
        'SELECT id FROM sima_land_products WHERE client_id = $1 AND article = $2',
        [clientId, productData.article]
      );

      if (existingProduct.rows.length > 0) {
        // Обновляем существующий товар
        const updateResult = await client.query(
          `UPDATE sima_land_products 
           SET name = $3, brand = $4, category = $5, purchase_price = $6, 
               available_quantity = $7, image_url = $8, image_urls = $9, description = $10, 
               characteristics = $11, updated_at = NOW()
           WHERE client_id = $1 AND article = $2
           RETURNING id`,
          [
            clientId,
            productData.article,
            productData.name,
            productData.brand,
            productData.category,
            productData.purchase_price,
            productData.available_quantity || 0,
            productData.image_url,
            productData.image_urls ? JSON.stringify(productData.image_urls) : null,
            productData.description,
            productData.characteristics ? JSON.stringify(productData.characteristics) : '{}'
          ]
        );

        return updateResult.rows[0].id;
      } else {
        // Создаем новый товар
        const insertResult = await client.query(
          `INSERT INTO sima_land_products 
           (client_id, article, name, brand, category, purchase_price, available_quantity, image_url, image_urls, description, characteristics)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            clientId,
            productData.article,
            productData.name,
            productData.brand,
            productData.category,
            productData.purchase_price,
            productData.available_quantity || 0,
            productData.image_url,
            productData.image_urls ? JSON.stringify(productData.image_urls) : null,
            productData.description,
            productData.characteristics ? JSON.stringify(productData.characteristics) : '{}'
          ]
        );

        return insertResult.rows[0].id;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Загрузить и сохранить товары для клиента
   */
  async loadProductsForClient(clientId, token, progressJobId, options = {}) {
    const progressStore = progressJobId ? require('./progressStore') : null;
    const logger = require('./logger');
    const client = await pool.connect();
    
    // Статистика обработки изображений
    const imageStats = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0
    };

    try {
      // Логируем начало загрузки с информацией об обработке изображений
      if (options.processImages) {
        console.log(`[SIMA LAND] 🔄 Загрузка товаров с ОБРАБОТКОЙ ИЗОБРАЖЕНИЙ включена`);
        console.log(`[SIMA LAND] Метод обработки: ${options.imageProcessingMethod || 'auto'}`);
        console.log(`[SIMA LAND] Категории: ${(options.categories || []).join(', ') || 'Все'}`);
        
        await logger.info(`Начало загрузки товаров с обработкой изображений`, {
          service: 'sima-land',
          metadata: {
            clientId,
            processImages: true,
            method: options.imageProcessingMethod || 'auto',
            categories: options.categories || []
          }
        }).catch(err => {
          console.error('[SIMA LAND] Logger error:', err.message);
        });
      } else {
        console.log(`[SIMA LAND] ℹ️  Обработка изображений отключена`);
      }

      // Курсорная пагинация через id-greater-than (рекомендация API при больших оффсетах)
      const perPage = 100;
      let cursorId = null; // последний id в предыдущей пачке
      let batchIndex = 0;
      let totalFetched = 0;

      // Получаем остатки один раз для всех товаров
      let stockData = [];
      try {
        stockData = await this.fetchStock(token);
        console.log(`Fetched ${stockData.length} stock items`);
      } catch (err) {
        console.warn(`Could not fetch stock data:`, err.message);
      }

      // Сохраняем товары батчами, чтобы не держать всё в памяти
      let savedCount = 0;
      let imagesCount = 0;
      while (true) {
        batchIndex++;
        let result;
        try {
          result = await this.fetchProducts(token, 1, perPage, cursorId, options);
        } catch (e) {
          // Если возникла ошибка на page-офсете, принудительно переходим на курсорную пагинацию
          result = { items: [] };
        }

        const items = result.items || [];
        if (items.length === 0) break;
        totalFetched += items.length;

        if (progressStore && progressJobId) {
          // Прогресс без известного тотала — условный, не более 50%
          const pseudoProgress = Math.min(50, Math.floor(Math.log10(1 + totalFetched) * 20));
          progressStore.setProgress(progressJobId, pseudoProgress, {
            stage: 'fetching',
            batchIndex,
            batchSize: items.length,
            totalFetched
          });
        }

        for (let i = 0; i < items.length; i++) {
          const product = items[i];
          try {
            // Используем правильный парсер для извлечения всех полей товара
            const parsedProduct = this.parseProduct(product, stockData);
            
            if (!parsedProduct || !parsedProduct.article) {
              console.warn(`Skipping product with missing article:`, product.id || product.sid);
              continue;
            }

            // Обрабатываем все изображения товара
            let finalImageUrls = parsedProduct.image_urls || [];
            let finalImageUrl = parsedProduct.image_url; // Основное изображение для обратной совместимости
            
            // Если детальная информация о товаре не была загружена и включена опция, пробуем загрузить
            if (options.fetchDetails && parsedProduct.id && (!finalImageUrls || finalImageUrls.length <= 1)) {
              try {
                console.log(`[SIMA LAND] 📥 Загрузка детальной информации для товара ${parsedProduct.article}...`);
                const details = await this.fetchProductDetails(token, parsedProduct.id);
                if (details) {
                  // Парсим товар заново с детальной информацией
                  const detailedParsed = this.parseProduct(details);
                  if (detailedParsed && detailedParsed.image_urls && detailedParsed.image_urls.length > finalImageUrls.length) {
                    console.log(`[SIMA LAND] ✅ Найдено больше изображений: ${detailedParsed.image_urls.length} вместо ${finalImageUrls.length}`);
                    finalImageUrls = detailedParsed.image_urls;
                    finalImageUrl = detailedParsed.image_url;
                  }
                }
              } catch (detailError) {
                console.warn(`[SIMA LAND] ⚠️  Не удалось загрузить детали для товара ${parsedProduct.article}:`, detailError.message);
              }
            }

            // Обрабатываем все изображения (заменяем фон на белый), если включено
            if (options.processImages && finalImageUrls && finalImageUrls.length > 0) {
              console.log(`[SIMA LAND] 📸 Обработка ${finalImageUrls.length} изображений для товара ${parsedProduct.article}...`);
              
              const processedUrls = [];
              for (let i = 0; i < finalImageUrls.length; i++) {
                const imgUrl = finalImageUrls[i];
                imageStats.total++;
                
                try {
                  const processed = await imageProcessingService.processImage(imgUrl, {
                    method: options.imageProcessingMethod || 'auto',
                    replaceWithWhite: options.replaceWithWhite !== false,
                    bgColor: options.bgColor || '#FFFFFF',
                    productArticle: parsedProduct.article,
                    clientId: clientId,
                    filename: `${parsedProduct.article}-${i + 1}.png` // Номер изображения в имени файла
                  });
                  processedUrls.push(processed.publicUrl);
                  imageStats.processed++;
                  imagesCount++;
                  
                  // Первое обработанное изображение становится основным
                  if (i === 0) {
                    finalImageUrl = processed.publicUrl;
                  }
                } catch (imageError) {
                  imageStats.failed++;
                  
                  // Проверяем, является ли ошибка 404 (изображение не найдено)
                  const is404 = imageError.is404 === true || 
                               (imageError.message && imageError.message.includes('404')) ||
                               (imageError.originalError && imageError.originalError.response && imageError.originalError.response.status === 404);
                  
                  if (is404) {
                    console.warn(`[SIMA LAND] ⚠️ Изображение ${i + 1} для товара ${parsedProduct.article} не найдено (404): ${imgUrl}`);
                    console.warn(`[SIMA LAND] Пропускаем это изображение и продолжаем со следующим`);
                    // Не добавляем несуществующее изображение в список
                    // Просто пропускаем его
                  } else {
                    console.error(`[SIMA LAND] ❌ Ошибка обработки изображения ${i + 1} для товара ${parsedProduct.article}:`, imageError.message);
                    // Для других ошибок используем оригинальное изображение
                    processedUrls.push(imgUrl);
                    imagesCount++;
                    if (i === 0) {
                      finalImageUrl = imgUrl;
                    }
                  }
                }
              }
              
              // Если после обработки не осталось изображений (все были 404), 
              // оставляем пустой массив и null для основного изображения
              if (processedUrls.length === 0) {
                console.warn(`[SIMA LAND] ⚠️ Все изображения для товара ${parsedProduct.article} недоступны (404)`);
                finalImageUrl = null;
                finalImageUrls = [];
              } else {
                finalImageUrls = processedUrls;
                // Убеждаемся, что основное изображение установлено, если его еще нет
                if (!finalImageUrl && processedUrls.length > 0) {
                  finalImageUrl = processedUrls[0];
                }
              }
            } else if (finalImageUrls && finalImageUrls.length > 0) {
              // Если обработка отключена, просто считаем изображения
              imageStats.skipped += finalImageUrls.length;
              imagesCount += finalImageUrls.length;
            }

            // Сохраняем товар в базу данных
            await client.query(
              `INSERT INTO sima_land_products 
               (client_id, article, name, brand, category, purchase_price, available_quantity, image_url, image_urls, description, characteristics)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (client_id, article) 
               DO UPDATE SET 
                 name = EXCLUDED.name,
                 brand = EXCLUDED.brand,
                 category = EXCLUDED.category,
                 purchase_price = EXCLUDED.purchase_price,
                 available_quantity = EXCLUDED.available_quantity,
                 image_url = EXCLUDED.image_url,
                 image_urls = EXCLUDED.image_urls,
                 description = EXCLUDED.description,
                 characteristics = EXCLUDED.characteristics,
                 updated_at = NOW()`,
              [
                clientId,
                parsedProduct.article,
                parsedProduct.name,
                parsedProduct.brand,
                parsedProduct.category,
                parsedProduct.purchase_price,
                parsedProduct.available_quantity,
                finalImageUrl, // Основное изображение для обратной совместимости
                finalImageUrls && finalImageUrls.length > 0 ? JSON.stringify(finalImageUrls) : null, // Массив всех изображений
                parsedProduct.description,
                parsedProduct.characteristics ? JSON.stringify(parsedProduct.characteristics) : '{}'
              ]
            );

            savedCount++;
            if (progressStore && progressJobId) {
              const base = 50; // первая половина — загрузка, вторая — сохранение
              const saveProgress = Math.min(50, Math.floor(Math.log10(1 + savedCount) * 20));
              progressStore.setProgress(progressJobId, base + saveProgress, {
                stage: 'saving',
                savedItems: savedCount,
                imagesWithUrl: imagesCount
              });
            }
          } catch (err) {
            console.error(`Error saving product ${product.sid || product.id || 'unknown'}:`, err.message);
          }
        }

        // Обновляем курсор последним id
        const last = items[items.length - 1];
        cursorId = last?.id || last?.sid || cursorId;
      }

      console.log(`✅ Saved ${savedCount} products for client ${clientId}`);
      console.log(`📸 Found images for ${imagesCount} out of ${savedCount} products`);

      // Логируем статистику обработки изображений
      if (options.processImages && imageStats.total > 0) {
        const imageProcessingStats = imageProcessingService.getStats();
        const successRate = ((imageStats.processed / imageStats.total) * 100).toFixed(1);
        
        console.log(`[SIMA LAND] ===== Статистика обработки изображений =====`);
        console.log(`[SIMA LAND] Всего изображений: ${imageStats.total}`);
        console.log(`[SIMA LAND] Успешно обработано: ${imageStats.processed}`);
        console.log(`[SIMA LAND] Ошибок: ${imageStats.failed}`);
        console.log(`[SIMA LAND] Пропущено: ${imageStats.skipped}`);
        console.log(`[SIMA LAND] Процент успеха: ${successRate}%`);
        console.log(`[SIMA LAND] Среднее время: ${imageProcessingStats.avgTime}`);
        console.log(`[SIMA LAND] =============================================`);
        
        await logger.info(`Загрузка товаров завершена. Статистика обработки изображений`, {
          service: 'sima-land',
          metadata: {
            clientId,
            totalProducts: savedCount,
            imagesFound: imagesCount,
            imageProcessing: {
              total: imageStats.total,
              processed: imageStats.processed,
              failed: imageStats.failed,
              skipped: imageStats.skipped,
              successRate: `${successRate}%`,
              serviceStats: imageProcessingStats
            }
          }
        }).catch(err => {
          console.error('[SIMA LAND] Logger error:', err.message);
        });
      }

      const result = {
        total: savedCount,
        saved: savedCount,
        images: imagesCount,
        imageProcessing: options.processImages ? imageStats : null
      };

      if (progressStore && progressJobId) {
        progressStore.finishJob(progressJobId, result);
      }
      return result;
    } finally {
      client.release();
    }
  }

  async loadCatalog(options = {}, progressJobId) {
    const progressStore = progressJobId ? require('./progressStore') : null;
    const client = await pool.connect();
    const token = process.env.SIMA_LAND_STATIC_TOKEN;
    if (!token) throw new Error('SIMA_LAND_STATIC_TOKEN is not set');
    try {
      console.log('🔄 Starting Sima-land catalog load', {
        categories: Array.isArray(options.categories) ? options.categories : [],
        jobId: progressJobId
      });
      const perPage = 200;
      let cursorId = null;
      let savedCount = 0;
      let batchIndex = 0;

      // Инкрементальный старт от максимального id в БД (если не включена полная синхронизация)
      const fullSync = options.fullSync === true;
      if (!fullSync) {
        try {
          const r = await client.query(`SELECT COALESCE(MAX(id),0) AS max_id FROM sima_land_catalog`);
          const maxId = r.rows[0]?.max_id;
          if (maxId && Number(maxId) > 0) {
            cursorId = Number(maxId);
            console.log(`↗️ Incremental start from idGreaterThan=${cursorId}`);
          }
        } catch {}
      } else {
        console.log(`🔄 Full sync mode: loading all products from the beginning`);
      }

      let buffer = [];
      const flush = async () => {
        if (buffer.length === 0) return;
        const cols = ['id','article','name','brand','category_id','category','purchase_price','available_quantity','image_url','image_urls','description','characteristics'];
        const values = [];
        const params = [];
        let p = 1;
        for (const it of buffer) {
          values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
          params.push(it.id, it.article, it.name, it.brand, it.category_id, it.category, it.purchase_price, it.available_quantity, it.image_url, it.image_urls ? JSON.stringify(it.image_urls) : null, it.description, it.characteristics ? JSON.stringify(it.characteristics) : '{}');
        }
        const sql = `INSERT INTO sima_land_catalog (${cols.join(',')}) VALUES ${values.join(',')}
          ON CONFLICT (id) DO UPDATE SET
            article=EXCLUDED.article,
            name=EXCLUDED.name,
            brand=EXCLUDED.brand,
            category_id=EXCLUDED.category_id,
            category=EXCLUDED.category,
            purchase_price=EXCLUDED.purchase_price,
            available_quantity=EXCLUDED.available_quantity,
            image_url=EXCLUDED.image_url,
            image_urls=EXCLUDED.image_urls,
            description=EXCLUDED.description,
            characteristics=EXCLUDED.characteristics,
            updated_at=NOW()`;
        await client.query(sql, params);
        savedCount += buffer.length;
        buffer = [];
      };

      while (true) {
        batchIndex++;
        let result;
        try {
          result = await this.fetchProducts(token, 1, perPage, cursorId, options);
        } catch (e) {
          const status = e?.response?.status;
          if (status === 404) {
            console.warn('Sima-land: items not found (404). Treating as end of stream.');
            break;
          }
          console.warn(`Sima-land transient error on batch #${batchIndex}: ${e.message || e}`);
          // бэк-офф и продолжим ту же страницу
          await new Promise(r => setTimeout(r, 3000));
          batchIndex--; // повторим попытку с тем же номером
          continue;
        }
        const items = result.items || [];
        if (items.length === 0) break;

        for (const product of items) {
          // Используем правильный парсер для извлечения всех полей товара
          const parsedProduct = this.parseProduct(product);
          
          if (!parsedProduct || !parsedProduct.article) {
            console.warn(`Skipping product with missing article in catalog:`, product.id || product.sid);
            continue;
          }

          // Обрабатываем все изображения, если включено
          let finalImageUrls = parsedProduct.image_urls || [];
          let finalImageUrl = parsedProduct.image_url;
          
          if (options.processImages && finalImageUrls && finalImageUrls.length > 0) {
            const processedUrls = [];
            for (let i = 0; i < finalImageUrls.length; i++) {
              const imgUrl = finalImageUrls[i];
              try {
                const processed = await imageProcessingService.processImage(imgUrl, {
                  method: options.imageProcessingMethod || 'auto',
                  replaceWithWhite: options.replaceWithWhite !== false,
                  bgColor: options.bgColor || '#FFFFFF',
                  productArticle: parsedProduct.article,
                  clientId: null, // Для каталога clientId = null
                  filename: `catalog-${parsedProduct.article}-${i + 1}.png`
                });
                processedUrls.push(processed.publicUrl);
                if (i === 0) {
                  finalImageUrl = processed.publicUrl;
                }
              } catch (imageError) {
                // Используем оригинальное изображение, если обработка не удалась
                processedUrls.push(imgUrl);
                if (i === 0) {
                  finalImageUrl = imgUrl;
                }
              }
            }
            finalImageUrls = processedUrls;
          }

          // Формируем строку для вставки в каталог
          const row = {
            id: parsedProduct.id,
            article: parsedProduct.article,
            name: parsedProduct.name,
            brand: parsedProduct.brand,
            category_id: parsedProduct.category_id,
            category: parsedProduct.category,
            purchase_price: parsedProduct.purchase_price,
            available_quantity: parsedProduct.available_quantity,
            image_url: finalImageUrl, // Основное изображение для обратной совместимости
            image_urls: finalImageUrls, // Массив всех изображений
            description: parsedProduct.description,
            characteristics: parsedProduct.characteristics
          };
          
          buffer.push(row);
          if (buffer.length >= 500) {
            await flush();
            if (progressStore && progressJobId) {
              progressStore.setProgress(progressJobId, Math.min(100, Math.floor(Math.log10(1 + savedCount) * 25)), {
                stage: 'catalog-saving',
                savedItems: savedCount
              });
            }
          }
        }

        // Обновляем курсор последним id из распарсенных товаров
        if (items.length > 0) {
          const lastParsed = this.parseProduct(items[items.length - 1]);
          if (lastParsed && lastParsed.id) {
            cursorId = lastParsed.id;
          } else {
            // Fallback на исходные данные
            const last = items[items.length - 1];
            cursorId = last?.id || last?.sid || cursorId;
          }
        }

        console.log(`📦 Catalog batch #${batchIndex}: fetched=${items.length}, totalSaved=${savedCount + buffer.length}, cursor=${cursorId}`);
      }

      // финальный сброс буфера
      await flush();

      // Categories refresh (best effort)
      // Загружаем категории с пагинацией согласно документации API v3
      const cats = await this.fetchCategories(token, { perPage: 1000 });
      console.log(`📚 Categories fetched: ${cats.length}`);
      
      // Сохраняем категории в БД
      for (const c of cats) {
        try {
          await client.query(
            `INSERT INTO sima_land_categories (id, name, parent_id, level)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, level=EXCLUDED.level, updated_at=NOW()`,
            [c.id, c.name, c.parent_id || null, c.depth || null]
          );
        } catch (err) {
          // Тихая обработка ошибок для отдельных категорий
          console.warn(`Failed to save category ${c.id}:`, err.message);
        }
      }

      // Резервное наполнение категорий из каталога, если API вернуло 0
      if (!cats || cats.length === 0) {
        console.log('ℹ️ Categories API returned 0. Backfilling categories from catalog...');
        await client.query(
          `INSERT INTO sima_land_categories (id, name)
           SELECT DISTINCT category_id, COALESCE(category, 'Без категории')
           FROM sima_land_catalog
           WHERE category_id IS NOT NULL
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
        );
      }

      console.log(`✅ Catalog load completed: saved=${savedCount}`);
      if (progressStore && progressJobId) progressStore.finishJob(progressJobId, { saved: savedCount });
      return { saved: savedCount };
    } finally {
      client.release();
    }
  }
}

module.exports = SimaLandService;

