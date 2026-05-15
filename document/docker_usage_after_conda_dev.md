# Hướng dẫn chạy Docker sau khi dev bằng Conda

## Khi nào dùng tài liệu này?

Chỉ áp dụng khi bạn đã hoàn thành:

1. Dev bằng Conda (code chạy ổn)
2. Fix hết lỗi runtime
3. Freeze `requirements.txt`

Nếu chưa đạt 3 bước trên → KHÔNG nên dùng Docker.

---

# 1. Freeze requirements.txt

Trong môi trường conda `ai_gpu`:

```bash
conda activate ai_gpu
pip freeze > requirements.txt
```

## Vì sao phải làm bước này?

- Đảm bảo Docker cài đúng version package bạn đang dùng
- Tránh lỗi: "chạy local OK, Docker lỗi"

---

# 2. Kiểm tra Dockerfile

Đảm bảo file `Dockerfile` như sau:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "src.agent"]
```

## Giải thích nhanh

- Dùng Python 3.10 → giống môi trường conda
- COPY requirements trước → tận dụng cache Docker
- CMD → chạy agent khi container start

---

# 3. Build Docker image

Chạy trong thư mục project:

```bash
docker build -t a20-agent-014 .
```

## Ý nghĩa

- `-t a20-agent-014`: đặt tên image
- `.`: build từ thư mục hiện tại

## Kiểm tra

```bash
docker images
```

---

# 4. Chạy container

```bash
docker run --env-file .env -it a20-agent-014
```

## Giải thích

- `--env-file .env`: truyền API key
- `-it`: chạy interactive

---

# 5. Dev nhanh với volume (khuyên dùng)

Nếu bạn vẫn đang chỉnh code:

```bash
docker run --env-file .env -it -v ${PWD}:/app a20-agent-014
```

## Lợi ích

- Không cần build lại mỗi lần sửa code
- Code local sync trực tiếp vào container

---

# 6. Khi nào cần build lại?

Bạn PHẢI build lại nếu:

- Thay đổi `requirements.txt`
- Thêm package mới
- Sửa Dockerfile

Không cần build lại nếu:

- Chỉ sửa code Python (và đang dùng volume)

---

# 7. Debug khi Docker lỗi

## Lỗi import module

Nguyên nhân:
- requirements.txt thiếu package

Cách sửa:

```bash
pip freeze > requirements.txt
docker build -t a20-agent-014 .
```

---

## Lỗi thiếu API key

Nguyên nhân:
- chưa truyền `.env`

Cách sửa:

```bash
docker run --env-file .env -it a20-agent-014
```

---

## Lỗi container chạy rồi thoát

Chạy lại với:

```bash
docker run -it a20-agent-014 bash
```

Sau đó chạy thủ công:

```bash
python -m src.agent
```

---

# 8. Flow chuẩn sau này

```text
1. Dev bằng Conda
2. Test OK
3. pip freeze
4. docker build
5. docker run
6. (optional) push image / deploy
```

---

# 9. Tư duy quan trọng

- Conda = để phát triển nhanh
- Docker = để đóng gói & deploy

Không nên đảo ngược thứ tự.

---

# 10. Checklist trước khi demo / nộp bài

- [ ] Chạy local OK
- [ ] requirements.txt đã freeze
- [ ] Docker build không lỗi
- [ ] Docker run chạy được agent
- [ ] .env không bị thiếu key

Nếu tất cả đều OK → dự án sẵn sàng.


---

# 11. Docker Compose (khuyến nghị cho dự án thực tế)

Khi dự án bắt đầu có thêm dịch vụ như DB, vector DB (Qdrant), Redis… bạn nên dùng `docker-compose` để chạy tất cả cùng lúc.

## 11.1 Tạo file docker-compose.yml

```yaml
version: "3.9"

services:
  app:
    build: .
    container_name: a20-agent-014
    command: python -m src.agent
    env_file:
      - .env
    volumes:
      - .:/app
    depends_on:
      - qdrant
      - redis

  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  qdrant_data:
  redis_data:
```

---

## 11.2 Giải thích kiến trúc

- **app**: container chính chạy agent
- **qdrant**: vector database cho RAG
- **redis**: cache / memory (optional nhưng rất hữu ích)

### Vì sao nên tách service?

- Dễ scale (sau này deploy cloud)
- Dễ debug từng phần
- Không phải cài DB trực tiếp trên máy

---

## 11.3 Chạy toàn bộ hệ thống

```bash
docker compose up --build
```

## Lần sau chỉ cần:

```bash
docker compose up
```

---

## 11.4 Chạy background

```bash
docker compose up -d
```

Xem container đang chạy:

```bash
docker ps
```

---

## 11.5 Dừng hệ thống

```bash
docker compose down
```

---

## 11.6 Debug

Xem log app:

```bash
docker compose logs -f app
```

Vào container:

```bash
docker exec -it a20-agent-014 bash
```

---

## 11.7 Kết nối từ code

Trong code Python:

- Qdrant URL: `http://qdrant:6333`
- Redis host: `redis`

❗ Không dùng `localhost` trong Docker

---

## 11.8 Khi nào dùng compose?

Dùng khi:

- Có vector DB (RAG)
- Có cache / memory
- Có nhiều service

Không cần nếu:

- Chỉ chạy 1 file Python đơn giản

---

## 11.9 Flow chuẩn nâng cao

```text
1. Dev local bằng Conda
2. Fix logic
3. Freeze requirements
4. Dockerfile
5. docker-compose
6. Run full system
7. Deploy
```

---

## 11.10 Mẹo quan trọng

- Luôn dùng `volumes` khi dev → không cần rebuild
- Chỉ `--build` khi đổi dependencies
- Log là thứ giúp bạn debug nhanh nhất

---

👉 Khi project của bạn thêm RAG hoặc multi-agent, docker-compose gần như là bắt buộc.
