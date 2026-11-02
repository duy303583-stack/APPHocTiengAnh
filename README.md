# 🦉 EngMate – App học tiếng Anh thông minh

Web app (HTML/CSS/JavaScript) + máy chủ Python + app Android (Java).

## Chạy nhanh (khuyên dùng)

**Cách dễ nhất:** nhấp đúp file **`chay-app.bat`**. File này tự cài thư viện, chạy máy chủ và mở trình duyệt.

Hoặc chạy bằng lệnh:

```powershell
cd "APP HOC TIENG ANH"
python -m pip install -r server\requirements.txt
$env:ANTHROPIC_API_KEY = "sk-ant-..."      # bật gia sư AI (lấy key tại console.anthropic.com)
python server\app.py
```

Mở **http://localhost:5000**:
- Trên máy tính: trang giới thiệu (`index.html`) với app chạy thật trong khung điện thoại.
- Trên điện thoại hoặc khi mở **http://localhost:5000/app.html**: ứng dụng toàn màn hình.

Không có API key thì mọi thứ vẫn chạy, chỉ các tính năng AI bị tắt. Người dùng cũng có thể tự nhập key của mình trong **Thành tích → Cài đặt**.

> Mở trực tiếp `index.html`/`app.html` bằng cách nhấp đúp (đường dẫn `file://`) sẽ **không chạy app**, vì trình duyệt chặn JavaScript module ở `file://`. Hãy chạy qua máy chủ Python như trên.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html` | Trang giới thiệu (showcase), app nằm trong khung điện thoại |
| `app.html`, `styles.css` | Giao diện ứng dụng |
| `demo02.html` | Bản giao diện đẹp hơn của Gia sư AI: nền chuyển màu, vòng mục tiêu hôm nay, 7 ngày học, chat có avatar, chế độ tối |
| `js/demo-switcher.js` | Nút 🔀 chuyển qua lại giữa các bản giao diện, giữ nguyên màn hình đang xem |
| `ai-tutor.html` | Giao diện gọn "Gia sư AI" (tông tím): chat nhập vai + trợ lý viết, dùng chung AI và XP với app |
| `js/app.js` | Toàn bộ màn hình và logic: lộ trình, bài học 5 bước, SRS, gamification… |
| `js/data.js` | Nội dung: bài kiểm tra đầu vào, 12 bài học A1–C2, huy hiệu, nhân vật AI |
| `js/ai.js` | Giọng nói (đọc/nghe), chấm phát âm, gọi Claude |
| `js/prompts.json` | Prompt AI dùng chung cho cả JavaScript và Python |
| `sw.js`, `manifest.json` | Học offline, cài như app (PWA) |
| `server/app.py` | Máy chủ Flask: phục vụ web, API AI, lưu tiến độ vào SQLite (`server/engmate.db`) |
| `android/` | App Android (Java, WebView). Mở thư mục này bằng Android Studio |

## Tính năng

- **Khởi đầu:** kiểm tra đầu vào 12 câu → xếp lớp A1–C2; chọn 1 trong 4 lứa tuổi (Trẻ em, Học sinh – Sinh viên, Người đi làm, Người lớn tuổi). Lứa tuổi quyết định bài được gợi ý, cỡ chữ, tốc độ đọc và giọng điệu của gia sư AI; màn Lộ trình có bộ lọc theo lứa tuổi.
- **Bài học 5 bước:** Khởi động → Giới thiệu (từ vựng + ngữ pháp, có phát âm) → Luyện tập (trắc nghiệm, nối từ, sắp xếp câu, nghe chép) → Vận dụng (nói và chấm phát âm, hoặc viết và AI chấm) → Ôn tập.
- **Ôn tập ngắt quãng (AI-SRS):** thuật toán SM-2; từ hay quên được ôn sớm hơn và được gia sư AI lồng vào hội thoại.
- **Gia sư AI:** 7 nhân vật/tình huống (bạn bản xứ Jake, HR khó tính, hướng dẫn viên…), 🎲 tình huống bất ngờ, 📞 chế độ gọi điện bằng giọng nói, sửa lỗi ngay trong từng câu, chỉnh tốc độ đọc 0.75x–1.0x, sóng âm hiện trực tiếp khi nói.
- **Học cùng AI:** ✍️ trợ lý viết (sửa lỗi + giải thích + nâng cấp từ vựng), 🌐 dịch theo ngữ cảnh, 📚 truyện theo sở thích kèm câu hỏi đọc hiểu, 🎯 luyện điểm yếu (AI tạo bài theo lỗi sai của bạn), 📝 dịch & phân tích cả bài văn (từ vựng đắt giá + cấu trúc ngữ pháp), 📖 từ điển tức thì (tra offline trong từ vựng của app, tra sâu bằng AI có IPA) kèm luyện phát âm có sóng âm.
- **Trò chơi hóa:** XP, chuỗi ngày, 14 huy hiệu, nhiệm vụ hằng ngày, bảng xếp hạng tuần (người chơi mô phỏng), ⚔️ Đấu trường AI mở khóa avatar gia sư.
- **Tiện ích:** học offline, nhắc nhở thông minh, biểu đồ 7 ngày, cộng đồng, kiểm tra cuối cấp và chứng chỉ in được, sao lưu/khôi phục, đồng bộ tiến độ với máy chủ.

## App Android

1. Chạy máy chủ Python như trên.
2. Mở thư mục `android/` bằng Android Studio (lần đầu, Android Studio sẽ tự tải Gradle).
3. Chạy trên máy ảo: app tự kết nối `http://10.0.2.2:5000/`. Với điện thoại thật, sửa `SERVER_URL` trong `android/app/build.gradle` thành IP LAN của máy tính.

Lưu ý: WebView của Android không hỗ trợ nhận dạng giọng nói của trình duyệt, nên phần luyện nói bằng micro chỉ dùng được trên Chrome/Edge (máy tính hoặc điện thoại).

## Giới hạn hiện tại

- Bảng xếp hạng dùng người chơi mô phỏng; bài đăng cộng đồng lưu trên thiết bị. Muốn chơi nhiều người thật cần thêm tài khoản đăng nhập trên máy chủ.
- Chấm phát âm ở mức từng từ (dựa trên nhận dạng giọng nói), chưa phân tích từng âm vị. Sóng âm chỉ hiển thị giọng của bạn: trình duyệt không thu được âm thanh giọng đọc mẫu nên chưa có biểu đồ so sánh hai giọng.
- Nhắc nhở chỉ hiện khi app đang mở hoặc đã cài lên màn hình chính.
