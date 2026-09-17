---
name: nine-agent-pipeline
description: >-
  Bắt buộc áp dụng Quy trình Phối hợp Đa Agent (9-Agent Pipeline System) chuẩn Enterprise
  cho mọi tác vụ lập trình, thiết kế kiến trúc, refactor, và kiểm định chất lượng phần mềm.
  Gồm 3 Giai đoạn, 9 Vai Agent chuyên trách, 2 Hard Gates, comment 'Anh chốt' và Version Gatekeeper.
---

# QUY TRÌNH PHỐI HỢP ĐA AGENT (9-AGENT PIPELINE SYSTEM) & NGUYÊN TẮC PHÁT TRIỂN

## I. SƠ ĐỒ PIPELINE 3 GIAI ĐOẠN

### Giai đoạn 1: Khám phá & Thiết kế Kiến trúc (Phase 1: Brainstorm)
- **[Agent 1] Architect (CTO-level Advisor)**
  - Khám phá yêu cầu nghiệp vụ gốc và mục tiêu tổng thể.
  - Lập bảng so sánh Trade-offs (Được / Mất, chi phí tài nguyên, khả năng mở rộng).
  - Thiết kế Schema quan hệ, phân quyền, luồng API.
  - **HARD GATE 1**: Tuyệt đối KHÔNG ĐƯỢC VIẾT BẤT KỲ DÒNG CODE NÀO trước khi phương án được duyệt.

### Giai đoạn 2: Lập Kế hoạch, Tra cứu & Phản biện (Phase 2: Plan & Review)
- **[Agent 2] Planner (Tech Lead)**: Phân rã Sprint, phân bổ File Ownership, định nghĩa API Contracts, Migration steps, Success Criteria.
- **[Agent 3] Researcher (Codebase Hunter)**: Rà soát mã nguồn sẵn có, thư viện 3rd party. CẤM tái phát minh bánh xe.
- **[Agent 4] Red-Team (Security, Logic & Edge-case Auditor - VETO POWER)**: Tìm lỗ hổng (SQL Injection, XSS, CSRF, IDOR, token leak), Race condition, Edge cases. Có quyền đình chỉ Plan ngay lập tức nếu có rủi ro chí mạng.
- **[Agent 5] UI/UX Critic (Anti-Slop & Design System Police)**: Anti-AI-Slop tuyệt đối. CẤM dùng Emoji nguyên bản trong HTML/CSS/Template; bắt buộc dùng SVG icons chuẩn. Touch target >= 44px, typography, bảng màu Enterprise.
- **HARD GATE 2**: Kế hoạch chi tiết và phản biện phải được duyệt 100% trước khi chuyển sang Giai đoạn 3.

### Giai đoạn 3: Triển khai, Kiểm định & Phát hành (Phase 3: Cook & Verify)
- **[Agent 6] Scout (Source Code Scout & Duplicate Preventer)**: Trinh sát đường dẫn file, kiểm tra nguy cơ trùng lặp tên file/hàm trước khi sửa/tạo.
- **[Agent 7] Coder (Fullstack Developer)**: Hiện thực hóa code theo đúng File Ownership, bọc try/catch chuẩn HTTP status, parameterized queries. Gắn comment 'Anh chốt' tại mọi quyết định quan trọng.
- **[Agent 8] Tester (Quality & Security Gatekeeper - Zero-Fail Policy)**: Syntax check, linting, compile check, schema validation, happy path & edge cases. Bắt buộc test pass 100%.
- **[Agent 9] Git-Manager (Release & Version Gatekeeper)**: Loại bỏ console.log rác, kiểm tra secret, cache busting, versioning format vYYYY.MM.DD.NN.

---

## II. NGUYÊN TẮC BẮT BUỘC: COMMENT 'ANH CHỐT' (DECISION STAMP)

Mục đích: Lưu giữ 'bộ não tư duy' và bối cảnh của quyết định kỹ thuật/nghiệp vụ.

Cú pháp bắt buộc:
- JavaScript / TypeScript: // YYYY-MM-DD (Anh chốt): [Lý do bối cảnh và quyết định chốt]
- SQL / Migration: -- YYYY-MM-DD (Anh chốt): [Lý do bối cảnh và quyết định chốt]
- CSS / SCSS: /* YYYY-MM-DD (Anh chốt): [Lý do bối cảnh và quyết định chốt] */
- Shell / YAML: # YYYY-MM-DD (Anh chốt): [Lý do bối cảnh và quyết định chốt]
- HTML: <!-- YYYY-MM-DD (Anh chốt): [Lý do bối cảnh và quyết định chốt] -->

---

## III. QUY TẮC PHIÊN BẢN & BUST CACHE (VERSION GATEKEEPER)

- Định dạng phiên bản: YYYY.MM.DD.NN (Ví dụ: 2026.09.17.01).
- Mọi tài nguyên script, css và API call đều phải đồng bộ query string ?v=vYYYY.MM.DD.NN và hiển thị badge trên giao diện người dùng.
