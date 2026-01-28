import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';

const SYSTEM_ROLE_CODE = 'system-developer';

export const DEFAULT_PERMISSIONS: Array<{ code: string; name: string; description: string }> = [
  // ========== ROL VE YETKİ YÖNETİMİ ==========
  { code: 'role.read', name: 'Rolleri Görüntüle', description: 'Sistemdeki rolleri ve atanmış yetkileri görüntüleme' },
  { code: 'role.manage', name: 'Rol Yönetimi', description: 'Rol oluşturma, düzenleme, silme ve yetki atama' },
  { code: 'role.bulk', name: 'Toplu Rol İşlemleri', description: 'Birden fazla rol üzerinde toplu işlem yapma' },
  { code: 'permission.read', name: 'Yetkileri Görüntüle', description: 'Sistemdeki tüm yetkileri listeleme' },
  { code: 'permission.manage', name: 'Yetki Yönetimi', description: 'Yetki oluşturma, düzenleme ve silme' },

  // ========== KULLANICI YÖNETİMİ ==========
  { code: 'user.read', name: 'Kullanıcıları Görüntüle', description: 'Kullanıcı listesini ve detaylarını görüntüleme' },
  { code: 'user.manage', name: 'Kullanıcı Yönetimi', description: 'Kullanıcı oluşturma, düzenleme, silme ve rol atama' },
  { code: 'user.bulk', name: 'Toplu Kullanıcı İşlemleri', description: 'Birden fazla kullanıcı üzerinde toplu işlem yapma' },
  { code: 'user.import', name: 'Kullanıcı İçe Aktar', description: 'CSV veya Excel dosyasından kullanıcı içe aktarma' },
  { code: 'user.export', name: 'Kullanıcı Dışa Aktar', description: 'Kullanıcı listesini CSV, Excel veya PDF olarak indirme' },

  // ========== PROFİL ==========
  { code: 'profile.read', name: 'Profil Görüntüle', description: 'Kendi profil bilgilerini görüntüleme' },
  { code: 'profile.update', name: 'Profil Güncelle', description: 'Kendi profil bilgilerini düzenleme' },

  // ========== GRUPLAR ==========
  { code: 'group.read', name: 'Tüm Grupları Görüntüle', description: 'Sistemdeki tüm grupları ve üyelerini görüntüleme (admin)' },
  { code: 'group.manage', name: 'Grup Yönetimi', description: 'Tüm grupları düzenleme ve silme (admin)' },
  { code: 'group.create', name: 'Grup Oluştur', description: 'Kendi grubunu oluşturma (1 adet)' },
  { code: 'group.own', name: 'Grubum Görüntüle', description: 'Üyesi olduğu grupları görüntüleme' },

  // ========== TİCKET SİSTEMİ ==========
  { code: 'ticket.read', name: 'Ticketları Görüntüle', description: 'Ticket listesini ve detaylarını görüntüleme' },
  { code: 'ticket.create', name: 'Ticket Oluştur', description: 'Yeni destek talebi oluşturma' },
  { code: 'ticket.update', name: 'Ticket Güncelle', description: 'Ticket bilgilerini, durumunu ve önceliğini düzenleme' },
  { code: 'ticket.assign', name: 'Ticket Ata', description: 'Ticketları kullanıcılara atama' },
  { code: 'ticket.close', name: 'Ticket Kapat', description: 'Çözümlenen ticketları kapatma' },
  { code: 'ticket.reopen', name: 'Ticket Yeniden Aç', description: 'Kapatılmış ticketları yeniden açma' },

  // ========== TİCKET MESAJLARI ==========
  { code: 'ticket.message.read', name: 'Mesajları Görüntüle', description: 'Ticket mesajlarını ve yorumları okuma' },
  { code: 'ticket.message.create', name: 'Mesaj Yaz', description: 'Ticketlara mesaj ve yorum ekleme' },

  // ========== TİCKET KATEGORİ VE ETİKET ==========
  { code: 'ticket.category.read', name: 'Kategorileri Görüntüle', description: 'Ticket kategorilerini listeleme' },
  { code: 'ticket.category.manage', name: 'Kategori Yönetimi', description: 'Kategori oluşturma, düzenleme ve silme' },
  { code: 'ticket.tag.read', name: 'Etiketleri Görüntüle', description: 'Ticket etiketlerini listeleme' },
  { code: 'ticket.tag.manage', name: 'Etiket Yönetimi', description: 'Etiket oluşturma, düzenleme ve silme' },

  // ========== TİCKET İZLEYİCİLER ==========
  { code: 'ticket.watcher.manage', name: 'İzleyici Yönetimi', description: 'Ticket izleyicileri ekleme ve çıkarma' },

  // ========== DASHBOARD ==========
  { code: 'dashboard.read', name: 'Dashboard Görüntüle', description: 'Ana sayfa dashboard ve istatistikleri görüntüleme' },

  // ========== BİLDİRİMLER ==========
  { code: 'notification.read', name: 'Bildirimleri Görüntüle', description: 'Sistem bildirimlerini okuma ve yönetme' },

  // ========== OTURUMLAR ==========
  { code: 'session.read', name: 'Oturumları Görüntüle', description: 'Aktif oturumları ve cihazları listeleme' },
  { code: 'session.manage', name: 'Oturum Yönetimi', description: 'Oturumları sonlandırma ve güvenlik işlemleri' },

  // ========== İKİ FAKTÖRLÜ DOĞRULAMA ==========
  { code: 'auth.2fa.manage', name: '2FA Yönetimi', description: 'İki faktörlü kimlik doğrulamayı etkinleştirme/devre dışı bırakma' },

  // ========== LOG VE DENETİM ==========
  { code: 'audit.read', name: 'Audit Logları Görüntüle', description: 'Sistem değişiklik geçmişini inceleme' },
  { code: 'audit.export', name: 'Audit Logları Dışa Aktar', description: 'Denetim kayıtlarını dosya olarak indirme' },
  { code: 'audit.manage', name: 'Audit Yönetimi', description: 'Audit log retention policy ve GDPR veri silme işlemleri' },
  { code: 'activity.read', name: 'Aktivite Logları Görüntüle', description: 'Kullanıcı aktivite geçmişini inceleme' },
  { code: 'log.read', name: 'Sistem Loglarını Görüntüle', description: 'Winston sistem loglarını görüntüleme' },
  { code: 'log.manage', name: 'Log Yönetimi', description: 'Log dosyalarını yönetme ve temizleme' },
  { code: 'log.export', name: 'Logları Dışa Aktar', description: 'Log dosyalarını indirme ve dışa aktarma' },
  { code: 'monitoring.read', name: 'Monitoring Görüntüle', description: 'Sistem izleme ve performans metriklerini görüntüleme' },

  // ========== HESAP KİLİTLEME ==========
  { code: 'lockout.read', name: 'Kilitleme Kayıtlarını Görüntüle', description: 'Kilitli hesapları ve IP adreslerini görüntüleme' },
  { code: 'lockout.manage', name: 'Kilitleme Yönetimi', description: 'Hesap ve IP kilitlemelerini açma ve temizleme' },
  { code: 'lockout.settings', name: 'Kilitleme Ayarları', description: 'Hesap kilitleme ayarlarını görüntüleme ve düzenleme' },

  // ========== RAPORLAR ==========
  { code: 'report.read', name: 'Raporları Görüntüle', description: 'Sistem raporlarını görüntüleme ve dışa aktarma' },

  // ========== SİSTEM AYARLARI ==========
  { code: 'settings.read', name: 'Ayarları Görüntüle', description: 'Sistem ayarlarını görüntüleme' },
  { code: 'settings.manage', name: 'Ayar Yönetimi', description: 'Sistem ayarlarını değiştirme' },

  // ========== NAVİGASYON YÖNETİMİ ==========
  { code: 'navigation.read', name: 'Navigasyonu Görüntüle', description: 'Menü yapısını ve öğelerini görüntüleme' },
  { code: 'navigation.manage', name: 'Navigasyon Yönetimi', description: 'Menü bölümleri ve öğeleri oluşturma, düzenleme, silme' },

  // ========== YETKİ ŞABLONLARI ==========
  { code: 'permissionTemplate.read', name: 'Yetki Şablonlarını Görüntüle', description: 'Yetki şablonlarını listeleme' },
  { code: 'permissionTemplate.manage', name: 'Yetki Şablonu Yönetimi', description: 'Yetki şablonu oluşturma, düzenleme ve silme' },

  // ========== DOSYA YÜKLEME LOGLARI ==========
  { code: 'fileUploadLog.read', name: 'Dosya Yükleme Loglarını Görüntüle', description: 'Dosya yükleme geçmişini ve istatistiklerini inceleme' },
  
  // ========== QUARANTINE YÖNETİMİ ==========
  { code: 'quarantine.read', name: 'Quarantine Görüntüle', description: 'Karantinaya alınmış dosyaları görüntüleme' },
  { code: 'quarantine.manage', name: 'Quarantine Yönetimi', description: 'Karantinaya alınmış dosyaları serbest bırakma ve silme' },

  // ========== TİCKET EKLERİ ==========
  { code: 'ticket.attachment.read', name: 'Ticket Eklerini Görüntüle', description: 'Ticketlara eklenen dosyaları görüntüleme ve indirme' },
  { code: 'ticket.attachment.create', name: 'Ticket Eki Yükle', description: 'Ticketlara dosya ekleme' },
  { code: 'ticket.attachment.delete', name: 'Ticket Eki Sil', description: 'Ticketlardan dosya silme' },

  // ========== SLA YÖNETİMİ ==========
  { code: 'sla.read', name: 'SLA Görüntüle', description: 'SLA tanımlarını görüntüleme' },
  { code: 'sla.manage', name: 'SLA Yönetimi', description: 'SLA oluşturma, düzenleme ve silme' },

  // ========== TİCKET AKTİVİTE GEÇMİŞİ ==========
  { code: 'ticket.activity.read', name: 'Ticket Aktivite Geçmişi', description: 'Ticket aktivite geçmişini ve timeline görüntüleme' },

  // ========== TİCKET DEĞERLENDİRME ==========
  { code: 'ticket.rating.read', name: 'Değerlendirmeleri Görüntüle', description: 'Ticket değerlendirmelerini görüntüleme' },
  { code: 'ticket.rating.create', name: 'Değerlendirme Yap', description: 'Ticket için değerlendirme oluşturma' },
  { code: 'ticket.rating.update', name: 'Değerlendirme Güncelle', description: 'Kendi değerlendirmesini düzenleme' },

  // ========== EMAIL SİSTEMİ ==========
  { code: 'email.settings.read', name: 'Email Ayarlarını Görüntüle', description: 'Email SMTP ayarlarını görüntüleme' },
  { code: 'email.settings.manage', name: 'Email Ayarları Yönetimi', description: 'Email SMTP ayarlarını düzenleme ve test etme' },
  { code: 'email.send', name: 'Email Gönder', description: 'Test emaili gönderme' },
  { code: 'email.logs.read', name: 'Email Loglarını Görüntüle', description: 'Email gönderim geçmişini ve loglarını görüntüleme' },

  // ========== API KEY YÖNETİMİ ==========
  { code: 'apikey.read', name: 'API Key Görüntüle', description: 'API key\'leri görüntüleme ve listeleme' },
  { code: 'apikey.manage', name: 'API Key Yönetimi', description: 'API key oluşturma, düzenleme ve silme' },

  // ========== INPUT VALIDATION & SANITIZATION ==========
  { code: 'validation.read', name: 'Validation Görüntüle', description: 'Input validation ayarlarını ve loglarını görüntüleme' },
  { code: 'validation.manage', name: 'Validation Yönetimi', description: 'Input validation ayarlarını düzenleme ve test etme' }
];

async function main() {
  console.log('🔧 Yetkiler güncelleniyor...');

  // Permissions upsert
  for (const p of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, isSystem: true },
      create: { code: p.code, name: p.name, description: p.description, isSystem: true }
    });
  }

  // Kullanılmayan yetkileri sil
  const validCodes = DEFAULT_PERMISSIONS.map((p) => p.code);
  const unusedPermissions = await prisma.permission.findMany({
    where: { code: { notIn: validCodes } }
  });

  if (unusedPermissions.length > 0) {
    console.log(`🗑️  ${unusedPermissions.length} kullanılmayan yetki siliniyor...`);
    for (const p of unusedPermissions) {
      console.log(`   - ${p.code}: ${p.name}`);
    }
    
    // Önce ilişkileri sil
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: unusedPermissions.map((p) => p.id) } }
    });
    await prisma.permissionTemplateItem.deleteMany({
      where: { permissionId: { in: unusedPermissions.map((p) => p.id) } }
    });
    
    // Sonra yetkileri sil
    await prisma.permission.deleteMany({
      where: { id: { in: unusedPermissions.map((p) => p.id) } }
    });
  }

  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  console.log(`✅ Toplam ${allPermissions.length} yetki mevcut`);

  // System Developer role (system)
  const systemDeveloperRole = await prisma.role.upsert({
    where: { code: SYSTEM_ROLE_CODE },
    update: { name: 'System Developer', isSystem: true },
    create: { code: SYSTEM_ROLE_CODE, name: 'System Developer', isSystem: true }
  });

  // Ensure system-developer has all permissions
  await prisma.rolePermission.deleteMany({ where: { roleId: systemDeveloperRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: systemDeveloperRole.id, permissionId: p.id })),
    skipDuplicates: true
  });
  console.log('✅ System Developer rolüne tüm yetkiler atandı');

  // Bootstrap user (register yok)
  if (!env.SYSTEMDEVELOPER_EMAIL || !env.SYSTEMDEVELOPER_PASSWORD) {
    console.warn('⚠️  SYSTEMDEVELOPER_EMAIL / SYSTEMDEVELOPER_PASSWORD yok. System Developer kullanıcı oluşturulmadı.');
    return;
  }

  const email = env.SYSTEMDEVELOPER_EMAIL.toLowerCase();
  
  // Eski superadmin@local kullanıcısını yeni email'e taşı
  const oldEmail = 'superadmin@local';
  const oldUser = await prisma.user.findUnique({ where: { email: oldEmail }, select: { id: true } });
  if (oldUser && email !== oldEmail) {
    // Eski kullanıcıyı yeni email'e güncelle
    await prisma.user.update({
      where: { id: oldUser.id },
      data: { 
        email,
        name: env.SYSTEMDEVELOPER_NAME ?? 'System Developer'
      }
    });
    console.log(`✅ Eski kullanıcı ${oldEmail} → ${email} olarak güncellendi`);
  }
  
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing) {
    const passwordHash = await hashPassword(env.SYSTEMDEVELOPER_PASSWORD);
    const user = await prisma.user.create({
      data: {
        email,
        name: env.SYSTEMDEVELOPER_NAME ?? 'System Developer',
        passwordHash,
        roles: { create: [{ roleId: systemDeveloperRole.id }] }
      }
    });
    console.log('✅ System Developer kullanıcı oluşturuldu:', user.email);
  } else {
    // Ensure role attached and update name if needed
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: systemDeveloperRole.id } },
      update: {},
      create: { userId: existing.id, roleId: systemDeveloperRole.id }
    });
    // Update user name if it's the default "Super Admin"
    const currentUser = await prisma.user.findUnique({ where: { id: existing.id }, select: { name: true } });
    if (currentUser?.name === 'Super Admin') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: env.SYSTEMDEVELOPER_NAME ?? 'System Developer' }
      });
      console.log('✅ System Developer kullanıcı adı güncellendi:', email);
    } else {
      console.log('✅ System Developer kullanıcı zaten var, rol doğrulandı:', email);
    }
  }
  
  // Eski super-admin rolünü system-developer'a güncelle
  const oldRole = await prisma.role.findUnique({ where: { code: 'super-admin' }, select: { id: true } });
  if (oldRole && oldRole.id !== systemDeveloperRole.id) {
    // Eski rolün tüm kullanıcılarını yeni role taşı
    const oldRoleUsers = await prisma.userRole.findMany({ 
      where: { roleId: oldRole.id },
      select: { userId: true }
    });
    for (const userRole of oldRoleUsers) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: userRole.userId, roleId: systemDeveloperRole.id } },
        update: {},
        create: { userId: userRole.userId, roleId: systemDeveloperRole.id }
      });
    }
    // Eski rolü sil
    await prisma.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
    await prisma.userRole.deleteMany({ where: { roleId: oldRole.id } });
    await prisma.role.delete({ where: { id: oldRole.id } });
    console.log('✅ Eski super-admin rolü system-developer olarak güncellendi ve silindi');
  }

  // Varsayılan yetki şablonları oluştur
  await createDefaultTemplates();

  // Varsayılan navigasyon oluştur
  await createDefaultNavigation();
}

async function createDefaultTemplates() {
  console.log('📋 Varsayılan yetki şablonları kontrol ediliyor...');

  const templates = [
    {
      code: 'support-agent',
      name: 'Destek Temsilcisi',
      description: 'Ticket görüntüleme, yanıtlama ve temel işlemler',
      color: '#3b82f6',
      icon: 'support',
      permissions: [
        'ticket.read', 'ticket.create', 'ticket.update', 'ticket.assign',
        'ticket.message.read', 'ticket.message.create',
        'ticket.attachment.read', 'ticket.attachment.create',
        'ticket.category.read', 'ticket.tag.read',
        'ticket.watcher.manage',
        'group.own', 'group.create', // Kendi grubunu oluşturabilir
        'dashboard.read', 'notification.read', 'profile.read', 'profile.update'
      ]
    },
    {
      code: 'support-manager',
      name: 'Destek Yöneticisi',
      description: 'Tüm ticket yetkileri + kategori ve etiket yönetimi',
      color: '#10b981',
      icon: 'manager',
      permissions: [
        'ticket.read', 'ticket.create', 'ticket.update', 'ticket.assign',
        'ticket.close', 'ticket.reopen',
        'ticket.message.read', 'ticket.message.create',
        'ticket.attachment.read', 'ticket.attachment.create', 'ticket.attachment.delete',
        'ticket.category.read', 'ticket.category.manage',
        'ticket.tag.read', 'ticket.tag.manage',
        'ticket.watcher.manage',
        'dashboard.read', 'notification.read', 'profile.read', 'profile.update',
        'user.read', 'report.read', 'fileUploadLog.read'
      ]
    },
    {
      code: 'readonly',
      name: 'Sadece Okuma',
      description: 'Tüm verileri görüntüleme (değişiklik yapamaz)',
      color: '#64748b',
      icon: 'viewer',
      permissions: [
        'ticket.read', 'ticket.message.read', 'ticket.attachment.read',
        'ticket.category.read', 'ticket.tag.read',
        'dashboard.read', 'notification.read',
        'profile.read', 'user.read', 'role.read', 'permission.read',
        'permissionTemplate.read', 'navigation.read',
        'group.read', 'group.own', 'report.read', 'settings.read',
        'audit.read', 'activity.read', 'fileUploadLog.read', 'session.read'
      ]
    },
    {
      code: 'admin',
      name: 'Sistem Yöneticisi',
      description: 'Kullanıcı, rol ve sistem ayarları yönetimi',
      color: '#ef4444',
      icon: 'admin',
      permissions: [
        'user.read', 'user.manage', 'user.bulk', 'user.import', 'user.export',
        'role.read', 'role.manage', 'role.bulk',
        'permission.read', 'permission.manage',
        'permissionTemplate.read', 'permissionTemplate.manage',
        'navigation.read', 'navigation.manage',
        'group.read', 'group.manage', 'group.own', 'group.create',
        'settings.read', 'settings.manage',
        'quarantine.read', 'quarantine.manage',
        'audit.read', 'audit.export', 'audit.manage', 'activity.read', 'fileUploadLog.read',
        'session.read', 'session.manage',
        'report.read',
        'dashboard.read', 'notification.read',
        'profile.read', 'profile.update',
        'ticket.attachment.read', 'ticket.attachment.create', 'ticket.attachment.delete'
      ]
    }
  ];

  for (const t of templates) {
    const existing = await prisma.permissionTemplate.findUnique({ where: { code: t.code } });
    
    if (!existing) {
      // Yetki ID'lerini bul
      const permissions = await prisma.permission.findMany({
        where: { code: { in: t.permissions } },
        select: { id: true }
      });

      await prisma.permissionTemplate.create({
        data: {
          code: t.code,
          name: t.name,
          description: t.description,
          color: t.color,
          icon: t.icon,
          isSystem: true,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id }))
          }
        }
      });
      console.log(`   ✅ "${t.name}" şablonu oluşturuldu`);
    } else {
      console.log(`   ⏭️  "${t.name}" şablonu zaten mevcut`);
    }
  }
}

async function createDefaultNavigation() {
  console.log('🧭 Varsayılan navigasyon kontrol ediliyor...');

  // Navigasyon bölümleri
  const sections = [
    {
      code: 'admin',
      name: 'Yönetim',
      icon: 'FolderCog',
      order: 10,
      isCollapsible: true,
      defaultOpen: false
    }
  ];

  for (const s of sections) {
    const existing = await prisma.navSection.findUnique({ where: { code: s.code } });
    if (!existing) {
      await prisma.navSection.create({ data: s });
      console.log(`   ✅ "${s.name}" bölümü oluşturuldu`);
    }
  }

  // Navigasyon öğeleri
  const items = [
    // Ana menü (section yok)
    { code: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', permission: 'dashboard.read', order: 1, sectionCode: null },
    { code: 'tickets', name: 'Tickets', path: '/tickets', icon: 'Ticket', permission: null, order: 2, sectionCode: null },
    
    // Admin bölümü
    { code: 'logs', name: 'Loglar ve İzleme', path: '/logs', icon: 'FileText', permission: 'log.read', order: 1, sectionCode: 'admin' },
    { code: 'groups', name: 'Tüm Gruplar', path: '/groups', icon: 'UserCog', permission: 'group.read', order: 2, sectionCode: 'admin' },
    
    // Ana menü - Grubum (admin bölümü dışında)
    { code: 'my-groups', name: 'Grubum', path: '/my-groups', icon: 'Users', permission: 'group.own', order: 3, sectionCode: null },
    { code: 'bulk', name: 'Toplu İşlemler', path: '/bulk', icon: 'Layers', permission: 'user.bulk', order: 3, sectionCode: 'admin' },
    { code: 'import-export', name: 'İçe/Dışa Aktar', path: '/import-export', icon: 'FileUp', permission: 'user.import', order: 4, sectionCode: 'admin' },
    { code: 'reports', name: 'Raporlar', path: '/reports', icon: 'BarChart3', permission: 'report.read', order: 5, sectionCode: 'admin' },
    { code: 'permissions', name: 'Yetkiler', path: '/admin/permissions', icon: 'KeyRound', permission: 'permission.read', order: 6, sectionCode: 'admin' },
    { code: 'permission-templates', name: 'Yetki Şablonları', path: '/admin/permission-templates', icon: 'Layers', permission: 'permissionTemplate.read', order: 7, sectionCode: 'admin' },
    { code: 'roles', name: 'Roller', path: '/admin/roles', icon: 'Shield', permission: 'role.read', order: 8, sectionCode: 'admin' },
    { code: 'users', name: 'Kullanıcılar', path: '/admin/users', icon: 'Users', permission: 'user.read', order: 9, sectionCode: 'admin' },
    { code: 'slas', name: 'SLA Yönetimi', path: '/admin/slas', icon: 'Clock', permission: 'sla.read', order: 10, sectionCode: 'admin' },
    { code: 'quarantine', name: 'Dosya Karantinası', path: '/admin/quarantine', icon: 'ShieldAlert', permission: 'quarantine.read', order: 11, sectionCode: 'admin' },
    { code: 'navigation', name: 'Navigasyon', path: '/admin/navigation', icon: 'Menu', permission: 'navigation.read', order: 12, sectionCode: 'admin' },
    { code: 'settings', name: 'Ayarlar', path: '/settings', icon: 'Settings', permission: 'settings.read', order: 13, sectionCode: 'admin' }
  ];

  for (const item of items) {
    const existing = await prisma.navItem.findUnique({ where: { code: item.code } });
    if (!existing) {
      let sectionId: string | null = null;
      if (item.sectionCode) {
        const section = await prisma.navSection.findUnique({ where: { code: item.sectionCode } });
        sectionId = section?.id || null;
      }
      
      await prisma.navItem.create({
        data: {
          code: item.code,
          name: item.name,
          path: item.path,
          icon: item.icon,
          permission: item.permission,
          order: item.order,
          sectionId
        }
      });
      console.log(`   ✅ "${item.name}" öğesi oluşturuldu`);
    }
  }

  // ========== EMAIL ŞABLONLARI ==========
  console.log('📧 Varsayılan email şablonları kontrol ediliyor...');
  const defaultTemplates = [
    {
      code: '2fa',
      name: 'İki Faktörlü Doğrulama Kodu',
      description: '2FA giriş kodu için email şablonu',
      subject: 'İki Faktörlü Doğrulama Kodu',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .code { background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h2>İki Faktörlü Doğrulama Kodu</h2>
    <p>Merhaba {{userName}},</p>
    <p>Aşağıdaki kodu kullanarak giriş yapabilirsiniz:</p>
    <div class="code">{{code}}</div>
    <p>Bu kod 10 dakika süreyle geçerlidir.</p>
    <div class="footer">
      <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
    </div>
  </div>
</body>
</html>`,
      text: `İki Faktörlü Doğrulama Kodu

Merhaba {{userName}},

Aşağıdaki kodu kullanarak giriş yapabilirsiniz:

{{code}}

Bu kod 10 dakika süreyle geçerlidir.

Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`,
      variables: { code: '2FA doğrulama kodu', userName: 'Kullanıcı adı' },
      isSystem: true
    },
    {
      code: 'password-reset',
      name: 'Şifre Sıfırlama',
      description: 'Şifre sıfırlama linki için email şablonu',
      subject: 'Şifre Sıfırlama',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Şifre Sıfırlama</h2>
    <p>Merhaba {{userName}},</p>
    <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
    <p><a href="{{resetLink}}" class="button">Şifremi Sıfırla</a></p>
    <p>Veya aşağıdaki linki tarayıcınıza yapıştırın:</p>
    <p style="word-break: break-all;">{{resetLink}}</p>
    <p>Bu link 1 saat süreyle geçerlidir.</p>
    <div class="footer">
      <p>Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
    </div>
  </div>
</body>
</html>`,
      text: `Şifre Sıfırlama

Merhaba {{userName}},

Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:

{{resetLink}}

Bu link 1 saat süreyle geçerlidir.

Eğer bu isteği siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.`,
      variables: { resetLink: 'Şifre sıfırlama linki', userName: 'Kullanıcı adı' },
      isSystem: true
    },
    {
      code: 'password-changed',
      name: 'Şifre Değişikliği Bildirimi',
      description: 'Şifre değişikliği bildirimi için email şablonu',
      subject: 'Şifreniz Değiştirildi',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .info { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Şifreniz Değiştirildi</h2>
    <p>Merhaba {{userName}},</p>
    <div class="alert">
      <p><strong>Hesabınızın şifresi başarıyla değiştirildi.</strong></p>
    </div>
    <div class="info">
      <p><strong>İşlem Detayları:</strong></p>
      <p>IP Adresi: {{ip}}</p>
      <p>Cihaz: {{userAgent}}</p>
      <p>Tarih: {{date}}</p>
    </div>
    <p>Eğer bu işlemi siz yapmadıysanız, lütfen derhal:</p>
    <ul>
      <li>Hesabınızın güvenliğini kontrol edin</li>
      <li>Şifrenizi tekrar değiştirin</li>
      <li>Sistem yöneticinizle iletişime geçin</li>
    </ul>
    <div class="footer">
      <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
    </div>
  </div>
</body>
</html>`,
      text: `Şifreniz Değiştirildi

Merhaba {{userName}},

Hesabınızın şifresi başarıyla değiştirildi.

İşlem Detayları:
IP Adresi: {{ip}}
Cihaz: {{userAgent}}
Tarih: {{date}}

Eğer bu işlemi siz yapmadıysanız, lütfen derhal:
- Hesabınızın güvenliğini kontrol edin
- Şifrenizi tekrar değiştirin
- Sistem yöneticinizle iletişime geçin

Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`,
      variables: { userName: 'Kullanıcı adı', ip: 'IP adresi (opsiyonel)', userAgent: 'Cihaz bilgisi (opsiyonel)', date: 'İşlem tarihi' },
      isSystem: true
    },
    {
      code: 'ticket-notification',
      name: 'Ticket Bildirimi',
      description: 'Ticket bildirimleri için email şablonu',
      subject: 'Ticket #{{ticketKey}}: {{action}}',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .ticket-info { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Ticket Bildirimi</h2>
    <p>Merhaba {{userName}},</p>
    <p><strong>{{action}}</strong></p>
    <div class="ticket-info">
      <p><strong>Ticket:</strong> #{{ticketKey}}</p>
      <p><strong>Başlık:</strong> {{ticketTitle}}</p>
    </div>
    <div class="footer">
      <p>Bu email otomatik olarak gönderilmiştir.</p>
    </div>
  </div>
</body>
</html>`,
      text: `Ticket Bildirimi

Merhaba {{userName}},

{{action}}

Ticket: #{{ticketKey}}
Başlık: {{ticketTitle}}

Bu email otomatik olarak gönderilmiştir.`,
      variables: { ticketKey: 'Ticket numarası', ticketTitle: 'Ticket başlığı', action: 'Yapılan işlem', userName: 'Kullanıcı adı' },
      isSystem: true
    }
  ];

  for (const template of defaultTemplates) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { code: template.code }
    });

    if (!existing) {
      await prisma.emailTemplate.create({
        data: template as any
      });
      console.log(`   ✅ "${template.name}" şablonu oluşturuldu`);
    } else {
      console.log(`   ⏭️  "${template.name}" şablonu zaten mevcut`);
    }
  }

  // Hesap Kilitleme Uyarısı şablonu
  const accountLockoutTemplate = {
    code: 'account-lockout',
    name: 'Hesap Kilitleme Uyarısı',
    description: 'Hesap kilitlendiğinde gönderilen bildirim email şablonu',
    subject: 'Hesap Kilitleme Uyarısı - {{userEmail}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fee; border-left: 4px solid #f00; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .info { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Hesap Kilitleme Uyarısı</h2>
    <div class="alert">
      <p><strong>Bir hesap güvenlik nedeniyle otomatik olarak kilitlendi.</strong></p>
    </div>
    <div class="info">
      <p><strong>Kilitlenen Hesap Bilgileri:</strong></p>
      <p>Kullanıcı: {{userName}}</p>
      <p>Email: {{userEmail}}</p>
      <p>IP Adresi: {{ip}}</p>
      <p>Kilitlenme Süresi: {{lockoutDuration}} dakika</p>
      <p>Başarısız Deneme Sayısı: {{maxAttempts}}</p>
      <p>Tarih: {{date}}</p>
    </div>
    <p>Bu hesap {{maxAttempts}} başarısız giriş denemesinden sonra otomatik olarak kilitlendi.</p>
    <p>Hesabın kilidini açmak için yönetim panelinden Hesap Kilitleme sayfasına gidin.</p>
    <div class="footer">
      <p>Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
    </div>
  </div>
</body>
</html>`,
    text: `Hesap Kilitleme Uyarısı

Bir hesap güvenlik nedeniyle otomatik olarak kilitlendi.

Kilitlenen Hesap Bilgileri:
Kullanıcı: {{userName}}
Email: {{userEmail}}
IP Adresi: {{ip}}
Kilitlenme Süresi: {{lockoutDuration}} dakika
Başarısız Deneme Sayısı: {{maxAttempts}}
Tarih: {{date}}

Bu hesap {{maxAttempts}} başarısız giriş denemesinden sonra otomatik olarak kilitlendi.

Hesabın kilidini açmak için yönetim panelinden Hesap Kilitleme sayfasına gidin.

Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`,
    variables: { 
      userName: 'Kullanıcı adı', 
      userEmail: 'Kullanıcı email adresi', 
      ip: 'IP adresi', 
      lockoutDuration: 'Kilitlenme süresi (dakika)', 
      maxAttempts: 'Maksimum başarısız deneme sayısı',
      date: 'Kilitlenme tarihi'
    },
    isSystem: true
  };

  const existingLockout = await prisma.emailTemplate.findUnique({
    where: { code: accountLockoutTemplate.code }
  });
  if (!existingLockout) {
    await prisma.emailTemplate.create({
      data: accountLockoutTemplate as any
    });
    console.log(`   ✅ "${accountLockoutTemplate.name}" şablonu oluşturuldu`);
  } else {
    console.log(`   ⏭️  "${accountLockoutTemplate.name}" şablonu zaten mevcut`);
  }

  // ========== SİSTEM AYARLARI ==========
  console.log('⚙️  Varsayılan sistem ayarları kontrol ediliyor...');
  const defaultSettings = [
    { key: 'siteName', value: 'Ticket System', category: 'general' },
    { key: 'companyName', value: '', category: 'general' },
    { key: 'minPasswordLength', value: 8, category: 'general' },
    { key: 'sessionTimeout', value: 3600, category: 'general' }, // 1 saat (saniye)
    { key: 'require2FA', value: false, category: 'general' },
    { key: 'maxFileSize', value: 50, category: 'general' }, // MB
    { key: 'allowedFileTypes', value: ['jpg', 'png', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'], category: 'general' },
    { key: 'emailEnabled', value: false, category: 'email' },
    { key: 'emailFrom', value: '', category: 'email' },
    { key: 'emailHost', value: '', category: 'email' },
    { key: 'emailPort', value: 587, category: 'email' },
    { key: 'emailUser', value: '', category: 'email' },
    { key: 'emailPassword', value: '', category: 'email' },
    { key: 'emailSecure', value: false, category: 'email' },
    // Validation ayarları
    { key: 'xssProtectionEnabled', value: true, category: 'security' },
    { key: 'pathTraversalProtectionEnabled', value: true, category: 'security' },
    { key: 'commandInjectionProtectionEnabled', value: true, category: 'security' },
    { key: 'sqlInjectionProtectionEnabled', value: true, category: 'security' },
    { key: 'urlValidationEnabled', value: true, category: 'security' },
    { key: 'emailValidationEnabled', value: true, category: 'security' },
    { key: 'logValidationEvents', value: true, category: 'security' },
    { key: 'autoBlockSuspiciousInput', value: false, category: 'security' }
  ];

  for (const setting of defaultSettings) {
    const existing = await prisma.systemSettings.findUnique({
      where: { key: setting.key }
    });

    if (!existing) {
      await prisma.systemSettings.create({
        data: setting
      });
      console.log(`   ✅ "${setting.key}" ayarı oluşturuldu`);
    } else {
      console.log(`   ⏭️  "${setting.key}" ayarı zaten mevcut`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
