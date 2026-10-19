export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  defaultStock: number;
  category: string;
  imageKey: string;
}

export const DEMO_CATALOG: CatalogProduct[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Bàn phím cơ Mini 68',
    description: 'Bàn phím gọn với 68 phím, kết nối USB-C và switch êm cho góc học tập.',
    price: '790000.00',
    defaultStock: 18,
    category: 'Bàn phím',
    imageKey: 'mini-68-keyboard',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Chuột không dây Everyday',
    description: 'Chuột không dây nhẹ, thiết kế thuận tay và độ nhạy có thể điều chỉnh.',
    price: '290000.00',
    defaultStock: 32,
    category: 'Chuột',
    imageKey: 'everyday-mouse',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Tai nghe Studio Lite',
    description: 'Tai nghe chụp tai với đệm mềm và microphone cho lớp học trực tuyến.',
    price: '590000.00',
    defaultStock: 12,
    category: 'Âm thanh',
    imageKey: 'studio-lite-headphone',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Hub USB-C 5 trong 1',
    description: 'Mở rộng kết nối với HDMI, USB và cổng sạc USB-C trong một thiết bị nhỏ gọn.',
    price: '450000.00',
    defaultStock: 9,
    category: 'Phụ kiện',
    imageKey: 'usb-c-hub',
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Giá đỡ laptop nhôm',
    description: 'Giá đỡ có thể gấp gọn, nâng màn hình và tạo khoảng thoáng dưới laptop.',
    price: '350000.00',
    defaultStock: 24,
    category: 'Phụ kiện',
    imageKey: 'laptop-stand',
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    name: 'Đèn bàn Focus',
    description: 'Đèn LED để bàn với ba mức ánh sáng và cần đèn có thể điều chỉnh.',
    price: '390000.00',
    defaultStock: 0,
    category: 'Đèn bàn',
    imageKey: 'focus-desk-lamp',
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    name: 'Bàn phím Full-size Studio 104',
    description: 'Bàn phím cơ đầy đủ 104 phím kèm núm xoay âm lượng đa năng, khung nhôm graphite cứng cáp.',
    price: '1290000.00',
    defaultStock: 15,
    category: 'Bàn phím',
    imageKey: 'fullsize-keyboard',
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    name: 'Chuột công thái học Ergo Master',
    description: 'Thiết kế góc nghiêng tự nhiên giảm mỏi cổ tay, cảm biến quang học độ chính xác cao.',
    price: '850000.00',
    defaultStock: 20,
    category: 'Chuột',
    imageKey: 'ergo-mouse',
  },
  {
    id: '10000000-0000-4000-8000-000000000009',
    name: 'Loa để bàn SoundBar Desk',
    description: 'Loa thanh đặt bàn với màng loa kép cho âm thanh cân bằng và thiết kế tối giản sang trọng.',
    price: '690000.00',
    defaultStock: 14,
    category: 'Âm thanh',
    imageKey: 'desk-speaker',
  },
  {
    id: '10000000-0000-4000-8000-000000000010',
    name: 'Thảm bàn Desk Mat Da PU',
    description: 'Chất liệu da PU chống nước, bề mặt mịn màng êm ái bảo vệ mặt bàn và nâng tầm góc làm việc.',
    price: '250000.00',
    defaultStock: 35,
    category: 'Phụ kiện',
    imageKey: 'leather-desk-mat',
  },
];
