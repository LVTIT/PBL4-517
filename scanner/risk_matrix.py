"""PBL4-517: Security Risk Matrix & CVSS Assessment (Issue #10).

Hệ thống đánh giá mức độ rủi ro an ninh theo chuẩn quốc tế (CVSS v3.1 & OWASP A05):
Phân loại rủi ro cho từng cổng mạng khi bị phơi bày ra Internet công khai (0.0.0.0/0).
"""

from __future__ import annotations

from typing import NamedTuple


class RiskProfile(NamedTuple):
    severity: str        # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
    cvss_score: float    # 0.0 -> 10.0
    color_hex: str       # Màu sắc hiển thị trên HTML/Embed
    color_badge: str     # Mã màu badge
    impact: str          # Tác động an ninh
    recommendation: str  # Khuyến nghị khắc phục trên AWS / Server


# Ma trận rủi ro chuẩn hóa theo cổng mạng
PORT_RISK_MAP: dict[int, RiskProfile] = {
    # 1. Cơ sở dữ liệu & Bộ nhớ Cache (Rủi ro tối đa)
    5432: RiskProfile(
        severity="CRITICAL",
        cvss_score=9.8,
        color_hex="#E74C3C",
        color_badge="badge-critical",
        impact="Cơ sở dữ liệu PostgreSQL đang mở trực tiếp ra Internet mà không qua tường lửa. Nguy cơ bị kẻ xấu brute-force, trích xuất toàn bộ dữ liệu khách hàng hoặc cài mã độc tống tiền (Ransomware).",
        recommendation="Đóng ngay Inbound Rule port 5432 trên AWS Security Group. Chỉ cho phép ứng dụng cục bộ (127.0.0.1) kết nối.",
    ),
    3306: RiskProfile(
        severity="CRITICAL",
        cvss_score=9.8,
        color_hex="#E74C3C",
        color_badge="badge-critical",
        impact="Cơ sở dữ liệu MySQL/MariaDB đang phơi bày ra ngoài Internet công cộng.",
        recommendation="Thu hồi rule mở cổng 3306 trên AWS Security Group ngay lập tức.",
    ),
    6379: RiskProfile(
        severity="CRITICAL",
        cvss_score=9.8,
        color_hex="#E74C3C",
        color_badge="badge-critical",
        impact="Redis In-Memory Cache mở ra ngoài không an toàn. Kẻ tấn công có thể ghi đè SSH key hoặc đọc dữ liệu session khách hàng.",
        recommendation="Chỉ bind Redis vào 127.0.0.1 và đóng cổng 6379 trên Firewall.",
    ),
    27017: RiskProfile(
        severity="CRITICAL",
        cvss_score=9.8,
        color_hex="#E74C3C",
        color_badge="badge-critical",
        impact="MongoDB NoSQL Database đang mở công khai.",
        recommendation="Khóa port 27017 khỏi Internet công cộng.",
    ),

    # 2. Dịch vụ Backend thô & Giao thức không mã hóa
    3000: RiskProfile(
        severity="HIGH",
        cvss_score=7.5,
        color_hex="#E67E22",
        color_badge="badge-high",
        impact="Node.js Express API đang mở trực tiếp không qua Nginx Reverse Proxy. Nguy cơ bị tấn công DoS, rò rỉ stack trace lỗi và thiếu chứng chỉ HTTPS.",
        recommendation="Chỉ cho Express lắng nghe tại 127.0.0.1:3000 và để Nginx port 80/443 làm cổng nhận lưu lượng duy nhất.",
    ),
    8000: RiskProfile(
        severity="HIGH",
        cvss_score=7.5,
        color_hex="#E67E22",
        color_badge="badge-high",
        impact="Máy chủ thử nghiệm (Dev Server) đang mở trực tiếp ra Internet.",
        recommendation="Tắt tiến trình dev server và xóa rule port 8000 trên AWS Security Group.",
    ),
    8080: RiskProfile(
        severity="HIGH",
        cvss_score=7.0,
        color_hex="#E67E22",
        color_badge="badge-high",
        impact="Cổng HTTP thay thế/Proxy phụ đang mở ra ngoài mà chưa được kiểm chứng bảo mật.",
        recommendation="Kiểm tra dịch vụ nào đang chiếm port 8080; nếu không cần thiết hãy tắt đi hoặc giới hạn IP truy cập.",
    ),
    21: RiskProfile(
        severity="HIGH",
        cvss_score=7.5,
        color_hex="#E67E22",
        color_badge="badge-high",
        impact="Giao thức FTP truyền thông tin đăng nhập dạng văn bản thô (Cleartext), rất dễ bị nghe lén (Sniffing).",
        recommendation="Chuyển sang dùng SFTP qua SSH và đóng port 21.",
    ),
    23: RiskProfile(
        severity="HIGH",
        cvss_score=8.5,
        color_hex="#E74C3C",
        color_badge="badge-critical",
        impact="Telnet là giao thức không mã hóa cổ xưa, cực kỳ nguy hiểm nếu mở ra ngoài.",
        recommendation="Gỡ bỏ hoàn toàn dịch vụ Telnet, thay bằng OpenSSH có mã hóa.",
    ),

    # 3. Quản trị từ xa (Cần giới hạn IP)
    22: RiskProfile(
        severity="MEDIUM",
        cvss_score=5.3,
        color_hex="#F39C12",
        color_badge="badge-medium",
        impact="Cổng SSH quản trị đang mở. Nếu mở cho 0.0.0.0/0, máy chủ sẽ liên tục bị botnet quét mật khẩu (Brute-force).",
        recommendation="Giới hạn Inbound Rule port 22 trên AWS Security Group chỉ cho phép dải IP tĩnh (/32) của quản trị viên; tắt đăng nhập bằng mật khẩu (chỉ dùng SSH Key).",
    ),
    3389: RiskProfile(
        severity="MEDIUM",
        cvss_score=5.5,
        color_hex="#F39C12",
        color_badge="badge-medium",
        impact="Remote Desktop (RDP) mở ra Internet dễ bị khai thác lỗ hổng BlueKeep hoặc đoán mật khẩu.",
        recommendation="Chỉ cho phép RDP qua VPN hoặc giới hạn IP cụ thể.",
    ),

    # 4. Dịch vụ Web Công cộng hợp lệ
    80: RiskProfile(
        severity="INFO",
        cvss_score=0.0,
        color_hex="#2ECC71",
        color_badge="badge-info",
        impact="Cổng HTTP tiêu chuẩn phục vụ người dùng xem trang web thương mại điện tử.",
        recommendation="Cổng hợp lệ. Khuyến nghị nâng cấp cấu hình chuyển hướng tự động sang HTTPS (port 443).",
    ),
    443: RiskProfile(
        severity="INFO",
        cvss_score=0.0,
        color_hex="#2ECC71",
        color_badge="badge-info",
        impact="Cổng HTTPS mã hóa TLS tiêu chuẩn, an toàn cho giao dịch trực tuyến.",
        recommendation="Cổng hợp lệ. Định kỳ kiểm tra hạn chứng chỉ SSL/TLS.",
    ),
}

DEFAULT_RISK = RiskProfile(
    severity="LOW",
    cvss_score=3.5,
    color_hex="#95A5A6",
    color_badge="badge-low",
    impact="Cổng dịch vụ không xác định đang mở. Cần rà soát xem có phải tiến trình lạ hay không.",
    recommendation="Kiểm tra tiến trình đang lắng nghe cổng bằng lệnh `netstat -tlpn` hoặc `ss -tlpn` trên máy chủ.",
)


def assess_port(port: int, banner: str | None = None) -> RiskProfile:
    """Trả về hồ sơ đánh giá rủi ro cho một cổng mạng."""
    profile = PORT_RISK_MAP.get(port, DEFAULT_RISK)

    # Nếu banner cho thấy có dấu hiệu nguy hiểm (ví dụ Redis không có mật khẩu)
    if banner and "Không yêu cầu mật khẩu" in banner:
        return RiskProfile(
            severity="CRITICAL",
            cvss_score=10.0,
            color_hex="#E74C3C",
            color_badge="badge-critical",
            impact=f"{profile.impact} (Xác nhận từ Banner: Dịch vụ không đặt mật khẩu bảo vệ!)",
            recommendation=profile.recommendation,
        )
    return profile


def calculate_system_posture(open_ports: list[int]) -> dict:
    """Tính toán điểm số an ninh tổng thể của toàn bộ hệ thống (Security Posture)."""
    if not open_ports:
        return {
            "grade": "A+",
            "status": "AN TOÀN TUYỆT ĐỐI",
            "highest_severity": "INFO",
            "max_cvss": 0.0,
            "color_hex": "#2ECC71",
            "summary": "Không có cổng nhạy cảm nào bị phơi bày ra ngoài.",
        }

    severities = [assess_port(p).severity for p in open_ports]
    max_cvss = max(assess_port(p).cvss_score for p in open_ports)

    if "CRITICAL" in severities:
        return {
            "grade": "F",
            "status": "MỨC NGUY HIỂM CAO (CRITICAL)",
            "highest_severity": "CRITICAL",
            "max_cvss": max_cvss,
            "color_hex": "#E74C3C",
            "summary": "Phát hiện cổng cơ sở dữ liệu phơi bày thẳng ra Internet! Cần xử lý khẩn cấp.",
        }
    if "HIGH" in severities:
        return {
            "grade": "D",
            "status": "RỦI RO ĐÁNG KỂ (HIGH)",
            "highest_severity": "HIGH",
            "max_cvss": max_cvss,
            "color_hex": "#E67E22",
            "summary": "Phát hiện cổng backend hoặc dịch vụ không an toàn đang mở trực tiếp.",
        }
    if "MEDIUM" in severities:
        return {
            "grade": "B",
            "status": "CẦN LƯU Ý (MEDIUM)",
            "highest_severity": "MEDIUM",
            "max_cvss": max_cvss,
            "color_hex": "#F39C12",
            "summary": "Có cổng quản trị mở ra ngoài, khuyến nghị giới hạn IP truy cập.",
        }
    return {
        "grade": "A",
        "status": "ĐẠT CHUẨN AN TOÀN",
        "highest_severity": "INFO",
        "max_cvss": max_cvss,
        "color_hex": "#2ECC71",
        "summary": "Chỉ mở các cổng Web công cộng hợp lệ (80/443).",
    }
