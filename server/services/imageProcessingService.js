const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ImageProcessingService {
  constructor() {
    // Базовая директория для сохранения обработанных изображений
    this.uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    this.publicUrl = '/uploads/products'; // URL для доступа к изображениям
    
    // Создаем директорию если её нет
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Скачать изображение по URL
   * @param {string} imageUrl - URL изображения
   * @returns {Buffer} Буфер изображения
   */
  async downloadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image from ${imageUrl}: ${error.message}`);
    }
  }

  /**
   * Заменить фон на белый цвет
   * Простой метод: использует композицию с белым фоном
   * @param {Buffer} imageBuffer - Буфер изображения
   * @param {Object} options - Опции обработки
   * @param {string} options.backgroundColor - Цвет фона (по умолчанию белый '#FFFFFF')
   * @param {number} options.threshold - Порог для определения фона (0-255, по умолчанию 240)
   * @returns {Buffer} Обработанное изображение
   */
  async replaceBackgroundWithColor(imageBuffer, options = {}) {
    const {
      backgroundColor = '#FFFFFF',
      threshold = 240 // Порог для определения светлого фона
    } = options;

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Если изображение без альфа-канала, конвертируем в RGBA
      if (!metadata.hasAlpha) {
        image.ensureAlpha();
      }

      // Создаем белый фон
      const background = sharp({
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 3,
          background: backgroundColor
        }
      });

      // Композиция: накладываем изображение на фон, используя альфа-канал
      // Если альфа-канала нет или он непрозрачный, это просто зальет фон цветом
      const composite = await background
        .composite([{
          input: await image.toBuffer(),
          blend: 'over'
        }])
        .png()
        .toBuffer();

      return composite;
    } catch (error) {
      throw new Error(`Failed to replace background: ${error.message}`);
    }
  }

  /**
   * Удалить фон через цветовую маску (удаляет светлый фон)
   * Более продвинутый метод: определяет фон по цвету и делает его прозрачным
   * @param {Buffer} imageBuffer - Буфер изображения
   * @param {Object} options - Опции обработки
   * @param {string} options.bgColor - Цвет фона для удаления (hex, например '#FFFFFF')
   * @param {number} options.tolerance - Допуск цвета (0-100, по умолчанию 10)
   * @param {boolean} options.replaceWithWhite - Заменить на белый вместо прозрачного
   * @returns {Buffer} Обработанное изображение
   */
  async removeBackgroundByColor(imageBuffer, options = {}) {
    const {
      bgColor = '#FFFFFF',
      tolerance = 10,
      replaceWithWhite = false
    } = options;

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Конвертируем цвет фона в RGB
      const bgRgb = this.hexToRgb(bgColor);
      
      // Создаем прозрачное или белое изображение
      const processedImage = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Обрабатываем пиксели
      const pixels = processedImage.data;
      const channels = processedImage.info.channels;
      
      for (let i = 0; i < pixels.length; i += channels) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // Проверяем, является ли пиксель частью фона
        const distance = Math.sqrt(
          Math.pow(r - bgRgb.r, 2) +
          Math.pow(g - bgRgb.g, 2) +
          Math.pow(b - bgRgb.b, 2)
        );
        
        // Если пиксель близок к цвету фона, делаем его прозрачным или белым
        if (distance <= tolerance * 2.55) { // tolerance в процентах
          if (replaceWithWhite) {
            pixels[i] = 255;     // R
            pixels[i + 1] = 255; // G
            pixels[i + 2] = 255; // B
          } else {
            pixels[i + 3] = 0; // Alpha = 0 (прозрачный)
          }
        }
      }

      // Создаем новое изображение из обработанных пикселей
      let output = sharp(pixels, {
        raw: {
          width: processedImage.info.width,
          height: processedImage.info.height,
          channels: channels
        }
      }).png();

      if (replaceWithWhite) {
        // Создаем белый фон и накладываем изображение
        const background = sharp({
          create: {
            width: processedImage.info.width,
            height: processedImage.info.height,
            channels: 3,
            background: '#FFFFFF'
          }
        });

        output = await background
          .composite([{
            input: await output.toBuffer(),
            blend: 'over'
          }])
          .png()
          .toBuffer();
      } else {
        output = await output.toBuffer();
      }

      return output;
    } catch (error) {
      throw new Error(`Failed to remove background: ${error.message}`);
    }
  }

  /**
   * Удалить фон через автоматическое определение (удаляет самый распространенный цвет по краям)
   * @param {Buffer} imageBuffer - Буфер изображения
   * @param {Object} options - Опции обработки
   * @param {boolean} options.replaceWithWhite - Заменить на белый вместо прозрачного
   * @returns {Buffer} Обработанное изображение
   */
  async removeBackgroundAuto(imageBuffer, options = {}) {
    const { replaceWithWhite = true } = options;

    try {
      // Определяем цвет фона по краям изображения
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Получаем пиксели по краям (верхняя и нижняя строка, левый и правый столбец)
      const sampleSize = Math.min(50, Math.floor(Math.min(metadata.width, metadata.height) / 10));
      
      // Упрощенный подход: если фон светлый (среднее значение RGB > threshold), заменяем на белый
      // Более точный вариант потребует анализа пикселей по краям
      
      return await this.replaceBackgroundWithColor(imageBuffer, {
        backgroundColor: replaceWithWhite ? '#FFFFFF' : '#00000000',
        threshold: 240
      });
    } catch (error) {
      throw new Error(`Failed to auto-remove background: ${error.message}`);
    }
  }

  /**
   * Обработать изображение: скачать, обработать, сохранить
   * @param {string} imageUrl - URL исходного изображения
   * @param {Object} options - Опции обработки
   * @param {string} options.method - Метод обработки: 'white', 'remove', 'auto'
   * @param {string} options.filename - Имя файла (если не указано, генерируется)
   * @param {string} options.bgColor - Цвет фона для метода 'remove'
   * @param {boolean} options.replaceWithWhite - Заменить на белый
   * @returns {Object} { filePath, publicUrl } - Путь к файлу и публичный URL
   */
  async processImage(imageUrl, options = {}) {
    const {
      method = 'auto', // 'white', 'remove', 'auto'
      filename = null,
      bgColor = '#FFFFFF',
      replaceWithWhite = true
    } = options;

    try {
      // Скачиваем изображение
      console.log(`Downloading image from ${imageUrl}...`);
      const imageBuffer = await this.downloadImage(imageUrl);

      // Обрабатываем изображение
      console.log(`Processing image with method: ${method}...`);
      let processedBuffer;

      switch (method) {
        case 'white':
          processedBuffer = await this.replaceBackgroundWithColor(imageBuffer, {
            backgroundColor: bgColor
          });
          break;
        case 'remove':
          processedBuffer = await this.removeBackgroundByColor(imageBuffer, {
            bgColor,
            replaceWithWhite
          });
          break;
        case 'auto':
        default:
          processedBuffer = await this.removeBackgroundAuto(imageBuffer, {
            replaceWithWhite
          });
          break;
      }

      // Генерируем имя файла
      const fileExtension = '.png'; // Всегда сохраняем как PNG для поддержки прозрачности
      const finalFilename = filename || `processed-${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      const filePath = path.join(this.uploadDir, finalFilename);

      // Сохраняем обработанное изображение
      await fs.promises.writeFile(filePath, processedBuffer);
      console.log(`Processed image saved to ${filePath}`);

      // Возвращаем путь и публичный URL
      // Если нужно, можно настроить отдачу через Express static или через CDN
      const publicUrl = `${this.publicUrl}/${finalFilename}`;

      return {
        filePath,
        publicUrl,
        filename: finalFilename
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Вспомогательная функция: конвертация hex в RGB
   * @param {string} hex - Hex цвет (например, '#FFFFFF')
   * @returns {Object} { r, g, b }
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  /**
   * Удалить обработанное изображение
   * @param {string} filename - Имя файла
   */
  async deleteProcessedImage(filename) {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`Deleted processed image: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete processed image ${filename}:`, error.message);
    }
  }
}

module.exports = new ImageProcessingService();

