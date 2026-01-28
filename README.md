## 🎫 Ticket Management System

Modern, güvenli ve özellik dolu bir ticket (destek talebi) yönetim sistemi. Full-stack TypeScript/React/Express.js uygulaması.

### 🌐 Diller / Languages

- **Türkçe**: Aşağıdaki **Türkçe Dokümantasyon** bölümüne bakın.  
- **English**: See the **English Documentation** section below.

---

## 🇹🇷 Türkçe Dokümantasyon

### 📋 İçindekiler

- [Özellikler](#türkiye-özellikler)
- [Teknoloji Stack](#türkiye-teknoloji-stack)
- [Kurulum](#türkiye-kurulum)
- [Yapılandırma](#türkiye-yapılandırma)
- [Kullanım](#türkiye-kullanım)
- [Güvenlik](#türkiye-güvenlik)
- [API Dokümantasyonu](#türkiye-api-dokümantasyonu)
- [Katkıda Bulunma](#türkiye-katkıda-bulunma)
- [Lisans](#türkiye-lisans)

### 🇹🇷 Özellikler {#türkiye-özellikler}

#### 🎯 Temel Özellikler

- **Ticket Yönetimi**: Oluşturma, düzenleme, atama, durum takibi
- **Kullanıcı Yönetimi**: Rol tabanlı yetkilendirme, kullanıcı profilleri
- **Grup Yönetimi**: Kullanıcı grupları ve işbirliği
- **Bildirimler**: Gerçek zamanlı bildirimler ve tercih yönetimi
- **Dashboard**: İstatistikler ve özet bilgiler
- **Raporlama**: Detaylı raporlar ve analitik

#### 🔐 Güvenlik Özellikleri

- **CSRF Koruması**: Token tabanlı CSRF koruması
- **XSS Koruması**: DOMPurify ile input sanitization
- **SQL Injection Koruması**: Prisma ORM ile parametreli sorgular
- **Path Traversal Koruması**: Dosya yolu validasyonu
- **Command Injection Koruması**: Komut çalıştırma koruması
- **JWT Authentication**: Güvenli token tabanlı kimlik doğrulama
- **2FA (İki Faktörlü Doğrulama)**: TOTP ve email tabanlı 2FA
- **Account Lockout**: Brute-force saldırı koruması
- **Password Policy**: Güçlü şifre politikaları
- **Session Management**: Güvenli oturum yönetimi
- **Content Security Policy (CSP)**: XSS ve injection koruması
- **Token Refresh**: Otomatik token yenileme
- **Inactivity Timeout**: Hareketsizlik sonrası otomatik çıkış

#### 📊 İzleme ve Uyumluluk

- **Audit Logging**: Tüm sistem değişikliklerinin kaydı
- **GDPR Uyumluluğu**: Veri dışa aktarma ve silme
- **Health Monitoring**: Sistem sağlık kontrolü ve metrikler
- **Performance Monitoring**: API yanıt süreleri ve performans metrikleri
- **Compliance Reports**: Uyumluluk raporları

#### 🛠️ Yönetim Özellikleri

- **Rol ve Yetki Yönetimi**: Granüler yetkilendirme sistemi
- **Permission Templates**: Yetki şablonları
- **SLA Yönetimi**: Hizmet seviyesi anlaşmaları
- **Email Templates**: Özelleştirilebilir email şablonları
- **Navigation Management**: Dinamik menü yönetimi
- **System Settings**: Merkezi sistem ayarları
- **File Upload Security**: Güvenli dosya yükleme ve karantina
- **API Keys**: API anahtarı yönetimi

#### 📦 İçe/Dışa Aktarma

- **Import/Export**: CSV, Excel, JSON formatlarında veri aktarımı
- **Bulk Operations**: Toplu işlemler
- **Ticket Categories**: Kategori yönetimi
- **Ticket Tags**: Etiket sistemi

### 🇹🇷 Teknoloji Stack {#türkiye-teknoloji-stack}

#### Backend

- **Node.js** + **Express.js**: RESTful API
- **TypeScript**: Tip güvenliği
- **Prisma ORM**: Veritabanı yönetimi
- **PostgreSQL**: Veritabanı
- **JWT**: Kimlik doğrulama
- **Zod**: Schema validasyonu
- **Winston**: Logging
- **Helmet**: Güvenlik middleware
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API koruması

#### Frontend

- **React 19**: UI kütüphanesi
- **TypeScript**: Tip güvenliği
- **Vite**: Build tool
- **React Router**: Routing
- **TanStack Query**: Data fetching
- **Tailwind CSS**: Styling
- **DOMPurify**: XSS koruması
- **Lucide Icons**: İkonlar

### 🇹🇷 Kurulum {#türkiye-kurulum}

#### Gereksinimler

- Node.js 18+ 
- PostgreSQL 12+
- npm veya yarn

#### Adımlar

1. **Repository'yi klonlayın:**

```bash
git clone https://github.com/xennless/ticket-management-system.git
cd ticket-management-system
```

2. **Backend kurulumu:**

```bash
cd backend
npm install
```

3. **Frontend kurulumu:**

```bash
cd ../frontend
npm install
```

4. **Veritabanı kurulumu:**

```bash
cd ../backend
# .env dosyasını oluşturun (env.example'dan kopyalayın)
cp env.example .env
# .env dosyasını düzenleyin ve DATABASE_URL'i ayarlayın

# Prisma client'ı oluşturun
npm run prisma:generate

# Veritabanı migration'larını çalıştırın
npm run prisma:migrate

# Seed verilerini yükleyin
npm run prisma:seed
```

5. **Environment değişkenlerini ayarlayın:**

**Backend (.env):**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/ticketdb"
DIRECT_URL="postgresql://user:password@localhost:5432/ticketdb"
JWT_SECRET=your-super-secret-jwt-key-min-16-chars
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SYSTEMDEVELOPER_EMAIL=admin@example.com
SYSTEMDEVELOPER_PASSWORD=ChangeMe_12345
SYSTEMDEVELOPER_NAME=System Admin
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
```

### 🇹🇷 Yapılandırma {#türkiye-yapılandırma}

#### Sistem Geliştirici Hesabı

İlk kurulumda, `SYSTEMDEVELOPER_EMAIL` ve `SYSTEMDEVELOPER_PASSWORD` ile belirtilen hesap otomatik olarak oluşturulur ve tüm yetkilere sahip olur.

**Önemli:** İlk girişten sonra şifrenizi değiştirin!

#### Güvenlik Ayarları

- **JWT_SECRET**: En az 16 karakter olmalı (production'da güçlü bir değer kullanın)
- **CORS_ORIGINS**: Production'da sadece izin verilen domain'leri listeleyin
- **Password Policy**: Sistem ayarlarından şifre politikasını yapılandırabilirsiniz

#### Veritabanı

PostgreSQL veritabanı kullanılır. Supabase, AWS RDS veya kendi PostgreSQL sunucunuzu kullanabilirsiniz.

### 🇹🇷 Kullanım {#türkiye-kullanım}

#### Development

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Uygulama şu adreslerde çalışacaktır:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

#### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# dist/ klasörünü bir web sunucusuna deploy edin
```

### 🇹🇷 Güvenlik {#türkiye-güvenlik}

#### Önerilen Production Ayarları

1. **Environment Variables**: Tüm hassas bilgileri environment değişkenlerinde saklayın
2. **HTTPS**: Production'da mutlaka HTTPS kullanın
3. **CORS**: Sadece gerekli domain'lere izin verin
4. **Rate Limiting**: API rate limit'lerini yapılandırın
5. **Logging**: Production loglarını güvenli bir yerde saklayın
6. **Backup**: Düzenli veritabanı yedekleri alın

#### Güvenlik Özellikleri Detayları

- **CSRF Protection**: Tüm state-changing isteklerde CSRF token kontrolü
- **Input Validation**: Zod ile runtime validasyon
- **XSS Protection**: DOMPurify ile HTML sanitization
- **SQL Injection**: Prisma ORM ile otomatik koruma
- **Session Security**: JWT token tabanlı, refresh mekanizması ile
- **2FA**: TOTP ve email tabanlı iki faktörlü doğrulama
- **Account Lockout**: Başarısız giriş denemelerinde hesap kilitleme

### 🇹🇷 API Dokümantasyonu {#türkiye-api-dokümantasyonu}

#### Authentication

- `POST /api/auth/login` - Kullanıcı girişi
- `POST /api/auth/refresh` - Token yenileme
- `GET /api/auth/me` - Kullanıcı bilgileri
- `POST /api/auth/logout` - Çıkış

#### Tickets

- `GET /api/tickets` - Ticket listesi
- `POST /api/tickets` - Yeni ticket oluştur
- `GET /api/tickets/:id` - Ticket detayı
- `PUT /api/tickets/:id` - Ticket güncelle
- `DELETE /api/tickets/:id` - Ticket sil

#### Users

- `GET /api/admin/users` - Kullanıcı listesi
- `POST /api/admin/users` - Yeni kullanıcı oluştur
- `PUT /api/admin/users/:id` - Kullanıcı güncelle
- `DELETE /api/admin/users/:id` - Kullanıcı sil

Daha fazla endpoint için API route dosyalarına bakın.

### 🇹🇷 Katkıda Bulunma {#türkiye-katkıda-bulunma}

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add some amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

### 🇹🇷 Lisans {#türkiye-lisans}

Bu proje **MIT Lisansı** altında dağıtılmaktadır. Detaylar için `LICENSE` dosyasına bakın.

### 📞 İletişim

Sorularınız veya önerileriniz için issue açabilirsiniz.

### 🙏 Teşekkürler

Bu projeyi kullandığınız için teşekkürler!

---

**Not:** Bu sistem production'a geçmeden önce tüm güvenlik ayarlarını gözden geçirin ve test edin.

---

## 🇬🇧 English Documentation

### 📋 Table of Contents

- [Features](#english-features)
- [Technology Stack](#english-technology-stack)
- [Setup](#english-setup)
- [Configuration](#english-configuration)
- [Usage](#english-usage)
- [Security](#english-security)
- [API Documentation](#english-api-documentation)
- [Contributing](#english-contributing)
- [License](#english-license)

### 🇬🇧 Features {#english-features}

#### 🎯 Core Features

- **Ticket Management**: Create, edit, assign and track ticket status
- **User Management**: Role-based authorization and user profiles
- **Group Management**: User groups and collaboration
- **Notifications**: Real-time notifications and preferences
- **Dashboard**: KPIs and overview widgets
- **Reporting**: Detailed reports and analytics

#### 🔐 Security Features

- **CSRF Protection**: Token-based CSRF protection
- **XSS Protection**: Input sanitization with DOMPurify
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **Path Traversal Protection**: Safe path validation
- **Command Injection Protection**: Controlled command execution
- **JWT Authentication**: Secure token-based auth
- **2FA**: TOTP & email-based two-factor authentication
- **Account Lockout**: Brute-force attack protection
- **Password Policy**: Strong password rules
- **Session Management**: Secure session handling
- **Content Security Policy (CSP)**: XSS & injection hardening
- **Token Refresh**: Automatic access token refresh
- **Inactivity Timeout**: Auto logout after inactivity

#### 📊 Monitoring & Compliance

- **Audit Logging**: Full change history
- **GDPR Compliance**: Data export and deletion helpers
- **Health Monitoring**: System health checks & metrics
- **Performance Monitoring**: API response time metrics
- **Compliance Reports**: Audit & compliance reports

#### 🛠️ Admin & Management

- **Role & Permission Management**: Granular RBAC
- **Permission Templates**: Reusable permission sets
- **SLA Management**: Service level agreements
- **Email Templates**: Customizable email templates
- **Navigation Management**: Dynamic admin navigation
- **System Settings**: Centralised configuration
- **File Upload Security**: Safe uploads & quarantine
- **API Keys**: API key management

#### 📦 Import / Export

- **Import / Export**: CSV, Excel, JSON
- **Bulk Operations**: Bulk actions
- **Ticket Categories & Tags**: Classification system

### 🇬🇧 Technology Stack {#english-technology-stack}

#### Backend

- **Node.js** + **Express.js**: RESTful API
+- **TypeScript**: Type safety
- **Prisma ORM**: Database access
- **PostgreSQL**: Relational database
- **JWT**: Authentication
- **Zod**: Runtime schema validation
- **Winston**: Logging
- **Helmet**: Security middleware
- **CORS**: Cross-origin configuration
- **Rate Limiting**: API protection

#### Frontend

- **React 19**: UI library
- **TypeScript**: Type-safe frontend
- **Vite**: Dev server & build tool
- **React Router**: Routing
- **TanStack Query**: Data fetching & caching
- **Tailwind CSS**: Styling
- **DOMPurify**: XSS protection
- **Lucide Icons**: Icon set

### 🇬🇧 Setup {#english-setup}

#### Requirements

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

#### Steps

1. **Clone repository:**

```bash
git clone https://github.com/xennless/ticket-management-system.git
cd ticket-management-system
```

2. **Backend setup:**

```bash
cd backend
npm install
```

3. **Frontend setup:**

```bash
cd ../frontend
npm install
```

4. **Database & Prisma:**

```bash
cd ../backend
# Create .env from example
cp env.example .env
# Edit .env and set DATABASE_URL

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed
```

5. **Environment variables:**

**Backend (.env):**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/ticketdb"
DIRECT_URL="postgresql://user:password@localhost:5432/ticketdb"
JWT_SECRET=your-super-secret-jwt-key-min-16-chars
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SYSTEMDEVELOPER_EMAIL=admin@example.com
SYSTEMDEVELOPER_PASSWORD=ChangeMe_12345
SYSTEMDEVELOPER_NAME=System Admin
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
```

### 🇬🇧 Configuration {#english-configuration}

#### System Developer Account

On first startup, an account defined by `SYSTEMDEVELOPER_EMAIL` and `SYSTEMDEVELOPER_PASSWORD` is created automatically with full permissions.

**Important:** Change this password after your first login.

#### Security Settings

- **JWT_SECRET**: Minimum 16 characters, use a strong value in production.
- **CORS_ORIGINS**: Restrict to allowed domains in production.
- **Password Policy**: Can be configured from system settings.

#### Database

Uses PostgreSQL. You can use a managed service (e.g. Supabase, AWS RDS) or your own instance.

### 🇬🇧 Usage {#english-usage}

#### Development

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Apps will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

#### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Deploy dist/ to your web server
```

### 🇬🇧 Security {#english-security}

#### Recommended Production Settings

1. **Environment Variables**: Store all secrets in env vars.
2. **HTTPS**: Always use HTTPS in production.
3. **CORS**: Restrict to required domains only.
4. **Rate Limiting**: Configure API rate limits properly.
5. **Logging**: Store production logs securely.
6. **Backups**: Take regular database backups.

#### Security Features (Summary)

- **CSRF Protection**: CSRF token check on all state-changing requests.
- **Input Validation**: Runtime validation via Zod.
- **XSS Protection**: HTML sanitization with DOMPurify.
- **SQL Injection**: Protection via Prisma.
- **Session Security**: JWT-based auth with refresh.
- **2FA**: TOTP & email codes.
- **Account Lockout**: Lock on repeated failed logins.

### 🇬🇧 API Documentation {#english-api-documentation}

#### Authentication

- `POST /api/auth/login` – Login
- `POST /api/auth/refresh` – Refresh access token
- `GET /api/auth/me` – Get current user info
- `POST /api/auth/logout` – Logout

#### Tickets

- `GET /api/tickets` – List tickets
- `POST /api/tickets` – Create ticket
- `GET /api/tickets/:id` – Ticket details
- `PUT /api/tickets/:id` – Update ticket
- `DELETE /api/tickets/:id` – Delete ticket

#### Users

- `GET /api/admin/users` – List users
- `POST /api/admin/users` – Create user
- `PUT /api/admin/users/:id` – Update user
- `DELETE /api/admin/users/:id` – Delete user

For more endpoints, see the backend API route files.

### 🇬🇧 Contributing {#english-contributing}

1. Fork the repository  
2. Create a feature branch (`git checkout -b feature/amazing-feature`)  
3. Commit your changes (`git commit -m 'Add some amazing feature'`)  
4. Push the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request  

### 🇬🇧 License {#english-license}

This project is distributed under the **MIT License**.  
See the `LICENSE` file for the full license text.

---

Thank you for using this project! Before going to production, please review and test all security‑related settings carefully.