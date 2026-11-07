# TarTrak launch tracker (bắt đầu 2026-11-08)

Mục tiêu: exposure + portfolio. Không cần viral.
Thành công nhỏ: hơn 100 người dùng trong tuần đầu sau khi đăng.
Đo bằng: lượt tải `setup.exe` trên GitHub Releases (app không có telemetry). Mốc 2026-11-08: tổng 159, gồm cả lượt auto-update của squad m, nên đo phần tăng thêm sau khi đăng. Thêm: GitHub stars, traffic repo.
Thứ tự: **0 Kiểm tra trước** → **1 Video** → **2 Website** → **3 Reddit**.

Người dùng nhắm tới (lời của m): người mới chơi, hoặc squad chơi chung mà không share màn hình cho nhau được (máy yếu không stream nổi, hoặc chỉ có một màn hình).

---

## 0. Kiểm tra trước khi đăng

- [x] Thử F8 share screenshot trong raid thật: chạy được (m xác nhận 2026-11-08).
- [x] Relay: ở lại Workers Free (m chốt 2026-11-08). Rủi ro: quá 100k request/ngày thì mọi squad offline tới 00:00 UTC.
- [x] License: đổi MIT sang GPL-3.0 (2026-11-08). Bản tới 0.20.4 vẫn là MIT. Donate: PayPal (đã có trên site + README).
- [ ] Chuẩn bị câu trả lời cho "sao cần quyền admin?" và cảnh báo SmartScreen (exe chưa ký). Dân Tarkov sẽ hỏi câu này đầu tiên.
- [ ] Biết TarTrak khác Tarkov Pilot ở đâu (xem mục Đối thủ). Thế nào cũng có người hỏi.
- [ ] Các finding còn mở trong audit 2026-11-03 (perMachine install, F5-F7 chặn phím ở app khác, xoá screenshot mặc định): sửa hay để sau.

## 1. Video (m làm sau)

Nền: `promo/PLAN-ui-refresh.md` (UI v0.16.1 + cảnh QUESTS + RAID CLOCK rút còn 2 s, reel 54 s). Chưa build.

Cần thêm vì app đã lên v0.20.2:
- [ ] Cảnh F8 share screenshot: popup hiện trên màn hình đồng đội.
- [ ] Font mới Geist / Geist Mono (0.18.1), timer đỏ (0.17.0).
- [ ] Câu chuyện xoay quanh use case: squad không share màn hình được.
- [ ] Chốt độ dài và tỉ lệ cho Reddit (Reddit tự phát video không tiếng, video ngắn dễ xem hết hơn).

Render nặng: chỉ chạy khi m không chơi game.

## 2. Website

Đã có: https://cthpaiden.github.io/TarTrak/ (`site/`, tự deploy khi `site/` đổi trên main).
- [x] Làm lại theo mockup A "Live map" (2026-11-08; bản cũ là D "the dial").
- [x] Thêm F8 share screenshot, raid replay, phím F8.
- [x] Thêm đoạn use case (ai nên dùng).
- [x] FAQ: SmartScreen, "F8 có share cả màn hình không", GPL-3.0.
- [ ] Thay video + poster mới (khi video xong).

## 3. Reddit

Rules chưa kiểm chứng: Claude không mở được Reddit (bị chặn). Đọc sidebar từng sub trước khi đăng.

Người chơi Tarkov (người dùng thật):
| Sub | Ghi chú |
|---|---|
| r/EscapefromTarkov | ~1.1M, sub chính, rule chặt nhất. Đăng sau cùng, khi mọi thứ đã ổn. |
| r/Tarkov | Nhỏ hơn, wiki có liệt kê tool (Tarkov Market...), có vẻ dễ tính với tool. |
| r/EFT_LFG | Đúng tệp "chơi với squad". Sub LFG thường chỉ cho bài tìm team: hỏi mod trước. |
| Sub PvE | Chỉ khi TarTrak chạy được ở PvE mode (chưa kiểm). Chưa xác nhận tên sub. |

Dev / portfolio:
| Sub | Ghi chú |
|---|---|
| r/SideProject | Sinh ra để khoe side project. |
| r/tauri | App Tauri 2, có flair showcase. |
| r/coolgithubprojects, r/opensource | Repo MIT trên GitHub. |
| r/rust | Đăng trong thread "What's everyone working on this week", bài riêng dễ bị gỡ. |
| r/webdev, r/sveltejs | r/webdev chỉ Showoff Saturday. |

- [ ] Kiểm tra account Reddit: tuổi account + karma (account mới hay bị auto-filter).
- [ ] Viết bài: use case trước, tính năng sau, có đoạn "ban-safe?" và "sao cần admin".
- [ ] Thứ tự đăng: sub dev trước (rủi ro thấp, lấy feedback) → r/Tarkov → r/EscapefromTarkov.
- [ ] Trực comment 2-3 giờ đầu sau khi đăng.

## Kênh khác (đề xuất 2026-11-08, chờ m chốt)

- YouTube: có. Upload bản ngang + bản dọc làm Shorts (promo đã có `Reel45Vertical`). Link từ site, README, bài Reddit.
- Discord: để sau. Mở khi có người hỏi hoặc có khoảng 50 người dùng thường xuyên.
- Feedback lúc đầu: comment Reddit + bật GitHub Discussions.

### YouTube: XONG 2026-11-08

Kênh https://www.youtube.com/@TarTrak (account datcsgogamer@gmail.com). Đã có description, 2 link (site, GitHub), avatar mặt la bàn tròn, banner 2560x1440. File ảnh: `promo/channel/`. Chưa có video.

### YouTube channel kit (m tự tạo channel, Claude không được tạo account)

- Tên: `TarTrak`
- Handle: `@TarTrak` (nếu đã có người lấy: `@TarTrakApp`)
- Description:
  > TarTrak is a free, open-source squad map for Escape from Tarkov. Take a screenshot in raid and see where you and your teammates are, and press F8 to show your squad what you see. Not affiliated with Battlestate Games.
  > Download: https://cthpaiden.github.io/TarTrak/
- Links: site (trên), GitHub https://github.com/cthpAiden/TarTrak
- Avatar: `public/logo.png` tạm được (128 px, YouTube nhận từ 98 px; đẹp nhất 800 px, render lại từ `site/favicon.svg`).
- Banner: `docs/assets/banner.png` là 1920x1080, dưới mức tối thiểu 2048x1152 của YouTube. Cần làm bản 2560x1440.

## Rủi ro BSG (ghi lại 2026-11-08)

- Tarkov Pilot (tarkov-market.com) đọc tên file screenshot + log y như TarTrak, chạy công khai nhiều năm, còn bán gói Pro. BSG không đụng.
- Lần BSG ra tay gần nhất: SPT (8/2026), mod chạy lại game offline, dính tên "Tarkov". TarTrak không đụng game, tên không có "Tarkov".
- Worst case hợp lý: BSG yêu cầu đổi tên hoặc bỏ asset. Code MIT vẫn là của m.
- Giữ: không dùng logo/art BSG trong video và site; giữ dòng "not affiliated".

## Đối thủ

- **Tarkov Pilot** (tarkov-market.com): app desktop, vị trí từ screenshot. Free chỉ có vị trí, hướng nhìn phải trả Pro. Squad sync là extension Chrome của người khác (43 user, 2025-12).
- TarTrak: squad có sẵn, overlay trên game, hướng nhìn free, F8 share screenshot, replay raid, open source.

## Câu hỏi còn mở

- Câu chuyện chính của video và bài post: đã có khoảnh khắc thật (bên dưới), đang hỏi phần "trước khi có TarTrak".

## Câu chuyện (lời m, 2026-11-08)

M hỏi bạn đang ở đâu. Bạn bấm V (chụp màn hình), hướng nhìn của bạn hiện trên map. Nhưng nhiều cây che, m cần biết chính xác bạn đang thấy gì. Bạn bấm F8, screenshot hiện lên màn hình m. M thấy địch ở đâu, rồi đẩy vào chỗ đó.

Trước TarTrak: chỉ có voice trên Discord, không đủ chính xác; không ai có màn hình thứ hai.
