const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ImageProcessingService {
  constructor() {
    // Базовая директория для сохранения обработанных изображений
    this.uploadDir = path.join(__dirname, '..', 'uploads', 'products');
    this.publicUrl = '/uploads/products'; // URL для доступа к изображениям
    
    // Создаем директорию если её нет
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Статистика обработки
    this.stats = {
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalTime: 0
    };
  }

  /**
   * Скачать изображение по URL
   * @param {string} imageUrl - URL изображения
   * @returns {Buffer} Буфер изображения
   */
  async downloadImage(imageUrl) {
    const startTime = Date.now();
    try {
      console.log(`[IMAGE PROCESSING] Начало загрузки изображения: ${imageUrl}`);
      
      await logger.info(`Начало загрузки изображения`, {
        service: 'image-processing',
        metadata: { imageUrl, stage: 'download_start' }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://www.sima-land.ru/',
          'Origin': 'https://www.sima-land.ru'
        },
        validateStatus: (status) => {
          // Разрешаем только статусы 200, иначе axios выбросит ошибку
          return status === 200;
        }
      });

      const downloadTime = Date.now() - startTime;
      const imageSize = response.data.byteLength;
      
      console.log(`[IMAGE PROCESSING] Изображение загружено: ${(imageSize / 1024).toFixed(2)} KB за ${downloadTime}ms`);
      
      await logger.info(`Изображение успешно загружено`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          stage: 'download_complete',
          size: `${(imageSize / 1024).toFixed(2)} KB`,
          downloadTime: `${downloadTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      return Buffer.from(response.data);
    } catch (error) {
      const downloadTime = Date.now() - startTime;
      
      // Проверяем, является ли ошибка 404 (изображение не найдено)
      const is404 = error.response && error.response.status === 404;
      const errorMessage = is404 
        ? `Image not found (404): ${imageUrl}` 
        : `Failed to download image from ${imageUrl}: ${error.message}`;
      
      console.error(`[IMAGE PROCESSING] ${is404 ? '⚠️' : '❌'} ${errorMessage}`);
      
      await logger.error(`Ошибка загрузки изображения`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          stage: 'download_error',
          error: error.message,
          statusCode: error.response ? error.response.status : null,
          is404: is404,
          downloadTime: `${downloadTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });
      
      // Создаем специальную ошибку для 404, чтобы вызывающий код мог её обработатьw
      const customError = new Error(errorMessage);
      customError.is404 = is404;
      customError.originalError = error;
      throw customError;
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

    const startTime = Date.now();
    try {
      console.log(`[IMAGE PROCESSING] Начало замены фона методом 'white' (${backgroundColor})`);
      
      await logger.debug(`Начало замены фона методом 'white'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_start',
          method: 'replaceBackgroundWithColor',
          backgroundColor,
          threshold
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

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

      const processTime = Date.now() - startTime;
      console.log(`[IMAGE PROCESSING] Фон заменен методом 'white': ${metadata.width}x${metadata.height}, ${(composite.length / 1024).toFixed(2)} KB за ${processTime}ms`);
      
      await logger.debug(`Фон успешно заменен методом 'white'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_complete',
          method: 'replaceBackgroundWithColor',
          size: `${metadata.width}x${metadata.height}`,
          outputSize: `${(composite.length / 1024).toFixed(2)} KB`,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      return composite;
    } catch (error) {
      const processTime = Date.now() - startTime;
      console.error(`[IMAGE PROCESSING] Ошибка замены фона методом 'white':`, error.message);
      
      await logger.error(`Ошибка замены фона методом 'white'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_error',
          method: 'replaceBackgroundWithColor',
          error: error.message,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });
      
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

    const startTime = Date.now();
    try {
      console.log(`[IMAGE PROCESSING] Начало удаления фона методом 'remove' (цвет: ${bgColor}, tolerance: ${tolerance})`);
      
      await logger.debug(`Начало удаления фона методом 'remove'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_start',
          method: 'removeBackgroundByColor',
          bgColor,
          tolerance,
          replaceWithWhite
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

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

      const processTime = Date.now() - startTime;
      console.log(`[IMAGE PROCESSING] Фон удален методом 'remove': ${metadata.width}x${metadata.height}, ${(output.length / 1024).toFixed(2)} KB за ${processTime}ms`);
      
      await logger.debug(`Фон успешно удален методом 'remove'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_complete',
          method: 'removeBackgroundByColor',
          size: `${metadata.width}x${metadata.height}`,
          outputSize: `${(output.length / 1024).toFixed(2)} KB`,
          pixelsProcessed: pixels.length / channels,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      return output;
    } catch (error) {
      const processTime = Date.now() - startTime;
      console.error(`[IMAGE PROCESSING] Ошибка удаления фона методом 'remove':`, error.message);
      
      await logger.error(`Ошибка удаления фона методом 'remove'`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_error',
          method: 'removeBackgroundByColor',
          error: error.message,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });
      
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

    const startTime = Date.now();
    try {
      console.log(`[IMAGE PROCESSING] Начало автоматического удаления фона`);
      
      await logger.debug(`Начало автоматического удаления фона`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_start',
          method: 'removeBackgroundAuto',
          replaceWithWhite
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      // Определяем цвет фона по краям изображения
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Получаем пиксели по краям (верхняя и нижняя строка, левый и правый столбец)
      const sampleSize = Math.min(50, Math.floor(Math.min(metadata.width, metadata.height) / 10));
      
      // Упрощенный подход: если фон светлый (среднее значение RGB > threshold), заменяем на белый
      // Более точный вариант потребует анализа пикселей по краям
      
      const result = await this.replaceBackgroundWithColor(imageBuffer, {
        backgroundColor: replaceWithWhite ? '#FFFFFF' : '#00000000',
        threshold: 240
      });

      const processTime = Date.now() - startTime;
      console.log(`[IMAGE PROCESSING] Автоматическое удаление фона завершено: ${metadata.width}x${metadata.height} за ${processTime}ms`);
      
      await logger.debug(`Автоматическое удаление фона завершено`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_complete',
          method: 'removeBackgroundAuto',
          size: `${metadata.width}x${metadata.height}`,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      return result;
    } catch (error) {
      const processTime = Date.now() - startTime;
      console.error(`[IMAGE PROCESSING] Ошибка автоматического удаления фона:`, error.message);
      
      await logger.error(`Ошибка автоматического удаления фона`, {
        service: 'image-processing',
        metadata: {
          stage: 'process_error',
          method: 'removeBackgroundAuto',
          error: error.message,
          processTime: `${processTime}ms`
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });
      
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
      replaceWithWhite = true,
      productArticle = null,
      clientId = null
    } = options;

    const totalStartTime = Date.now();
    this.stats.totalProcessed++;

    try {
      console.log(`[IMAGE PROCESSING] ===== Начало обработки изображения =====`);
      console.log(`[IMAGE PROCESSING] URL: ${imageUrl}`);
      console.log(`[IMAGE PROCESSING] Метод: ${method}`);
      console.log(`[IMAGE PROCESSING] Товар: ${productArticle || 'N/A'}`);
      console.log(`[IMAGE PROCESSING] Клиент: ${clientId || 'N/A'}`);
      
      await logger.info(`Начало обработки изображения`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          method,
          productArticle,
          clientId,
          bgColor,
          replaceWithWhite,
          stage: 'start'
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      // Скачиваем изображение
      const imageBuffer = await this.downloadImage(imageUrl);

      // Обрабатываем изображение
      console.log(`[IMAGE PROCESSING] Обработка изображения методом: ${method}`);
      
      await logger.info(`Обработка изображения методом: ${method}`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          method,
          productArticle,
          stage: 'processing'
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

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
      const saveStartTime = Date.now();
      await fs.promises.writeFile(filePath, processedBuffer);
      const saveTime = Date.now() - saveStartTime;

      const totalTime = Date.now() - totalStartTime;
      const originalSize = imageBuffer.length;
      const processedSize = processedBuffer.length;
      
      this.stats.totalSuccess++;
      this.stats.totalTime += totalTime;

      console.log(`[IMAGE PROCESSING] ✅ Изображение успешно обработано!`);
      console.log(`[IMAGE PROCESSING] Файл: ${finalFilename}`);
      console.log(`[IMAGE PROCESSING] Размер: ${(originalSize / 1024).toFixed(2)} KB -> ${(processedSize / 1024).toFixed(2)} KB`);
      console.log(`[IMAGE PROCESSING] Время обработки: ${totalTime}ms`);
      console.log(`[IMAGE PROCESSING] URL: ${this.publicUrl}/${finalFilename}`);
      console.log(`[IMAGE PROCESSING] ===== Обработка завершена =====`);

      await logger.info(`Изображение успешно обработано и сохранено`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          method,
          productArticle,
          clientId,
          filename: finalFilename,
          filePath,
          publicUrl: `${this.publicUrl}/${finalFilename}`,
          originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
          processedSize: `${(processedSize / 1024).toFixed(2)} KB`,
          compression: `${((1 - processedSize / originalSize) * 100).toFixed(1)}%`,
          saveTime: `${saveTime}ms`,
          totalTime: `${totalTime}ms`,
          stage: 'complete',
          stats: {
            totalProcessed: this.stats.totalProcessed,
            totalSuccess: this.stats.totalSuccess,
            totalFailed: this.stats.totalFailed,
            avgTime: `${(this.stats.totalTime / this.stats.totalSuccess).toFixed(0)}ms`
          }
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

      // Возвращаем путь и публичный URL
      const publicUrl = `${this.publicUrl}/${finalFilename}`;

      return {
        filePath,
        publicUrl,
        filename: finalFilename,
        stats: {
          originalSize,
          processedSize,
          totalTime
        }
      };
    } catch (error) {
      const totalTime = Date.now() - totalStartTime;
      this.stats.totalFailed++;

      console.error(`[IMAGE PROCESSING] ❌ Ошибка обработки изображения:`, error.message);
      console.error(`[IMAGE PROCESSING] URL: ${imageUrl}`);
      console.error(`[IMAGE PROCESSING] Время до ошибки: ${totalTime}ms`);
      if (error.stack) {
        console.error(`[IMAGE PROCESSING] Stack:`, error.stack);
      }

      await logger.error(`Ошибка обработки изображения`, {
        service: 'image-processing',
        metadata: {
          imageUrl,
          method,
          productArticle,
          clientId,
          error: error.message,
          stack: error.stack,
          totalTime: `${totalTime}ms`,
          stage: 'error',
          stats: {
            totalProcessed: this.stats.totalProcessed,
            totalSuccess: this.stats.totalSuccess,
            totalFailed: this.stats.totalFailed,
            successRate: `${((this.stats.totalSuccess / this.stats.totalProcessed) * 100).toFixed(1)}%`
          }
        }
      }).catch(err => {
        console.error('[IMAGE PROCESSING] Logger error:', err.message);
      });

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
        await logger.info(`Удалено обработанное изображение`, {
          service: 'image-processing',
          metadata: {
            filename,
            filePath,
            stage: 'delete'
          }
        });
      }
    } catch (error) {
      await logger.error(`Ошибка удаления обработанного изображения`, {
        service: 'image-processing',
        metadata: {
          filename,
          error: error.message,
          stage: 'delete_error'
        }
      });
    }
  }

  /**
   * Получить статистику обработки
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalProcessed > 0 
        ? ((this.stats.totalSuccess / this.stats.totalProcessed) * 100).toFixed(1) + '%'
        : '0%',
      avgTime: this.stats.totalSuccess > 0
        ? `${(this.stats.totalTime / this.stats.totalSuccess).toFixed(0)}ms`
        : '0ms'
    };
  }

  /**
   * Сбросить статистику
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalTime: 0
    };
    logger.info(`Статистика обработки изображений сброшена`, {
      service: 'image-processing'
    });
  }
}

module.exports = new ImageProcessingService();

