const { pool } = require('../config/database');
const DepositService = require('./depositService');
const axios = require('axios');
const orderPaymentService = require('./orderPaymentService');

// Форматирование цен: "отсечь два последних нуля точкой" без арифметических операций
function formatDropTwoZeros(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const s = String(Math.trunc(n));
  if (!/^[0-9]+$/.test(s)) return null;
  const whole = s.length > 2 ? s.slice(0, -2) : '0';
  const cents = s.length > 1 ? s.slice(-2).padStart(2, '0') : s.padStart(2, '0');
  return `${whole}.${cents}`;
}

async function fetchWbNewFbs(apiKey) {
  const base = 'https://marketplace-api.wildberries.ru/api/v3';
  const path = '/orders/new';
  try {
    console.log(`🔍 FBS: получаем новые сборочные задания: ${base}${path}`);
    const resp = await axios.get(`${base}${path}`, { headers: { Authorization: apiKey } });
    console.log(`📊 Ответ WB FBS /orders/new:`, {
      status: resp.status,
      dataType: Array.isArray(resp.data) ? 'array' : typeof resp.data,
      dataLength: Array.isArray(resp.data) ? resp.data.length : (resp.data?.orders?.length || resp.data?.data?.length || 0),
      sample: Array.isArray(resp.data) ? resp.data[0] : (resp.data?.orders?.[0] || resp.data?.data?.[0] || null)
    });
    const data = resp.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.orders)) return data.orders;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (e) {
    console.error(`❌ WB FBS /orders/new error:`, e.response?.data || e.message);
    
    // Специальная обработка ошибки "token scope not allowed"
    if (e.response?.status === 401 && e.response?.data?.detail === 'token scope not allowed') {
      console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА: Токен не имеет разрешений для Marketplace API');
      console.error('📋 РЕШЕНИЕ:');
      console.error('1. Зайдите в личный кабинет Wildberries');
      console.error('2. Перейдите в Профиль → Интеграции → API');
      console.error('3. Создайте НОВЫЙ токен с категорией "Marketplace"');
      console.error('4. Обновите API ключ в настройках системы');
      console.error('5. Текущий токен может иметь только разрешения для Statistics API');
    }
    
    return [];
  }
}

async function fetchWbFbsStatuses(apiKey, ids) {
  if (!ids || ids.length === 0) return [];
  const base = 'https://marketplace-api.wildberries.ru/api/v3';
  const path = '/orders/status';
  const headers = { 'Authorization': apiKey, 'Content-Type': 'application/json' };
  const flat = (ids || []).filter(Boolean);
  const unique = Array.from(new Set(flat.map(v => String(v).trim()).filter(v => v.length > 0)));
  try {
    console.log(`🔎 FBS: статусы для ${unique.length} заданий`);
    // 1) сначала пробуем числа (официальный формат)
    const asNums = unique
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n > 0);
    if (asNums.length > 0) {
      try {
        const rNum = await axios.post(`${base}${path}`, { orders: asNums }, { headers });
        return rNum.data?.orders || [];
      } catch (eNum) {
        const bodyNum = eNum.response?.data;
        if (!bodyNum || bodyNum.code !== 'IncorrectRequestBody') throw eNum;
      }
    }

    // 2) затем строки
    try {
      const rStr = await axios.post(`${base}${path}`, { orders: unique }, { headers });
      return rStr.data?.orders || [];
    } catch (eStr) {
      const bodyStr = eStr.response?.data;
      if (!bodyStr || bodyStr.code !== 'IncorrectRequestBody') throw eStr;
    }

    // 3) затем объекты { id } как числа
    const asObjects = unique.map(id => ({ id: Number(id) }));
    const rObj = await axios.post(`${base}${path}`, { orders: asObjects }, { headers });
    return rObj.data?.orders || [];
  } catch (e) {
    console.error('❌ FBS statuses error:', e.response?.data || e.message);
    
    // Специальная обработка ошибки "token scope not allowed"
    if (e.response?.status === 401 && e.response?.data?.detail === 'token scope not allowed') {
      console.error('🚨 КРИТИЧЕСКАЯ ОШИБКА: Токен не имеет разрешений для Marketplace API');
      console.error('📋 РЕШЕНИЕ:');
      console.error('1. Зайдите в личный кабинет Wildberries');
      console.error('2. Перейдите в Профиль → Интеграции → API');
      console.error('3. Создайте НОВЫЙ токен с категорией "Marketplace"');
      console.error('4. Обновите API ключ в настройках системы');
      console.error('5. Текущий токен может иметь только разрешения для Statistics API');
    }
    
    return [];
  }
}

async function fetchWbFbsOrdersClient(apiKey, ids) {
  if (!ids || ids.length === 0) return [];
  const base = 'https://marketplace-api.wildberries.ru/api/v3';
  const path = '/orders/client';
  const headers = { 'Authorization': apiKey, 'Content-Type': 'application/json' };
  const unique = Array.from(new Set(ids.map(String)));
  try {
    console.log(`🔎 FBS: заказы с клиентской информацией для ${unique.length} заданий`);
    try {
      const r1 = await axios.post(`${base}${path}`, { orders: unique }, { headers });
      return r1.data?.orders || [];
    } catch (e1) {
      const body = e1.response?.data;
      if (!body || body.code !== 'IncorrectRequestBody') throw e1;
      const asNums = unique.map(v => Number.isFinite(Number(v)) ? Number(v) : v);
      try {
        const r2 = await axios.post(`${base}${path}`, { orders: asNums }, { headers });
        return r2.data?.orders || [];
      } catch (e2) {
        const body2 = e2.response?.data;
        if (!body2 || body2.code !== 'IncorrectRequestBody') throw e2;
        const r3 = await axios.post(`${base}${path}`, { orders: unique.map(id => ({ id })) }, { headers });
        return r3.data?.orders || [];
      }
    }
  } catch (e) {
    console.error('❌ FBS orders/client error:', e.response?.data || e.message);
    return [];
  }
}

// Дополнительная мета по товарам из statistics-api по nmId (subject/brand/supplierArticle)
async function fetchWbProductMetaByNmIds(apiKey, nmIds, opts = {}) {
  const metaMap = new Map();
  if (!nmIds || nmIds.length === 0) return metaMap;
  try {
    const unique = Array.from(new Set(nmIds.filter(n => Number.isFinite(Number(n))).map(n => Number(n))));
    if (unique.length === 0) return metaMap;

    const now = new Date();
    // если передали конкретный диапазон — используем его, иначе последние 7 дней
    const dateTo = opts.dateTo || now.toISOString().split('T')[0];
    const dateFrom = opts.dateFrom || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const resp = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
      headers: { Authorization: apiKey },
      params: { dateFrom, dateTo }
    });

    const rows = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
    for (const r of rows) {
      const nm = Number(r.nmId || r.nmid || r.nmID);
      if (!Number.isFinite(nm)) continue;
      if (!unique.includes(nm)) continue;
      if (!metaMap.has(nm)) {
        metaMap.set(nm, {
          subject: r.subject || undefined,
          brand: r.brand || undefined,
          name: r.subject && r.brand ? `${r.subject} (${r.brand})` : (r.subject || r.brand || undefined),
          supplierArticle: r.supplierArticle || r.article || undefined
        });
      }
    }
  } catch (e) {
    // тихо продолжаем, мета не критична
  }
  return metaMap;
}

function normalizeWbOrder(raw, orderType) {
  // Идентификатор заказа (для orders/new это как правило id)
  const orderId = raw.gNumber || raw.srid || raw.id || raw.orderId || raw.orderID || raw.orderUid || String(Date.now());

  // Дата создания: в orders/new для FBS/DBW/DBS поле createdAt
  let createdAt = new Date().toISOString();
  if (raw.createdAt) {
    createdAt = new Date(raw.createdAt).toISOString();
  } else if (raw.date) {
    createdAt = typeof raw.date === 'number' ? new Date(raw.date).toISOString() : new Date(raw.date).toISOString();
  }

  // Сумма (сырое значение из WB)
  const total =
    (typeof raw.finalPrice === 'number' && raw.finalPrice) ||
    (typeof raw.salePrice === 'number' && raw.salePrice) ||
    (typeof raw.price === 'number' && raw.price) ||
    (typeof raw.finishedPrice === 'number' && raw.finishedPrice) || 0;

  // Подготовим структуру pricing: сырые и отформатированные значения
  const pricing = {
    salePrice: raw.salePrice ?? null,
    price: raw.price ?? null,
    convertedPrice: raw.convertedPrice ?? null,
    finalPrice: raw.finalPrice ?? null,
    convertedFinalPrice: raw.convertedFinalPrice ?? null,
    formatted: {
      salePrice: formatDropTwoZeros(raw.salePrice),
      price: formatDropTwoZeros(raw.price),
      convertedPrice: formatDropTwoZeros(raw.convertedPrice),
      finalPrice: formatDropTwoZeros(raw.finalPrice),
      convertedFinalPrice: formatDropTwoZeros(raw.convertedFinalPrice),
      totalAmount: formatDropTwoZeros(total)
    }
  };

  // Адрес: DBW возвращает address.fullAddress, FBS может возвращать offices/officeId
  let deliveryAddress = 'Не указан';
  if (raw.address && (raw.address.fullAddress || raw.address.address)) {
    deliveryAddress = raw.address.fullAddress || raw.address.address;
  } else if (Array.isArray(raw.offices) && raw.offices.length > 0) {
    deliveryAddress = `ПВЗ: ${raw.offices[0]}`;
  } else if (raw.regionName || raw.oblastOkrugName) {
    deliveryAddress = `${raw.regionName || ''}${raw.oblastOkrugName ? ', ' + raw.oblastOkrugName : ''}`.replace(/^,\s*|,\s*$/g, '') || 'Не указан';
  }

  // Товар: минимальная карточка из nmId/chrtId/article
  const itemNameBase = raw.subject || 'Товар';
  const itemBrand = raw.brand ? ` (${raw.brand})` : '';
  const itemName = `${itemNameBase}${itemBrand}`.trim();
  const article = raw.supplierArticle || raw.article || raw.nmId?.toString() || 'unknown';
  const subject = raw.subject || undefined;
  const brand = raw.brand || undefined;
  const nmId = raw.nmId || undefined;
  const chrtId = raw.chrtId || undefined;
  const skus = Array.isArray(raw.skus) ? raw.skus : (raw.sku ? [raw.sku] : undefined);
  const orderUid = raw.orderUid || undefined;
  const rid = raw.rid || undefined;

  return {
    orderId: String(orderId),
    marketplace: 'wildberries',
    status: 'new',
    totalAmount: total,
    customerName: 'Клиент Wildberries',
    customerPhone: '',
    customerEmail: '',
    deliveryAddress,
    items: [
      {
        article,
        name: itemName,
        quantity: 1,
        price: total,
        totalPrice: total,
        priceFormatted: pricing.formatted.price || pricing.formatted.finalPrice || pricing.formatted.totalAmount,
        totalPriceFormatted: pricing.formatted.totalAmount,
        subject,
        brand,
        nmId,
        chrtId,
        skus,
        orderUid,
        rid
      }
    ],
    orderDate: createdAt,
    orderType,
    pricing
  };
}

async function upsertOrders(clientId, orders) {
  if (!orders || orders.length === 0) return 0;
  const client = await pool.connect();
  try {
    let saved = 0;
    for (const o of orders) {
      try {
        // Проверяем, существует ли уже заказ
        const existingOrderResult = await client.query(
          'SELECT id, status FROM orders WHERE client_id = $1 AND marketplace_order_id = $2 AND marketplace = $3',
          [clientId, o.orderId, o.marketplace]
        );

        const isNewOrder = existingOrderResult.rows.length === 0;
        const existingOrder = existingOrderResult.rows[0];

        await client.query(
          `INSERT INTO orders (client_id, marketplace_order_id, marketplace, status, total_amount, customer_name, customer_phone, customer_email, delivery_address, items, created_at, order_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (client_id, marketplace_order_id, marketplace) DO UPDATE SET
             status = EXCLUDED.status,
             total_amount = EXCLUDED.total_amount,
             customer_name = EXCLUDED.customer_name,
             customer_phone = EXCLUDED.customer_phone,
             customer_email = EXCLUDED.customer_email,
             delivery_address = EXCLUDED.delivery_address,
             items = EXCLUDED.items,
             order_type = EXCLUDED.order_type,
             updated_at = CURRENT_TIMESTAMP`,
          [
            clientId,
            o.orderId,
            o.marketplace,
            o.status,
            o.totalAmount,
            o.customerName,
            o.customerPhone,
            o.customerEmail,
            o.deliveryAddress,
            JSON.stringify(o.items),
            o.orderDate || new Date().toISOString(),
            o.orderType || 'FBS'
          ]
        );

        // Если это новый заказ или заказ изменил статус на "новый", обрабатываем платеж
        if (isNewOrder || (existingOrder && existingOrder.status !== 'new' && o.status === 'new')) {
          try {
            const paymentResult = await orderPaymentService.processOrderPayment(clientId, o);
            if (paymentResult.success) {
              console.log(`Payment processed for order ${o.orderId}: ${paymentResult.amount} ₽`);
            } else {
              console.warn(`Payment failed for order ${o.orderId}: ${paymentResult.error}`);
            }
          } catch (paymentError) {
            console.error(`Payment processing error for order ${o.orderId}:`, paymentError);
          }
        }

        saved++;
      } catch (e) {
        console.error('Upsert order error:', e.message);
      }
    }
    return saved;
  } finally {
    client.release();
  }
}

async function autoImportOrders() {
  const client = await pool.connect();
  try {
    const users = await client.query('SELECT id FROM users WHERE is_active = true');
    for (const row of users.rows) {
      try {
        const clientRes = await client.query('SELECT id, api_keys FROM clients WHERE user_id = $1', [row.id]);
        if (clientRes.rows.length === 0) continue;
        const clientId = clientRes.rows[0].id;
        const apiKeys = clientRes.rows[0].api_keys || {};
        const wbKey = apiKeys.wildberries?.api_key;
        if (!wbKey) continue;

        console.log(`🔄 Импорт WB для пользователя ${row.id} (client_id: ${clientId})`);

        // 1) Получаем новые задания FBS
        const fbsNew = await fetchWbNewFbs(wbKey);
        console.log(`📦 FBS новые: ${fbsNew.length}`);

        // 2) Тянем статусы для полноты картины (supplierStatus/wbStatus)
        const fbsIds = fbsNew.map(o => o.id || o.orderId || o.orderID || o.orderUid).filter(Boolean);
        const fbsStatuses = await fetchWbFbsStatuses(wbKey, fbsIds);
        const statusMap = new Map();
        for (const s of fbsStatuses) statusMap.set(String(s.id), s);

        // 3) Тянем детальную информацию о заказе с данными клиента (если доступно)
        const fbsWithClient = await fetchWbFbsOrdersClient(wbKey, fbsIds);
        const clientMap = new Map();
        for (const c of fbsWithClient) clientMap.set(String(c.id), c);

        // 4) Тянем мету по nmId для имени/категории/бренда/артикула
        const nmIds = fbsNew.map(o => o.nmId).filter(Boolean);
        // мета строго за текущий день
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const metaByNm = await fetchWbProductMetaByNmIds(wbKey, nmIds, { dateFrom: todayStr, dateTo: todayStr });

        const toSave = fbsNew.map(r => {
          const o = normalizeWbOrder(r, 'FBS');
          const sid = String(r.id || r.orderId || r.orderID || r.orderUid);
          const st = statusMap.get(sid);
          if (st) {
            o.supplierStatus = st.supplierStatus || null;
            o.wbStatus = st.wbStatus || null;
            if (Array.isArray(o.items) && o.items.length > 0) {
              o.items[0].supplierStatus = st.supplierStatus || null;
              o.items[0].wbStatus = st.wbStatus || null;
              // расшифровки
              const supplierStatusTextMap = {
                new: 'Новое сборочное задание',
                confirm: 'На сборке',
                complete: 'В доставке',
                cancel: 'Отменено продавцом'
              };
              const wbStatusTextMap = {
                waiting: 'В работе',
                sorted: 'Отсортировано',
                sold: 'Получено покупателем',
                canceled: 'Отменено',
                canceled_by_client: 'Отменено покупателем при получении',
                declined_by_client: 'Отменено покупателем (в первый час)',
                defect: 'Отменено (брак)',
                ready_for_pickup: 'Прибыло в ПВЗ'
              };
              o.items[0].supplierStatusText = supplierStatusTextMap[st.supplierStatus] || null;
              o.items[0].wbStatusText = wbStatusTextMap[st.wbStatus] || null;
            }
          }
          const cd = clientMap.get(sid);
          if (cd) {
            // Обогащаем данными клиента, если WB вернул
            if (cd.client) {
              o.customerName = [cd.client.lastName, cd.client.firstName].filter(Boolean).join(' ') || o.customerName;
              o.customerPhone = cd.client.phone || o.customerPhone;
              o.customerEmail = cd.client.email || o.customerEmail;
            }
            if (cd.address && (cd.address.fullAddress || cd.address.address)) {
              o.deliveryAddress = cd.address.fullAddress || cd.address.address;
            }
          }
          // Обогащаем товарной метой, если есть nmId
          if (r.nmId) {
            const meta = metaByNm.get(Number(r.nmId));
            if (meta) {
              const name = meta.name || o.items?.[0]?.name;
              const article = meta.supplierArticle || o.items?.[0]?.article;
              if (Array.isArray(o.items) && o.items.length > 0) {
                o.items[0].name = name || o.items[0].name;
                o.items[0].article = article || o.items[0].article;
                o.items[0].subject = meta.subject || o.items[0].subject;
                o.items[0].brand = meta.brand || o.items[0].brand;
              }
            }
          }
          // Сохраняем id сборочного задания внутрь items для удобства работы в UI/отчётах
          if (Array.isArray(o.items) && o.items.length > 0) {
            o.items[0].assignmentId = sid;
            o.items[0].orderType = 'FBS';
          }
          return o;
        });

        // Подробные логи по каждому заказу (после обогащения)
        for (const o of toSave) {
          const it = Array.isArray(o.items) && o.items[0] ? o.items[0] : {};
          console.log('🧾 WB заказ (enriched):', {
            orderId: o.orderId,
            assignmentId: it.assignmentId || null,
            orderType: it.orderType || o.orderType || 'FBS',
            item: {
              name: it.name || null,
              subject: it.subject || null,
              brand: it.brand || null,
              article: it.article || null,
              nmId: it.nmId || null,
              chrtId: it.chrtId || null,
              skus: it.skus || null
            },
            pricing: {
              totalAmount: o.totalAmount,
              price: it.price,
              totalPrice: it.totalPrice,
              formatted: o.pricing?.formatted || null
            },
            statuses: {
              supplierStatus: it.supplierStatus || o.supplierStatus || null,
              supplierStatusText: it.supplierStatusText || null,
              wbStatus: it.wbStatus || o.wbStatus || null,
              wbStatusText: it.wbStatusText || null
            },
            deliveryAddress: o.deliveryAddress
          });
        }

        console.log(`🔄 Нормализовано заказов: ${toSave.length}`);
        if (toSave.length > 0) {
          const saved = await upsertOrders(clientId, toSave);
          console.log(`✅ WB import завершен: user ${row.id}, сохранено ${saved}/${toSave.length}`);
        } else {
          console.log(`ℹ️ Нет новых заказов через /orders/new для user ${row.id}`);
        }

        // 5) Обновляем статусы уже существующих «новых» заказов в нашей БД,
        // чтобы они автоматически исчезали с вкладки "Заказы" и попадали в историю
        try {
          const openRes = await client.query(
            `SELECT id, marketplace_order_id, items, order_type, created_at
             FROM orders
             WHERE client_id = $1
               AND marketplace = 'wildberries'
               AND status = 'new'
               AND order_type = 'FBS'
               AND created_at > NOW() - INTERVAL '30 days'`,
            [clientId]
          );
          const openOrders = openRes.rows || [];
          if (openOrders.length > 0) {
            const ids = [];
            for (const o of openOrders) {
              // Пытаемся взять assignmentId из items[0], иначе используем marketplace_order_id,
              // но только если это корректный числовой идентификатор WB задания
              let itemFirst = Array.isArray(o.items) && o.items[0] ? o.items[0] : null;
              let candidate = itemFirst && itemFirst.assignmentId ? itemFirst.assignmentId : o.marketplace_order_id;
              const asNum = Number(candidate);
              if (Number.isFinite(asNum) && asNum > 1000000000) {
                ids.push(asNum);
              }
            }
            if (ids.length === 0) {
              console.log('ℹ️ Нет валидных FBS ID для обновления статусов (пропущены старые gNumber и нечисловые идентификаторы)');
            }
            const latestStatuses = await fetchWbFbsStatuses(wbKey, ids);
            const latestMap = new Map();
            for (const s of latestStatuses || []) latestMap.set(String(s.id), s);

            const mapWbToAppStatus = (supplierStatus, wbStatus) => {
              // Простое правило:
              // - supplierStatus=new -> new
              // - supplierStatus=confirm -> in_assembly
              // - supplierStatus=complete -> shipped
              // - supplierStatus=cancel -> cancelled
              // Доп. по wbStatus: sold -> delivered
              if (wbStatus === 'sold') return 'delivered';
              if (supplierStatus === 'cancel') return 'cancelled';
              if (supplierStatus === 'complete') return 'shipped';
              if (supplierStatus === 'confirm') return 'in_assembly';
              return 'new';
            };

            for (const ord of openOrders) {
              const st = latestMap.get(String(ord.marketplace_order_id));
              if (!st) continue;
              const newStatus = mapWbToAppStatus(st.supplierStatus, st.wbStatus);
              if (newStatus !== 'new') {
                try {
                  // Опционально обновим статусы и внутри первого товара, если он есть
                  let items = Array.isArray(ord.items) ? ord.items : [];
                  if (items.length > 0) {
                    items = items.map((it, idx) => idx === 0 ? {
                      ...it,
                      supplierStatus: st.supplierStatus || it.supplierStatus || null,
                      wbStatus: st.wbStatus || it.wbStatus || null
                    } : it);
                  }
                  await client.query(
                    `UPDATE orders SET status = $1, items = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                    [newStatus, JSON.stringify(items), ord.id]
                  );
                  console.log(`↪️ Обновлен статус заказа ${ord.marketplace_order_id} -> ${newStatus}`);
                } catch (e) {
                  console.error('Update status error:', e.message);
                }
              }
            }
          }
        } catch (e) {
          console.error('Refresh WB statuses error:', e.message);
        }
      } catch (e) {
        console.error('Hourly WB import error for user', row.id, e.message);
      }
    }
  } finally {
    client.release();
  }
}

module.exports = { autoImportOrders };


