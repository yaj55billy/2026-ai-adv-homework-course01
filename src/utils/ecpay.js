const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const IS_STAGING = process.env.ECPAY_ENV !== 'production';

const AIO_URL = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
  : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

const QUERY_URL = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
  : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5';

function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restore = { '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!', '%2a': '*', '%28': '(', '%29': ')' };
  for (const [from, to] of Object.entries(restore)) {
    encoded = encoded.split(from).join(to);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${HASH_KEY}&${paramStr}&HashIV=${HASH_IV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

function verifyCheckMacValue(params) {
  const received = params.CheckMacValue || '';
  const calculated = generateCheckMacValue(params);
  if (received.length !== calculated.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(calculated));
}

function generateMerchantTradeNo(orderId) {
  const ts = String(Math.floor(Date.now() / 1000));
  const uid = orderId.replace(/-/g, '').substring(0, 10);
  return ts + uid;
}

function getTaiwanTimeString() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth() + 1)}/${pad(tw.getUTCDate())} ` +
    `${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`;
}

function buildItemName(items) {
  const name = items.map(i => i.product_name).join('#');
  return name.substring(0, 390);
}

function buildAioParams(order, items, merchantTradeNo) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: getTaiwanTimeString(),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花卉訂單付款',
    ItemName: buildItemName(items),
    ReturnURL: `${baseUrl}/ecpay/notify`,
    OrderResultURL: `${baseUrl}/ecpay/return`,
    ChoosePayment: 'ALL',
    EncryptType: '1',
  };
  params.CheckMacValue = generateCheckMacValue(params);
  return params;
}

async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const body = new URLSearchParams(params).toString();
  const response = await fetch(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text();
  const result = Object.fromEntries(new URLSearchParams(text));
  return result;
}

module.exports = { AIO_URL, generateCheckMacValue, verifyCheckMacValue, generateMerchantTradeNo, buildAioParams, queryTradeInfo };
