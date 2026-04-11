# Sử dụng python 3.10 slim để giảm dung lượng image
FROM python:3.10-slim

# Cài đặt uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy các file cấu hình dependency
COPY pyproject.toml .
COPY .python-version .

# Cài đặt dependencies (không cài đặt project dưới dạng editable)
RUN uv sync --frozen --no-install-project

# Copy mã nguồn vào container
COPY src/ ./src/

# Biến môi trường cho Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

# Expose port cho FastAPI (8000) và Streamlit (8501)
EXPOSE 8000
EXPOSE 8501

# Lệnh chạy mặc định (có thể override trong docker-compose)
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000"]