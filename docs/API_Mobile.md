# CloudMood API - Tài liệu dành cho Frontend Mobile

> **Phiên bản:** 1.0  
> **Cập nhật:** 2026-06-11

---

## Thông tin chung

| Thông tin | Chi tiết |
|-----------|----------|
| Base URL (local) | `http://localhost:3001` |
| Base URL (production) | *(cập nhật theo Railway deploy URL)* |
| Content-Type | `application/json` |
| Xác thực | Không cần token |

Tất cả API bên dưới đều **công khai**, gọi thẳng không cần đăng nhập.

---

## 1. Danh sách cảm xúc

**`GET /admin/emotions`**

Lấy toàn bộ danh sách các loại cảm xúc, sắp xếp theo ID tăng dần.

### Ví dụ request

```
GET http://localhost:3001/admin/emotions
```

### Response `200 OK`

```json
[
  {
    "id": "1",
    "nameEn": "Happy",
    "nameVi": "Vui vẻ",
    "descriptionEn": "Feeling joyful and cheerful",
    "descriptionVi": "Cảm giác vui vẻ, phấn khởi",
    "color": "#FFD700",
    "score": 5,
    "isPro": false,
    "createdAt": "2026-06-01T00:00:00.000Z"
  },
  {
    "id": "2",
    "nameEn": "Sad",
    "nameVi": "Buồn",
    "descriptionEn": "Feeling down or unhappy",
    "descriptionVi": "Cảm giác buồn bã, không vui",
    "color": "#4A90D9",
    "score": 2,
    "isPro": false,
    "createdAt": "2026-06-01T00:00:00.000Z"
  }
]
```

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | string | ID cảm xúc |
| `nameEn` | string | Tên tiếng Anh |
| `nameVi` | string | Tên tiếng Việt |
| `descriptionEn` | string \| null | Mô tả tiếng Anh |
| `descriptionVi` | string \| null | Mô tả tiếng Việt |
| `color` | string \| null | Màu hex (ví dụ: `#FFD700`) |
| `score` | number | Điểm cảm xúc |
| `isPro` | boolean | Tính năng Pro (chỉ cho người dùng trả phí) |

---

## 2. Nhóm Emoji

**`GET /admin/emoji-types`**

Lấy danh sách các nhóm emoji (ví dụ: Thời tiết, Hoạt động, ...).

### Ví dụ request

```
GET http://localhost:3001/admin/emoji-types
```

### Response `200 OK`

```json
[
  {
    "id": "1",
    "nameEn": "Weather",
    "nameVi": "Thời tiết",
    "descriptionEn": "Weather related emojis",
    "descriptionVi": "Emoji liên quan thời tiết",
    "isActive": true,
    "isPro": false,
    "createdAt": "2026-06-01T00:00:00.000Z"
  }
]
```

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | string | ID nhóm |
| `nameEn` | string | Tên tiếng Anh |
| `nameVi` | string | Tên tiếng Việt |
| `descriptionEn` | string \| null | Mô tả tiếng Anh |
| `descriptionVi` | string \| null | Mô tả tiếng Việt |
| `isActive` | boolean | Nhóm đang hoạt động |
| `isPro` | boolean | Tính năng Pro |

---

## 3. Danh sách Emoji

**`GET /admin/emojis`**

Lấy toàn bộ emoji kèm thông tin nhóm và cảm xúc liên kết.

### Ví dụ request

```
GET http://localhost:3001/admin/emojis
```

### Response `200 OK`

```json
[
  {
    "id": "101",
    "imageUrl": "https://cdn.example.com/emojis/sunny.png",
    "typeId": "1",
    "emotionId": "1",
    "createdAt": "2026-06-01T00:00:00.000Z",
    "type": {
      "id": "1",
      "nameEn": "Weather",
      "nameVi": "Thời tiết",
      "isActive": true,
      "isPro": false
    },
    "emotion": {
      "id": "1",
      "nameEn": "Happy",
      "nameVi": "Vui vẻ",
      "color": "#FFD700",
      "score": 5,
      "isPro": false
    }
  }
]
```

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | string | ID emoji |
| `imageUrl` | string | URL hình ảnh emoji |
| `typeId` | string | ID nhóm emoji |
| `emotionId` | string | ID cảm xúc liên kết |
| `type` | object | Thông tin nhóm (xem mục 2) |
| `emotion` | object | Thông tin cảm xúc (xem mục 1) |

---

## 4. Danh sách Giao diện (Themes)

**`GET /admin/themes`**

Lấy toàn bộ theme giao diện kèm hình ảnh, sắp xếp mới nhất trước.

### Ví dụ request

```
GET http://localhost:3001/admin/themes
```

### Response `200 OK`

```json
[
  {
    "id": "uuid-theme-1",
    "name": "Ocean Blue",
    "mode": "light",
    "isActive": true,
    "isPro": false,
    "colorsJson": {
      "primary": "#1A73E8",
      "background": "#F0F8FF",
      "text": "#212121"
    },
    "createdAt": "2026-06-01T00:00:00.000Z",
    "themeImages": [
      {
        "id": "uuid-img-1",
        "themeId": "uuid-theme-1",
        "type": "background",
        "imageUrl": "https://cdn.example.com/themes/ocean-bg.jpg",
        "createdAt": "2026-06-01T00:00:00.000Z"
      }
    ]
  }
]
```

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | string (UUID) | ID theme |
| `name` | string | Tên theme |
| `mode` | string \| null | `"light"` hoặc `"dark"` |
| `isActive` | boolean | Theme đang hoạt động |
| `isPro` | boolean | Tính năng Pro |
| `colorsJson` | object | Bộ màu của theme (JSON tự do) |
| `themeImages` | array | Danh sách ảnh của theme |
| `themeImages[].type` | string | Loại ảnh (ví dụ: `"background"`, `"icon"`) |
| `themeImages[].imageUrl` | string | URL hình ảnh |

---

## 5. Danh sách Sự kiện

**`GET /admin/events`**

Lấy danh sách các sự kiện trong app (lễ, ngày đặc biệt, ...), mới nhất trước.

### Ví dụ request

```
GET http://localhost:3001/admin/events
```

### Response `200 OK`

```json
[
  {
    "id": "uuid-event-1",
    "name": "Tết Nguyên Đán",
    "imageUrl": "https://cdn.example.com/events/tet.png",
    "color": "#FF0000",
    "backgroundColor": "#FFF3E0",
    "descriptionEn": "Vietnamese Lunar New Year",
    "descriptionVi": "Tết Nguyên Đán - năm mới âm lịch",
    "createdAt": "2026-06-01T00:00:00.000Z"
  }
]
```

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | string (UUID) | ID sự kiện |
| `name` | string | Tên sự kiện |
| `imageUrl` | string \| null | URL hình ảnh |
| `color` | string \| null | Màu chính (hex) |
| `backgroundColor` | string \| null | Màu nền (hex) |
| `descriptionEn` | string \| null | Mô tả tiếng Anh |
| `descriptionVi` | string \| null | Mô tả tiếng Việt |

---

## Xử lý lỗi

Tất cả lỗi đều trả về JSON:

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

| HTTP Code | Ý nghĩa |
|-----------|---------|
| `200` | Thành công |
| `500` | Lỗi server — báo lại backend |

---

## Lưu ý kỹ thuật

- **ID kiểu BigInt:** Các trường `id` của Emotion, EmojiType, Emoji trả về dưới dạng **string** (ví dụ: `"1"`, `"101"`). Không ép sang `int` thông thường vì có thể tràn số trên mobile.
- **`colorsJson`** của Theme là object JSON tự do — cấu trúc tùy từng theme, parse động.
- **`isPro: true`** — tính năng dành cho người dùng trả phí, frontend tự kiểm tra trước khi hiển thị.
- **`isActive: false`** — nhóm emoji hoặc theme đã bị tắt, nên ẩn khỏi giao diện người dùng.
