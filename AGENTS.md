# Hướng Dẫn Agent Cho Dự Án WorkFlow

File này mô tả quy ước bắt buộc cho mọi session AI/Codex khi làm việc trong repo này.

## Context Bắt Buộc Khi Bắt Đầu Session

Luôn đọc 3 file sau trước khi phân tích, sửa code, review, hoặc cập nhật tài liệu:

1. `docs/PRODUCT_OVERVIEW.md` - bối cảnh nghiệp vụ, role, module, luồng vận hành.
2. `docs/DATABASE_SCHEMA.md` - schema, RLS, RPC, storage, cronjobs, migration order.
3. `docs/ARCHITECTURE.md` - chuẩn kiến trúc, folder structure, coding pattern, UI tokens, realtime, permission helpers.

Ba file này là tài liệu nền của dự án. Nếu cần hiểu "tại sao", đọc `PRODUCT_OVERVIEW.md`; nếu chạm DB/RLS/RPC, đọc `DATABASE_SCHEMA.md`; nếu viết code hoặc UI, đọc `ARCHITECTURE.md`.

## Cập Nhật Tài Liệu Sau Khi Sửa Đổi

Sau mọi thay đổi làm ảnh hưởng tới nghiệp vụ, schema, RLS/RPC, module, route, permission, realtime, cronjob, storage, UI pattern, hoặc quy chuẩn code, phải cập nhật lại các file docs liên quan trong cùng lượt thay đổi.

Nguyên tắc:

- Mô tả trong docs phải khớp với mã nguồn hiện tại.
- Nếu phát hiện docs lệch code, kiểm tra mã nguồn/snapshot/migration trước, rồi cập nhật docs theo thực tế.
- Nếu thay schema/migration, cập nhật `docs/DATABASE_SCHEMA.md`, `schema.sql` hoặc `src/types/database.types.ts` khi phù hợp.
- Nếu thêm/sửa luồng nghiệp vụ hoặc quyền role, cập nhật `docs/PRODUCT_OVERVIEW.md`.
- Nếu thêm/sửa pattern kỹ thuật, cấu trúc module, helper dùng chung, UI convention, cập nhật `docs/ARCHITECTURE.md`.

## Chuẩn Bắt Buộc Khi Làm Việc

- Mọi phân tích, thiết kế, sửa code, sửa UI, sửa schema, refactor, review, và quyết định kỹ thuật/nghiệp vụ đều phải tuân thủ `docs/PRODUCT_OVERVIEW.md`, `docs/DATABASE_SCHEMA.md`, và `docs/ARCHITECTURE.md`.
- Không dùng pattern trong mã nguồn làm lý do để đi ngược 3 file docs. Nếu code hiện tại lệch docs, coi đó là lệch chuẩn cần được phát hiện và xử lý theo phạm vi task.
- Chỉ dùng pattern từ module hiện có khi pattern đó khớp với 3 file docs; nếu có mâu thuẫn, 3 file docs là nguồn chuẩn cao hơn.
- Không tự ý bỏ qua tài liệu vì "thay đổi nhỏ"; mọi thay đổi đều phải kiểm tra tác động tới 3 file docs.
- Khi hoàn tất task, nêu rõ đã cập nhật docs nào, hoặc xác nhận đã kiểm tra và không có nội dung docs nào cần cập nhật.
