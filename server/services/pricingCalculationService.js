const { Pool } = require('pg');

class PricingCalculationService {
  constructor() {
    // Создаем отдельное подключение с правильными настройками
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dropshipping_db',
      user: 'dropshipping', // Принудительно используем правильного пользователя
      password: 'KeyOfWorld2025', // Принудительно используем правильный пароль
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Рассчитывает оптимальную цену товара
   * @param {Object} product - Данные о товаре
   * @param {Object} settings - Настройки ценообразования
   * @returns {Object} Результат расчета цены
   */
  calculateOptimalPrice(product, settings) {
    const {
      markup_percent,
      acquiring_percent,
      first_liter_logistics_rub,
      additional_liter_logistics_rub,
      warehouse_coeff_percent,
      shipment_handling_rub,
      min_purchase_price_rub,
      max_purchase_price_rub,
      maintain_margin_in_promotions,
      auto_exit_promotions
    } = settings;

    // Получаем закупочную цену из прайс-листа или используем расчетную
    const purchasePrice = this.getPurchasePrice(product, min_purchase_price_rub, max_purchase_price_rub);
    
    if (!purchasePrice) {
      return {
        error: 'Purchase price not found',
        recommendedAction: 'skip'
      };
    }

    // Рассчитываем логистические затраты
    const logisticsCost = this.calculateLogisticsCost(product, {
      first_liter_logistics_rub,
      additional_liter_logistics_rub,
      warehouse_coeff_percent,
      shipment_handling_rub
    });

    // Нормализуем параметры как числа
    const commissionPercent = parseFloat(product.commission_percent) || 5.0; // % комиссии МП
    const acquiringPercent = parseFloat(acquiring_percent) || 0; // % эквайринга
    const targetMarginPercent = parseFloat(markup_percent) || 0; // целевая маржа клиента

    // Фиксированные затраты (не зависят от цены продажи): закупка + логистика
    const fixedCost = parseFloat(purchasePrice) + parseFloat(logisticsCost);

    // Комиссия и эквайринг считаются от конечной цены продажи (с учетом акции)
    // Решаем уравнение по целевой марже m: P_sale = fixed + c*P_sale + a*P_sale + m*P_sale
    // => P_sale * (1 - c - a - m) = fixed => P_sale = fixed / (1 - c - a - m)
    const c = commissionPercent / 100;
    const a = acquiringPercent / 100;
    const m = targetMarginPercent / 100;

    // Защита от деления на ноль/отрицательных значений
    const denom = 1 - c - a - m;
    if (denom <= 0.0001) {
      return {
        error: 'Invalid pricing parameters: commission + acquiring + margin >= 100%',
        recommendedAction: 'adjust_settings'
      };
    }

    // Базовая требуемая цена продажи (если нет акции)
    const requiredSalePrice = fixedCost / denom;
    let isInPromotion = product.in_promotion || false;
    const promotionDiscount = parseFloat(product.promotion_discount_percent) || 0;

    // Если есть акция и нужно удерживать маржу, повышаем до предпромо-цены
    let finalPrice = requiredSalePrice; // цена, которую выставляем в карточке (до скидки)
    if (isInPromotion && promotionDiscount > 0) {
      if (maintain_margin_in_promotions) {
        const d = promotionDiscount / 100;
        const prePromoPrice = requiredSalePrice / (1 - d); // чтобы после скидки маржа сохранилась
        finalPrice = prePromoPrice;
      } else {
        // Не удерживаем маржу: целевая цена без акции, скидка уменьшит фактическую маржу
        finalPrice = requiredSalePrice;
      }
    }

    // Фактическая цена продажи для расчета комиссий (после скидки, если акция активна)
    const effectiveSalePrice = isInPromotion && promotionDiscount > 0
      ? finalPrice * (1 - promotionDiscount / 100)
      : finalPrice;

    // Стоимость комиссии и эквайринга от фактической цены продажи
    const commissionCost = effectiveSalePrice * c;
    const acquiringCost = effectiveSalePrice * a;

    // Полная себестоимость с учетом процентов от цены продажи
    const baseCost = fixedCost + commissionCost + acquiringCost;

    // Целевая цена (для совместимости с фронтом) = требуемая цена без акции
    const targetPrice = requiredSalePrice;

    // Проверяем участие в акции
    let actualMargin = 0;
    let recommendedAction = 'no_change';

    // Фактическая маржа на цене продажи (после скидки)
    actualMargin = ((effectiveSalePrice - baseCost) / effectiveSalePrice) * 100;

    // Рекомендации при акциях
    if (isInPromotion && promotionDiscount > 0 && !maintain_margin_in_promotions) {
      if (actualMargin < targetMarginPercent * 100 * 0.5) {
        recommendedAction = auto_exit_promotions ? 'exit_promotion' : 'warning_low_margin';
      } else {
        recommendedAction = 'maintain_promotion';
      }
    }

    // Округляем выставляемую цену и производные значения
    finalPrice = Math.round(finalPrice * 100) / 100;
    const roundedEffectiveSalePrice = Math.round(effectiveSalePrice * 100) / 100;
    const roundedCommissionCost = Math.round(commissionCost * 100) / 100;
    const roundedAcquiringCost = Math.round(acquiringCost * 100) / 100;
    const roundedBaseCost = Math.round(baseCost * 100) / 100;

    return {
      purchasePrice,
      baseCost: roundedBaseCost,
      targetPrice,
      finalPrice,
      actualMargin: Math.round(actualMargin * 100) / 100,
      targetMargin: markup_percent,
      logisticsCost,
      commissionCost: roundedCommissionCost,
      acquiringCost: roundedAcquiringCost,
      isInPromotion,
      promotionDiscount,
      recommendedAction,
      calculationDetails: {
        markup_percent,
        acquiring_percent,
        commission_percent: commissionPercent,
        warehouse_coeff_percent,
        maintain_margin_in_promotions,
        auto_exit_promotions,
        effective_sale_price: roundedEffectiveSalePrice
      }
    };
  }

  /**
   * Получает закупочную цену товара
   * @param {Object} product - Данные о товаре
   * @param {number} minPrice - Минимальная закупочная цена
   * @param {number} maxPrice - Максимальная закупочная цена
   * @returns {number|null} Закупочная цена или null
   */
  getPurchasePrice(product, minPrice, maxPrice) {
    // Сначала пытаемся найти в прайс-листе
    // В реальной реализации здесь должен быть запрос к базе данных
    // Пока используем расчетную цену на основе текущей цены продажи
    
    const estimatedPurchasePrice = product.current_price * 0.6; // 60% от цены продажи
    
    if (estimatedPurchasePrice >= minPrice && estimatedPurchasePrice <= maxPrice) {
      return estimatedPurchasePrice;
    }
    
    return null;
  }

  /**
   * Рассчитывает логистические затраты
   * @param {Object} product - Данные о товаре
   * @param {Object} logisticsSettings - Настройки логистики
   * @returns {number} Стоимость логистики
   */
  calculateLogisticsCost(product, logisticsSettings) {
    const {
      first_liter_logistics_rub,
      additional_liter_logistics_rub,
      warehouse_coeff_percent,
      shipment_handling_rub
    } = logisticsSettings;

    // Используем объем из кэша или рассчитываем
    let volumeLiters = product.volume_liters;
    
    if (!volumeLiters && product.length_cm && product.width_cm && product.height_cm) {
      volumeLiters = (product.length_cm * product.width_cm * product.height_cm) / 1000;
    }

    if (!volumeLiters) {
      return shipment_handling_rub; // Только обработка отправления
    }

    // Рассчитываем стоимость логистики по объему
    let logisticsCost = first_liter_logistics_rub;
    
    if (volumeLiters > 1) {
      logisticsCost += (volumeLiters - 1) * additional_liter_logistics_rub;
    }

    // Применяем коэффициент склада
    if (warehouse_coeff_percent > 0) {
      logisticsCost *= (1 + warehouse_coeff_percent / 100);
    }

    // Добавляем обработку отправления
    logisticsCost += shipment_handling_rub;

    return Math.round(logisticsCost * 100) / 100;
  }

  /**
   * Проверяет необходимость обновления цены
   * @param {Object} product - Данные о товаре
   * @param {Object} settings - Настройки ценообразования
   * @returns {Object} Результат проверки
   */
  async checkPriceUpdateNeeded(product, settings) {
    const calculation = this.calculateOptimalPrice(product, settings);
    
    if (calculation.error) {
      return {
        needsUpdate: false,
        reason: calculation.error,
        recommendedAction: calculation.recommendedAction
      };
    }

    const currentPrice = product.current_price;
    const calculatedPrice = calculation.finalPrice;
    const priceDifference = Math.abs(currentPrice - calculatedPrice);
    const priceDifferencePercent = (priceDifference / currentPrice) * 100;

    // Обновляем цену если разница больше 1% или есть рекомендация по акции
    const needsUpdate = priceDifferencePercent > 1 || 
                       calculation.recommendedAction === 'exit_promotion' ||
                       calculation.recommendedAction === 'adjust_price';

    return {
      needsUpdate,
      currentPrice,
      calculatedPrice,
      priceDifference,
      priceDifferencePercent: Math.round(priceDifferencePercent * 100) / 100,
      recommendedAction: calculation.recommendedAction,
      actualMargin: calculation.actualMargin,
      targetMargin: calculation.targetMargin,
      calculation
    };
  }

  /**
   * Получает товары, требующие обновления цен
   * @param {number} clientId - ID клиента
   * @returns {Array} Массив товаров для обновления
   */
  async getProductsNeedingPriceUpdate(clientId) {
    const client = await this.pool.connect();
    try {
      // Получаем настройки ценообразования клиента
      const settings = await this.getClientPricingSettings(clientId);
      
      // Получаем активные товары клиента
      const productsQuery = `
        SELECT * FROM wb_products_cache 
        WHERE client_id = $1 AND is_active = true
        ORDER BY last_updated DESC
      `;
      
      const productsResult = await client.query(productsQuery, [clientId]);
      const products = productsResult.rows;
      
      const productsToUpdate = [];
      
      for (const product of products) {
        const checkResult = await this.checkPriceUpdateNeeded(product, settings);
        
        if (checkResult.needsUpdate) {
          productsToUpdate.push({
            product,
            checkResult,
            settings
          });
        }
      }
      
      return productsToUpdate;
    } finally {
      client.release();
    }
  }

  /**
   * Получает настройки ценообразования клиента
   * @param {number} clientId - ID клиента
   * @returns {Object} Настройки ценообразования
   */
  async getClientPricingSettings(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM client_pricing_settings 
        WHERE client_id = $1 AND marketplace = 'wildberries'
      `;
      
      const result = await client.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        throw new Error('Pricing settings not found for client');
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Логирует изменение цены
   * @param {number} clientId - ID клиента
   * @param {Object} product - Данные о товаре
   * @param {Object} calculation - Результат расчета
   * @param {string} changeReason - Причина изменения
   * @param {string} changeSource - Источник изменения
   */
  async logPriceChange(clientId, product, calculation, changeReason, changeSource = 'system') {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO pricing_history (
          client_id, nm_id, article, old_price, new_price, calculated_price,
          markup_percent, acquiring_percent, logistics_cost, commission_percent,
          margin_percent, change_reason, change_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      const values = [
        clientId,
        product.nm_id,
        product.article,
        product.current_price,
        calculation.finalPrice,
        calculation.finalPrice,
        calculation.calculationDetails.markup_percent,
        calculation.calculationDetails.acquiring_percent,
        calculation.logisticsCost,
        calculation.calculationDetails.commission_percent,
        calculation.actualMargin,
        changeReason,
        changeSource
      ];
      
      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * Получает статистику ценообразования
   * @param {number} clientId - ID клиента
   * @param {string} period - Период (day/week/month)
   * @returns {Object} Статистика
   */
  async getPricingStatistics(clientId, period = 'week') {
    const client = await this.pool.connect();
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'day':
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${dayAgo.toISOString()}'`;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${monthAgo.toISOString()}'`;
          break;
      }

      const query = `
        SELECT 
          COUNT(*) as total_changes,
          COUNT(CASE WHEN change_reason = 'auto' THEN 1 END) as auto_changes,
          COUNT(CASE WHEN change_reason = 'manual' THEN 1 END) as manual_changes,
          COUNT(CASE WHEN change_reason = 'promotion_exit' THEN 1 END) as promotion_exits,
          AVG(margin_percent) as avg_margin,
          AVG(calculated_price - old_price) as avg_price_change
        FROM pricing_history 
        WHERE client_id = $1 ${dateFilter}
      `;
      
      const result = await client.query(query, [clientId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = PricingCalculationService;
