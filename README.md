# Đập Chuột

Game web "Đập Chuột" (whack-a-mole) viết bằng HTML/CSS/JavaScript thuần.

- `app/` — game (bản được đóng gói Docker)
- `assets/`, `design/` — ảnh và design tokens mà game dùng
- `docs/` — tài liệu đặc tả

## Cách chạy bằng Docker

Yêu cầu: Docker Desktop (hoặc Docker Engine) có sẵn `docker compose`.

Build và khởi động:

```bash
docker compose up -d --build
```

Mở trình duyệt tại **http://localhost:3000**

Xem log:

```bash
docker compose logs -f app
```

Dừng và xoá container:

```bash
docker compose down
```

Dịch vụ `app` là một server Node.js nhỏ (`server.js`, không dùng thư viện ngoài) phục vụ các file tĩnh
trong `app/` cùng `assets/` và `design/`. Cổng trong container là 3000, map ra cổng 3000 trên máy;
đổi cổng máy bằng cách sửa `ports` trong `docker-compose.yml`. Dự án chưa dùng database.
