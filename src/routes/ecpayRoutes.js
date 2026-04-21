const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const { AIO_URL, buildAioParams, generateMerchantTradeNo } = require('../utils/ecpay');

const router = express.Router();

router.get('/ecpay/pay/:orderId', authMiddleware, function (req, res) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);

  if (!order) {
    return res.status(404).json({ message: '訂單不存在' });
  }
  if (order.user_id !== req.user.userId) {
    return res.status(403).json({ message: '無權限' });
  }
  if (order.status === 'paid') {
    return res.status(400).json({ message: '訂單已付款' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  const merchantTradeNo = generateMerchantTradeNo(order.id);
  db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, order.id);

  const params = buildAioParams(order, items, merchantTradeNo);

  res.json({ aioUrl: AIO_URL, params });
});

router.post('/ecpay/notify', function (req, res) {
  res.send('1|OK');
});

router.post('/ecpay/return', function (req, res) {
  const { MerchantTradeNo, RtnCode } = req.body;

  if (!MerchantTradeNo) return res.redirect('/orders');

  const order = db.prepare('SELECT * FROM orders WHERE merchant_trade_no = ?').get(MerchantTradeNo);
  if (!order) return res.redirect('/orders');

  if (RtnCode === '1') {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', order.id);
    return res.redirect(`/orders/${order.id}?payment=success`);
  }

  if (RtnCode === '2') {
    // ATM 虛擬帳號已開立，保持 pending 等待轉帳（localhost 無法接收 ReturnURL 確認）
    return res.redirect(`/orders/${order.id}?payment=atm_created`);
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('failed', order.id);
  res.redirect(`/orders/${order.id}?payment=failed`);
});

module.exports = router;
