export const BRAND_NAME = 'KEVILO';
export const BRAND_TAGLINE = 'Nâng chuẩn góc làm việc.';
export const BRAND_DESCRIPTION = 'Phụ kiện công nghệ cho góc làm việc của bạn.';
export const BRAND_SUBTITLE =
  'Khám phá phụ kiện giúp bạn làm việc tập trung, kết nối thuận tiện và hoàn thiện không gian mỗi ngày.';
export const BRAND_HERO_CTA = 'Khám phá sản phẩm';
export const BRAND_FOOTER_NOTE =
  'KEVILO là website demo thuộc đề tài PBL4-517. Không xử lý thanh toán hoặc giao hàng thực tế.';
export const BRAND_COMMUNITY = 'PBL4 · Nhóm 517';
export const BRAND_DEFAULT_TITLE = 'KEVILO — Phụ kiện công nghệ cho góc làm việc';

export function getPageTitle(pageTitle?: string): string {
  if (!pageTitle) return BRAND_DEFAULT_TITLE;
  return `${pageTitle} | ${BRAND_NAME}`;
}
