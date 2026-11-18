FROM node:22-alpine
WORKDIR /app

# Cài thư viện trước để Docker dùng lại lớp cache khi chỉ sửa mã nguồn
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
# Thư mục ảnh tải lên: tạo sẵn và giao cho user node để volume mới tạo cũng ghi được
RUN mkdir -p uploads && chown -R node:node uploads
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "index.js"]
