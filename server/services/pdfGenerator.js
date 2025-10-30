const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  constructor() {
    this.invoicesDir = path.join(__dirname, '..', 'invoices');
    this.ensureInvoicesDirectory();
  }

  ensureInvoicesDirectory() {
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
    }
  }

  generateInvoice(invoiceData) {
    const {
      invoiceNumber,
      clientName,
      clientInn,
      clientAddress,
      amount,
      purpose,
      bankAccount,
      bankName,
      bankBik,
      bankCorrAccount,
      createdAt
    } = invoiceData;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
    const filePath = path.join(this.invoicesDir, fileName);
    
    doc.pipe(fs.createWriteStream(filePath));

    // Заголовок документа
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('СЧЕТ НА ОПЛАТУ', { align: 'center' });

    doc.moveDown(1);

    // Информация о счете
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Номер счета: ${invoiceNumber}`, { align: 'right' })
       .text(`Дата: ${createdAt}`, { align: 'right' });

    doc.moveDown(2);

    // Информация о поставщике
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('ПОСТАВЩИК:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text('ООО "Дропшиппинг Платформа"', 50, doc.y + 20)
       .text('ИНН: 1234567890', 50, doc.y + 5)
       .text('Адрес: г. Москва, ул. Примерная, д. 1', 50, doc.y + 5);

    doc.moveDown(1);

    // Информация о покупателе
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('ПОКУПАТЕЛЬ:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text(clientName, 50, doc.y + 20)
       .text(`ИНН: ${clientInn}`, 50, doc.y + 5)
       .text(`Адрес: ${clientAddress}`, 50, doc.y + 5);

    doc.moveDown(2);

    // Таблица с товарами/услугами
    const tableTop = doc.y;
    const itemHeight = 30;
    const col1 = 50;
    const col2 = 300;
    const col3 = 450;
    const col4 = 550;

    // Заголовки таблицы
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Наименование', col1, tableTop)
       .text('Кол-во', col2, tableTop)
       .text('Цена', col3, tableTop)
       .text('Сумма', col4, tableTop);

    // Линия под заголовками
    doc.moveTo(col1, tableTop + 20)
       .lineTo(col4 + 100, tableTop + 20)
       .stroke();

    // Строка с услугой
    const serviceRow = tableTop + 30;
    doc.fontSize(10)
       .font('Helvetica')
       .text('Пополнение депозита', col1, serviceRow)
       .text('1', col2, serviceRow)
       .text(`${amount.toFixed(2)} ₽`, col3, serviceRow)
       .text(`${amount.toFixed(2)} ₽`, col4, serviceRow);

    // Линия под строкой
    doc.moveTo(col1, serviceRow + 20)
       .lineTo(col4 + 100, serviceRow + 20)
       .stroke();

    // Итого
    const totalRow = serviceRow + 40;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`Итого: ${amount.toFixed(2)} ₽`, col3, totalRow);

    doc.moveDown(3);

    // Банковские реквизиты
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('БАНКОВСКИЕ РЕКВИЗИТЫ:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Получатель: ООО "Дропшиппинг Платформа"`, 50, doc.y + 20)
       .text(`Счет: ${bankAccount}`, 50, doc.y + 5)
       .text(`Банк: ${bankName}`, 50, doc.y + 5)
       .text(`БИК: ${bankBik}`, 50, doc.y + 5)
       .text(`Корр. счет: ${bankCorrAccount}`, 50, doc.y + 5)
       .text(`Назначение платежа: ${purpose}`, 50, doc.y + 5);

    doc.moveDown(2);

    // Подписи
    doc.fontSize(12)
       .font('Helvetica')
       .text('Руководитель: _______________', 50, doc.y)
       .text('Главный бухгалтер: _______________', 300, doc.y);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve({
          fileName,
          filePath,
          relativePath: `invoices/${fileName}`
        });
      });
      
      doc.on('error', reject);
    });
  }

  generatePaymentOrder(paymentData) {
    const {
      orderNumber,
      clientName,
      clientInn,
      amount,
      purpose,
      bankAccount,
      bankName,
      bankBik,
      bankCorrAccount,
      createdAt
    } = paymentData;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    const fileName = `payment_order_${orderNumber}_${Date.now()}.pdf`;
    const filePath = path.join(this.invoicesDir, fileName);
    
    doc.pipe(fs.createWriteStream(filePath));

    // Заголовок документа
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('ПЛАТЕЖНОЕ ПОРУЧЕНИЕ', { align: 'center' });

    doc.moveDown(1);

    // Номер и дата
    doc.fontSize(12)
       .font('Helvetica')
       .text(`№ ${orderNumber}`, { align: 'right' })
       .text(`Дата: ${createdAt}`, { align: 'right' });

    doc.moveDown(2);

    // Тип платежа
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Тип платежа: Платежное поручение');

    doc.moveDown(1);

    // Сумма прописью
    const amountInWords = this.numberToWords(amount);
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Сумма: ${amount.toFixed(2)} руб. (${amountInWords})`);

    doc.moveDown(1);

    // Плательщик
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('ПЛАТЕЛЬЩИК:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text(clientName, 50, doc.y + 20)
       .text(`ИНН: ${clientInn}`, 50, doc.y + 5);

    doc.moveDown(1);

    // Получатель
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('ПОЛУЧАТЕЛЬ:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text('ООО "Дропшиппинг Платформа"', 50, doc.y + 20)
       .text('ИНН: 1234567890', 50, doc.y + 5)
       .text(`Счет: ${bankAccount}`, 50, doc.y + 5)
       .text(`Банк: ${bankName}`, 50, doc.y + 5)
       .text(`БИК: ${bankBik}`, 50, doc.y + 5)
       .text(`Корр. счет: ${bankCorrAccount}`, 50, doc.y + 5);

    doc.moveDown(1);

    // Назначение платежа
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('НАЗНАЧЕНИЕ ПЛАТЕЖА:', 50, doc.y);

    doc.fontSize(12)
       .font('Helvetica')
       .text(purpose, 50, doc.y + 20);

    doc.moveDown(2);

    // Подписи
    doc.fontSize(12)
       .font('Helvetica')
       .text('Подпись плательщика: _______________', 50, doc.y)
       .text('Дата: _______________', 300, doc.y);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve({
          fileName,
          filePath,
          relativePath: `invoices/${fileName}`
        });
      });
      
      doc.on('error', reject);
    });
  }

  numberToWords(num) {
    const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    if (num === 0) return 'ноль';

    let result = '';
    const integerPart = Math.floor(num);

    if (integerPart >= 1000) {
      const thousands = Math.floor(integerPart / 1000);
      result += this.convertHundreds(thousands, hundreds, tens, teens, ones) + ' тысяч ';
    }

    const remainder = integerPart % 1000;
    if (remainder > 0) {
      result += this.convertHundreds(remainder, hundreds, tens, teens, ones);
    }

    return result.trim() + ' рублей';
  }

  convertHundreds(num, hundreds, tens, teens, ones) {
    let result = '';

    if (num >= 100) {
      result += hundreds[Math.floor(num / 100)] + ' ';
      num %= 100;
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      result += teens[num - 10] + ' ';
      return result.trim();
    }

    if (num > 0) {
      result += ones[num] + ' ';
    }

    return result.trim();
  }

  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}

module.exports = new PDFGenerator();


