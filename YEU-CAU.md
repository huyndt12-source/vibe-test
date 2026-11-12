# Yêu cầu: Mini game Đập Chuột

Game chạy trên trình duyệt. Người chơi có 30 giây để bấm trúng càng nhiều chuột càng tốt trên một lưới 3×3.

---

## 1. Luật chơi

1. Bàn chơi là lưới **3×3 = 9 ô (hang)**.
2. Mỗi lượt chơi kéo dài **30 giây**, tính từ lúc bấm "Bắt đầu".
3. Trong suốt lượt chơi, **mỗi thời điểm chỉ có tối đa 1 con chuột** trồi lên ở một ô ngẫu nhiên.
4. Chuột ở trên mặt đất trong khoảng **0,6 – 1,2 giây** (ngẫu nhiên), sau đó tự thụt xuống.
5. Giữa hai lần chuột xuất hiện có khoảng nghỉ ngắn **0,2 – 0,5 giây**. Chuột mới **không xuất hiện lại đúng ô vừa xong** (tránh cảm giác "đứng yên").
6. Người chơi bấm (click chuột hoặc chạm trên điện thoại) vào ô đang có chuột để "đập".
7. Khi bị đập trúng, chuột lập tức biến mất và lượt xuất hiện tiếp theo bắt đầu.
8. Khi hết 30 giây: chuột đang hiện (nếu có) biến mất, mọi cú bấm sau đó **không được tính**, game chuyển sang màn hình kết thúc.

## 2. Cách tính điểm

| Hành động | Điểm |
|---|---|
| Bấm trúng ô đang có chuột | **+1** |
| Bấm vào ô trống | 0 (không trừ điểm) |
| Bấm lại vào chuột đã bị đập (bấm liên tiếp nhiều lần) | 0 — mỗi con chuột chỉ tính điểm **1 lần** |
| Bấm sau khi hết giờ | 0 |

- Điểm bắt đầu từ **0** mỗi lượt.
- Điểm hiện tại cập nhật **ngay lập tức** khi đập trúng.
- **Điểm cao nhất** (kỷ lục) được lưu trên trình duyệt (localStorage) và giữ lại sau khi tải lại trang. Nếu trình duyệt chặn lưu trữ, game vẫn chạy bình thường, chỉ không giữ kỷ lục.

## 3. Màn hình

### 3.1. Màn hình bắt đầu
- Tên game: **Đập Chuột**.
- Mô tả luật ngắn gọn 1–2 dòng (ví dụ: "Đập trúng chuột được 1 điểm. Bạn có 30 giây!").
- Hiển thị điểm cao nhất (nếu đã có).
- Nút **"Bắt đầu"**.

### 3.2. Màn hình chơi
- **Thanh trên cùng:**
  - Điểm hiện tại.
  - Thời gian còn lại, đếm ngược theo giây (30 → 0). Khi còn **≤ 5 giây**, đồng hồ đổi màu (ví dụ đỏ) để cảnh báo.
- **Lưới 3×3** ở giữa màn hình, các ô vuông bằng nhau.
- Chuột trồi lên/thụt xuống có hiệu ứng chuyển động ngắn (không cần cầu kỳ).
- Khi đập trúng: có phản hồi rõ ràng (ví dụ chuột đổi hình "bị choáng", ô nháy sáng, hoặc hiện "+1").
- Con trỏ chuột trên bàn chơi có thể đổi thành hình cái búa (không bắt buộc).

### 3.3. Màn hình kết thúc
- Dòng "Hết giờ!".
- **Điểm của lượt vừa chơi.**
- Điểm cao nhất; nếu vừa phá kỷ lục thì hiện thông báo "Kỷ lục mới!".
- Nút **"Chơi lại"** → bắt đầu ngay lượt mới (điểm về 0, đồng hồ về 30).

### 3.4. Yêu cầu chung về giao diện
- Hiển thị tốt trên **máy tính** và **điện thoại** (màn hình rộng từ 360px), lưới không bị tràn hay phải cuộn ngang.
- Ô đủ lớn để chạm bằng ngón tay (tối thiểu ~80×80px trên điện thoại).
- Chạy được bằng cách mở trực tiếp file HTML, **không cần cài đặt hay server**.
- Âm thanh (nếu có) là tuỳ chọn và phải có nút tắt/bật.

## 4. Tiêu chí hoàn thành

Game được coi là xong khi **tất cả** các mục sau đều đạt:

**Luật chơi**
- [ ] Lưới có đúng 9 ô, xếp 3 hàng × 3 cột.
- [ ] Không bao giờ có hơn 1 con chuột hiện cùng lúc.
- [ ] Chuột xuất hiện ở ô ngẫu nhiên, không lặp lại đúng ô liền trước.
- [ ] Chuột tự biến mất nếu không bị đập trong thời gian quy định.
- [ ] Lượt chơi kết thúc đúng sau 30 giây (sai lệch không quá 0,5 giây).

**Tính điểm**
- [ ] Đập trúng chuột: +1 điểm, hiển thị cập nhật ngay.
- [ ] Bấm ô trống: điểm không đổi.
- [ ] Bấm nhanh nhiều lần vào cùng một con chuột chỉ được 1 điểm.
- [ ] Bấm sau khi hết giờ không làm thay đổi điểm.
- [ ] Điểm cao nhất được lưu và vẫn còn sau khi tải lại trang.

**Màn hình**
- [ ] Có đủ 3 màn hình: bắt đầu, chơi, kết thúc.
- [ ] Đồng hồ đếm ngược hiển thị đúng và đổi màu khi còn ≤ 5 giây.
- [ ] Màn hình kết thúc hiện điểm lượt vừa chơi, điểm cao nhất và "Kỷ lục mới!" khi phù hợp.
- [ ] Nút "Chơi lại" reset điểm về 0 và đồng hồ về 30 giây.

**Kỹ thuật**
- [ ] Chạy được trên bản mới của Chrome, Safari, Firefox, Edge.
- [ ] Chơi được bằng chuột trên máy tính và bằng chạm trên điện thoại.
- [ ] Không có lỗi trong Console của trình duyệt khi chơi hết một lượt và chơi lại.
- [ ] Chơi lại nhiều lượt liên tiếp không bị chạy nhanh dần, không có 2 đồng hồ chạy song song.

## 5. Ngoài phạm vi (chưa làm ở phiên bản này)

- Nhiều cấp độ / tăng tốc độ theo thời gian.
- Nhiều loại chuột (chuột vàng nhiều điểm, bom trừ điểm…).
- Bảng xếp hạng online, đăng nhập.
- Chọn thời lượng lượt chơi khác 30 giây.
