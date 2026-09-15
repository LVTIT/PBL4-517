import { Link } from 'react-router';
import { ArrowIcon } from '../components/Icon';

export function HomePage() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="home-heading">
        <div className="hero-copy">
          <p className="eyebrow"><span className="tiny-dot" /> DÀNH CHO GÓC LÀM VIỆC CỦA BẠN</p>
          <h1 id="home-heading">Đơn giản hơn.<br /><span>Cảm hứng hơn.</span></h1>
          <p className="hero-description">Từ chiếc bàn phím đến những kết nối nhỏ. Khám phá phụ kiện giúp bạn học tập, làm việc và sáng tạo theo cách của riêng mình.</p>
          <Link className="button button-primary" to="/products">Khám phá sản phẩm <ArrowIcon /></Link>
          <div className="hero-note"><span className="note-line" /> Chọn những gì thực sự cần cho mỗi ngày.</div>
        </div>
        <div className="desk-scene" role="img" aria-label="Minh họa một góc bàn gọn gàng với màn hình, bàn phím và cây xanh">
          <div className="scene-grid" />
          <span className="scene-label">YOUR EVERYDAY SPACE</span>
          <div className="scene-circle" />
          <div className="desk-monitor"><div className="monitor-screen"><span className="screen-orbit orbit-one" /><span className="screen-orbit orbit-two" /><span className="screen-orbit orbit-three" /><span className="screen-word">make space.</span></div><div className="monitor-stand" /></div>
          <div className="desk-keyboard"><div className="keyboard-keys" /><div className="keyboard-space" /></div>
          <div className="desk-mouse"><span /></div>
          <div className="desk-plant"><span className="leaf leaf-one" /><span className="leaf leaf-two" /><span className="leaf leaf-three" /><span className="plant-pot" /></div>
          <div className="scene-caption"><span>01 /</span> Một góc nhỏ. Nhiều ý tưởng.</div>
        </div>
      </section>

      <section className="intro-section" aria-labelledby="intro-heading">
        <div><p className="eyebrow">ÍT HƠN, NHƯNG VỪA ĐỦ</p><h2 id="intro-heading">Bắt đầu từ những điều nhỏ.</h2></div>
        <p>Một góc bàn gọn gàng, một công cụ vừa tay. Tìm phụ kiện phù hợp và dành thêm không gian cho những việc bạn yêu thích.</p>
      </section>
      <section className="home-features" aria-label="Khám phá 517 Store">
        <article className="feature"><span className="feature-number">01</span><h3>Cho nhịp làm việc</h3><p>Những phụ kiện thiết thực để tập trung vào việc quan trọng.</p></article>
        <article className="feature"><span className="feature-number">02</span><h3>Cho góc bàn của bạn</h3><p>Thêm một chút ngăn nắp, thêm một chút cảm hứng mỗi ngày.</p></article>
        <article className="feature feature-cta"><span className="feature-number">03</span><h3>Tìm món đồ phù hợp</h3><Link className="inline-link" to="/products">Xem tất cả sản phẩm <ArrowIcon /></Link></article>
      </section>
    </div>
  );
}
