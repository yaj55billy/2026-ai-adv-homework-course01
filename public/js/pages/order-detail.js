const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      atm_created: { text: 'ATM 虛擬帳號已開立，請在期限內完成轉帳。完成轉帳後訂單狀態將自動更新。', cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
    };

    async function handleEcpayPay() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await fetch('/ecpay/pay/' + order.value.id, {
          headers: Auth.getAuthHeaders()
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          Notification.show(err.message || '付款初始化失敗', 'error');
          paying.value = false;
          return;
        }
        const { aioUrl, params } = await res.json();
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = aioUrl;
        for (const [k, v] of Object.entries(params)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = k;
          input.value = v;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        Notification.show('付款處理失敗', 'error');
        paying.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return { order, loading, paying, paymentResult, statusMap, paymentMessages, handleEcpayPay };
  }
}).mount('#app');
