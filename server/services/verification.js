const crypto = require('crypto');
const nodemailer = require('nodemailer');

class VerificationService {
  constructor() {
    // Настройка email транспорта
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Генерация кода верификации
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Генерация секрета для 2FA
  generateTwoFactorSecret() {
    return crypto.randomBytes(32).toString('base64');
  }

  // Генерация случайного пароля для оператора
  generateOperatorPassword() {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Гарантируем наличие хотя бы одной заглавной буквы, одной строчной, одной цифры и одного спецсимвола
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    
    // Заполняем остальные символы
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Перемешиваем символы
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Отправка кода на email
  async sendEmailVerification(email, code) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@yourcompany.com',
        to: email,
        subject: 'Код подтверждения регистрации',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Подтверждение регистрации</h2>
            <p>Здравствуйте!</p>
            <p>Для завершения регистрации введите следующий код подтверждения:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
            </div>
            <p>Код действителен в течение 10 минут.</p>
            <p>Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Это автоматическое сообщение, не отвечайте на него.</p>
          </div>
        `
      };

      await this.emailTransporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Отправка пароля оператору
  async sendOperatorPassword(email, password, adminName) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@yourcompany.com',
        to: email,
        subject: 'Доступ к системе дропшиппинга',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Добро пожаловать в систему!</h2>
            <p>Здравствуйте!</p>
            <p>Администратор <strong>${adminName}</strong> создал для вас аккаунт оператора в системе автоматизации дропшиппинга.</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Данные для входа:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Пароль:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            </div>
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0c5460; margin-top: 0;">⚠️ Важно:</h4>
              <ul style="color: #0c5460; margin: 0;">
                <li>Смените пароль при первом входе в систему</li>
                <li>Не передавайте данные для входа третьим лицам</li>
                <li>При подозрении на компрометацию аккаунта обратитесь к администратору</li>
              </ul>
            </div>
            <p>Для входа в систему перейдите по ссылке: <a href="${process.env.FRONTEND_URL || 'https://telematius.ru'}/login" style="color: #007bff;">Войти в систему</a></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Это автоматическое сообщение, не отвечайте на него.</p>
          </div>
        `
      };

      await this.emailTransporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Отправка SMS (заглушка - в реальном проекте использовать SMS API)
  async sendSMSVerification(phone, code) {
    try {
      // Здесь должен быть реальный SMS API (например, SMS.ru, Twilio и т.д.)
      console.log(`SMS отправлен на ${phone}: Ваш код подтверждения: ${code}`);
      
      // Имитация задержки
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      console.error('SMS sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Проверка кода верификации
  async verifyCode(userId, code, type, { pool }) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM verification_codes 
         WHERE user_id = $1 AND type = $2 AND code = $3 AND expires_at > NOW()`,
        [userId, type, code]
      );

      if (result.rows.length === 0) {
        // Увеличиваем счетчик попыток
        await client.query(
          `UPDATE verification_codes 
           SET attempts = attempts + 1 
           WHERE user_id = $1 AND type = $2`,
          [userId, type]
        );
        return { success: false, error: 'Неверный или истекший код' };
      }

      // Удаляем использованный код
      await client.query(
        'DELETE FROM verification_codes WHERE user_id = $1 AND type = $2',
        [userId, type]
      );

      return { success: true };
    } finally {
      client.release();
    }
  }

  // Сохранение кода верификации
  async saveVerificationCode(userId, code, type, { pool }) {
    const client = await pool.connect();
    try {
      // Удаляем старые коды
      await client.query(
        'DELETE FROM verification_codes WHERE user_id = $1 AND type = $2',
        [userId, type]
      );

      // Сохраняем новый код
      await client.query(
        `INSERT INTO verification_codes (user_id, type, code, expires_at) 
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [userId, type, code]
      );

      return { success: true };
    } finally {
      client.release();
    }
  }

  // Проверка ИНН через API ФНС
  async verifyINN(inn, companyForm) {
    try {
      const apiKey = process.env.FNS_API_KEY;
      if (!apiKey) {
        console.warn('FNS API key not configured');
        return { success: false, error: 'API ключ ФНС не настроен' };
      }

      // Используем метод egr для получения данных о компании по ИНН
      const response = await fetch(`https://api-fns.ru/api/egr?req=${inn}&key=${apiKey}`);
      const data = await response.json();

      // Проверяем наличие ошибок в ответе
      if (data.status === 'error' || !data.items || data.items.length === 0) {
        return { 
          success: false, 
          error: 'Мы не нашли Вашу компанию на сайте ФНС. Возможно, вы только открыли ООО, ИП и данные не обновились, просьба попробовать позже.' 
        };
      }

      const companyData = data.items[0];
      
      // Проверяем соответствие формы компании
      // В API-ФНС для ИП нет поля "ЮЛ", а для ООО есть
      const isIP = !companyData.ЮЛ || companyData.ЮЛ === false;
      const foundForm = isIP ? 'IP' : 'OOO';
      
      if (foundForm !== companyForm) {
        return { 
          success: false, 
          error: `Форма компании не соответствует. В ФНС зарегистрировано как ${foundForm === 'OOO' ? 'ООО' : 'ИП'}` 
        };
      }

      // Проверяем, что компания действующая
      if (companyData.Статус && companyData.Статус.toLowerCase().includes('ликвидир')) {
        return {
          success: false,
          error: 'Компания ликвидирована согласно данным ФНС'
        };
      }

      // Дополнительная проверка на недобросовестность
      const checkResult = await this.checkCompanyReliability(inn, apiKey);
      
      return { 
        success: true, 
        data: {
          inn: companyData.ИНН,
          name: companyData.Наименование || companyData.ФИО,
          status: companyData.Статус,
          form: foundForm,
          address: companyData.Адрес,
          registrationDate: companyData.ДатаРегистрации,
          ogrn: companyData.ОГРН,
          kpp: companyData.КПП,
          reliability: checkResult
        }
      };
    } catch (error) {
      console.error('FNS API error:', error);
      return { 
        success: false, 
        error: 'Ошибка проверки через ФНС. Попробуйте позже.' 
      };
    }
  }

  // Проверка надежности компании (признаки недобросовестности)
  async checkCompanyReliability(inn, apiKey) {
    try {
      const response = await fetch(`https://api-fns.ru/api/check?inn=${inn}&key=${apiKey}`);
      const data = await response.json();

      if (data.status === 'error' || !data.items) {
        return { 
          status: 'unknown',
          message: 'Не удалось проверить надежность компании'
        };
      }

      const checkData = data.items[0];
      const warnings = [];

      // Проверяем различные признаки недобросовестности
      if (checkData.МассовыйДиректор === 'Да') {
        warnings.push('Массовый директор');
      }
      if (checkData.МассовыйУчредитель === 'Да') {
        warnings.push('Массовый учредитель');
      }
      if (checkData.НедостоверныеДанные === 'Да') {
        warnings.push('Недостоверные данные');
      }
      if (checkData.Ликвидация === 'Да') {
        warnings.push('Процедура ликвидации');
      }
      if (checkData.Реорганизация === 'Да') {
        warnings.push('Процедура реорганизации');
      }

      return {
        status: warnings.length > 0 ? 'warning' : 'good',
        warnings: warnings,
        message: warnings.length > 0 
          ? `Обнаружены признаки недобросовестности: ${warnings.join(', ')}`
          : 'Компания прошла проверку на надежность'
      };
    } catch (error) {
      console.error('Company reliability check error:', error);
      return { 
        status: 'unknown',
        message: 'Ошибка проверки надежности компании'
      };
    }
  }

  // Генерация QR кода для 2FA
  generateQRCode(secret, email) {
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent('Your Company')}`;
    return qrCodeUrl;
  }

  // Проверка TOTP кода
  verifyTOTP(secret, code) {
    const speakeasy = require('speakeasy');
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2
    });
  }
}

module.exports = new VerificationService();
