import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const MOCK_PRODUCTS = [
  {
    id: 'prod-mini-68',
    name: 'Bàn phím cơ Mini 68 KEVILO Pro',
    description: 'Bàn phím cơ không dây layout 68 phím, switch cơ học cao cấp, hỗ trợ hot-swap, kết nối Bluetooth 5.2 / 2.4GHz / Type-C.',
    price: '1450000.00',
    stock: 15,
    category: 'Bàn phím',
    imageKey: 'mini-68-keyboard',
    averageRating: 4.8,
    reviewCount: 12,
  },
  {
    id: 'prod-fullsize-108',
    name: 'Bàn phím cơ Full-size 108 phím Silent',
    description: 'Bàn phím cơ kích thước đầy đủ 108 phím tích hợp đệm tiêu âm silicone, switch Linear siêu êm ái cho không gian làm việc.',
    price: '2190000.00',
    stock: 8,
    category: 'Bàn phím',
    imageKey: 'fullsize-keyboard',
    averageRating: 4.9,
    reviewCount: 9,
  },
  {
    id: 'prod-mouse-everyday',
    name: 'Chuột không dây Everyday Precision',
    description: 'Chuột quang học kết nối không dây 2.4GHz và Bluetooth, độ phân giải 2400 DPI, thiết kế công thái học nhẹ nhàng cho cả ngày dài.',
    price: '450000.00',
    stock: 25,
    category: 'Chuột',
    imageKey: 'everyday-mouse',
    averageRating: 4.6,
    reviewCount: 18,
  },
  {
    id: 'prod-mouse-ergo',
    name: 'Chuột công thái học Ergo Master 57°',
    description: 'Chuột đứng công thái học góc 57 độ tự nhiên, giảm áp lực cổ tay, cảm biến quang học độ chính xác cao và pin sạc Type-C bền bỉ.',
    price: '1290000.00',
    stock: 10,
    category: 'Chuột',
    imageKey: 'ergo-mouse',
    averageRating: 4.7,
    reviewCount: 7,
  },
  {
    id: 'prod-audio-studio-lite',
    name: 'Tai nghe chụp tai Studio Lite Wireless',
    description: 'Tai nghe chụp tai chống ồn chủ động (ANC), màng loa dynamic 40mm, đệm tai mút hoạt tính êm ái, thời lượng pin lên đến 40 giờ.',
    price: '1890000.00',
    stock: 12,
    category: 'Âm thanh',
    imageKey: 'studio-lite-headphone',
    averageRating: 5.0,
    reviewCount: 5,
  },
  {
    id: 'prod-audio-desk-speaker',
    name: 'Loa để bàn KEVILO Acoustic Duo',
    description: 'Cặp loa kiểm âm để bàn chuẩn Hi-Res Audio, vỏ gỗ bọc nhôm graphite sang trọng, kết nối Bluetooth 5.3 và ngõ vào AUX/Optical.',
    price: '2450000.00',
    stock: 6,
    category: 'Âm thanh',
    imageKey: 'desk-speaker',
    averageRating: 4.9,
    reviewCount: 14,
  },
  {
    id: 'prod-acc-usbc-hub',
    name: 'Hub chuyển đổi USB-C 7-in-1 Aluminum',
    description: 'Bộ mở rộng đa cổng USB-C vỏ hợp kim nhôm nguyên khối: HDMI 4K@60Hz, 3 cổng USB-A 3.0, khe đọc thẻ SD/TF và sạc PD 100W.',
    price: '890000.00',
    stock: 20,
    category: 'Phụ kiện',
    imageKey: 'usb-c-hub',
    averageRating: 4.8,
    reviewCount: 22,
  },
  {
    id: 'prod-acc-laptop-stand',
    name: 'Giá đỡ laptop công thái học nhôm CNC',
    description: 'Giá đỡ nhôm cao cấp gấp gọn đa góc độ, tối ưu luồng tản nhiệt, chống trượt bằng đệm cao su silicone, tải trọng lên đến 10kg.',
    price: '650000.00',
    stock: 18,
    category: 'Phụ kiện',
    imageKey: 'laptop-stand',
    averageRating: 4.9,
    reviewCount: 16,
  },
  {
    id: 'prod-acc-desk-mat',
    name: 'Thảm da lót bàn làm việc KEVILO Mat (90x40cm)',
    description: 'Thảm da PU chống thấm nước hai mặt màu xám graphite/đen, bề mặt mịn màng tối ưu di chuột, dễ dàng vệ sinh chống bám bẩn.',
    price: '390000.00',
    stock: 30,
    category: 'Phụ kiện',
    imageKey: 'leather-desk-mat',
    averageRating: 4.7,
    reviewCount: 31,
  },
  {
    id: 'prod-acc-focus-lamp',
    name: 'Đèn bàn làm việc Focus Light Bar Pro',
    description: 'Đèn LED thanh gắn màn hình hoặc kẹp bàn, cảm ứng điều chỉnh nhiệt độ màu 3000K–6500K và độ sáng vô cấp, ánh sáng không lóa mắt (CRI > 95).',
    price: '1150000.00',
    stock: 14,
    category: 'Đèn bàn',
    imageKey: 'focus-desk-lamp',
    averageRating: null,
    reviewCount: 0,
  },
];

function handleFallback(req: any, res: any) {
  if (res.headersSent) return;
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1:5173');
  const pathname = parsedUrl.pathname;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (pathname === '/api/auth/me') {
    res.statusCode = 200;
    res.end(JSON.stringify({ data: null }));
    return;
  }

  if (pathname === '/api/auth/csrf') {
    res.statusCode = 200;
    res.end(JSON.stringify({ data: { csrfToken: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' } }));
    return;
  }

  if (pathname === '/api/products') {
    const search = parsedUrl.searchParams.get('search')?.toLowerCase() || '';
    const category = parsedUrl.searchParams.get('category');
    let results = MOCK_PRODUCTS;
    if (category) results = results.filter((p) => p.category === category);
    if (search) results = results.filter((p) => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search));
    res.statusCode = 200;
    res.end(JSON.stringify({ data: results }));
    return;
  }

  if (pathname.startsWith('/api/products/')) {
    const parts = pathname.replace('/api/products/', '').split('/');
    const id = parts[0];
    if (parts[1] === 'reviews') {
      res.statusCode = 200;
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    const product = MOCK_PRODUCTS.find((p) => p.id === id) || MOCK_PRODUCTS[0];
    res.statusCode = 200;
    res.end(JSON.stringify({ data: product }));
    return;
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        res.statusCode = 201;
        res.end(JSON.stringify({
          data: {
            id: 'ord-' + Date.now().toString().slice(-8),
            status: 'PENDING',
            totalPrice: '1450000.00',
            shippingAddress: parsed.shippingAddress || 'Địa chỉ nhận hàng',
            items: [],
          },
        }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.' } }));
      }
    });
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ data: [] }));
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:3000',
        configure: (proxy) => {
          proxy.on('error', (_err, req, res) => {
            handleFallback(req, res);
          });
        },
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:3000',
        configure: (proxy) => {
          proxy.on('error', (_err, req, res) => {
            handleFallback(req, res);
          });
        },
      },
    },
  },
});
