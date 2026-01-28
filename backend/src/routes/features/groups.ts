import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { audit } from '../../lib/audit.js';

export const groupsRouter = Router();

groupsRouter.use(requireAuth);

// Helper: Check if user is group leader
async function isGroupLeader(groupId: string, userId: string): Promise<boolean> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { leaderId: true }
  });
  return group?.leaderId === userId;
}

// Grupları listele
groupsRouter.get('/', requirePermission('group.read'), async (_req, res) => {
  const groups = await prisma.group.findMany({
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      createdBy: { select: { id: true, email: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true } }
        },
        orderBy: { joinedAt: 'asc' }
      },
      _count: { select: { members: true } }
    },
    orderBy: { name: 'asc' }
  });
  return res.json({ groups });
});

// Tek grup detayı
groupsRouter.get('/:id', requirePermission('group.read'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const group = await prisma.group.findUnique({
    where: { id: params.data.id },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      createdBy: { select: { id: true, email: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } }
        },
        orderBy: { joinedAt: 'asc' }
      },
      _count: { select: { members: true } }
    }
  });

  if (!group) return res.status(404).json({ message: 'Grup bulunamadı' });
  return res.json({ group });
});

// ========== GRUBUM (MY GROUPS) ENDPOINTS ==========

// Kullanıcının üyesi olduğu grupları listele
groupsRouter.get('/my/list', async (req, res) => {
  const userId = req.userId!;
  
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
          createdBy: { select: { id: true, email: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } }
            },
            orderBy: { joinedAt: 'asc' }
          },
          _count: { select: { members: true } }
        }
      }
    },
    orderBy: { joinedAt: 'desc' }
  });

  const groups = memberships.map(m => ({
    ...m.group,
    myRole: m.role,
    joinedAt: m.joinedAt
  }));

  return res.json({ groups });
});

// Kullanıcının grup oluşturma durumunu kontrol et
groupsRouter.get('/my/can-create', async (req, res) => {
  const userId = req.userId!;
  
  // Kullanıcının oluşturduğu ve hala lider olduğu grup var mı?
  const existingGroup = await prisma.group.findFirst({
    where: {
      createdById: userId,
      leaderId: userId // Hala lider
    },
    select: { id: true, name: true }
  });

  return res.json({
    canCreate: !existingGroup,
    existingGroup: existingGroup || null
  });
});

// Kullanıcı kendi grubunu oluşturur (sadece 1 adet)
groupsRouter.post('/my/create', requirePermission('group.create'), async (req, res) => {
  const userId = req.userId!;

  // Kullanıcının zaten oluşturduğu ve lider olduğu grup var mı kontrol et
  const existingGroup = await prisma.group.findFirst({
    where: {
      createdById: userId,
      leaderId: userId
    }
  });

  if (existingGroup) {
    return res.status(400).json({ 
      message: 'Zaten bir grubunuz var. Yeni grup oluşturmak için mevcut grubunuzu silmeniz veya liderliği devretmeniz gerekir.',
      existingGroupId: existingGroup.id
    });
  }

  const Body = z.object({
    name: z.string().min(1, 'Grup adı gerekli'),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    userIds: z.array(z.string()).optional()
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  // Kullanıcı hem oluşturan hem lider
  const memberIds = new Set(body.data.userIds || []);
  memberIds.add(userId); // Kendisi mutlaka üye

  const group = await prisma.group.create({
    data: {
      name: body.data.name,
      description: body.data.description,
      color: body.data.color,
      icon: body.data.icon,
      leaderId: userId,
      createdById: userId,
      members: {
        create: Array.from(memberIds).map((uid) => ({
          userId: uid,
          role: uid === userId ? 'leader' : 'member'
        }))
      }
    },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'create', 'Group', group.id, { name: group.name, type: 'my-group' });
  return res.status(201).json({ group });
});

// ========== ADMIN GRUP ENDPOINTS ==========

// Grup oluştur (admin)
groupsRouter.post('/', requirePermission('group.manage'), async (req, res) => {
  const Body = z.object({
    name: z.string().min(1, 'Grup adı gerekli'),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    userIds: z.array(z.string()).optional(),
    leaderId: z.string().optional() // Belirtilmezse oluşturan kişi lider olur
  });
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Geçersiz istek', issues: body.error.issues });

  const creatorId = req.userId!;
  const leaderId = body.data.leaderId || creatorId;
  
  // Lider, üyeler listesinde olmalı veya eklenecek
  const memberIds = new Set(body.data.userIds || []);
  memberIds.add(leaderId); // Lider mutlaka üye olmalı

  const group = await prisma.group.create({
    data: {
      name: body.data.name,
      description: body.data.description,
      color: body.data.color,
      icon: body.data.icon,
      leaderId,
      createdById: creatorId,
      members: {
        create: Array.from(memberIds).map((userId) => ({
          userId,
          role: userId === leaderId ? 'leader' : 'member'
        }))
      }
    },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'create', 'Group', group.id, { name: group.name });
  return res.status(201).json({ group });
});

// Grup güncelle
groupsRouter.put('/:id', async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    isActive: z.boolean().optional()
  });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId!;
  const groupId = params.data.id;

  // Grup lideri veya group.manage yetkisi kontrolü
  const hasManagePermission = await prisma.rolePermission.findFirst({
    where: {
      role: { users: { some: { userId } } },
      permission: { code: 'group.manage' }
    }
  });

  if (!hasManagePermission && !(await isGroupLeader(groupId, userId))) {
    return res.status(403).json({ message: 'Bu grubu düzenleme yetkiniz yok' });
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: body.data,
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'update', 'Group', group.id, body.data);
  return res.json({ group });
});

// Grup liderini değiştir
groupsRouter.put('/:id/leader', async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ leaderId: z.string().min(1) });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId!;
  const groupId = params.data.id;
  const newLeaderId = body.data.leaderId;

  // Grup lideri veya group.manage yetkisi kontrolü
  const hasManagePermission = await prisma.rolePermission.findFirst({
    where: {
      role: { users: { some: { userId } } },
      permission: { code: 'group.manage' }
    }
  });

  if (!hasManagePermission && !(await isGroupLeader(groupId, userId))) {
    return res.status(403).json({ message: 'Lider değiştirme yetkiniz yok' });
  }

  // Yeni lider grubun üyesi mi kontrol et
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newLeaderId } }
  });

  if (!isMember) {
    return res.status(400).json({ message: 'Yeni lider grubun üyesi olmalıdır' });
  }

  // Eski liderin rolünü member yap
  const oldGroup = await prisma.group.findUnique({
    where: { id: groupId },
    select: { leaderId: true }
  });

  if (oldGroup?.leaderId) {
    await prisma.groupMember.updateMany({
      where: { groupId, userId: oldGroup.leaderId },
      data: { role: 'member' }
    });
  }

  // Yeni liderin rolünü leader yap
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: newLeaderId } },
    data: { role: 'leader' }
  });

  // Grubu güncelle
  const group = await prisma.group.update({
    where: { id: groupId },
    data: { leaderId: newLeaderId },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'update', 'Group', group.id, { leaderId: newLeaderId });
  return res.json({ group, message: 'Grup lideri değiştirildi' });
});

// Gruba üye ekle
groupsRouter.post('/:id/members', async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const Body = z.object({ userIds: z.array(z.string().min(1)).min(1) });
  const params = Params.safeParse(req.params);
  const body = Body.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId!;
  const groupId = params.data.id;

  // Grup lideri veya group.manage yetkisi kontrolü
  const hasManagePermission = await prisma.rolePermission.findFirst({
    where: {
      role: { users: { some: { userId } } },
      permission: { code: 'group.manage' }
    }
  });

  if (!hasManagePermission && !(await isGroupLeader(groupId, userId))) {
    return res.status(403).json({ message: 'Üye ekleme yetkiniz yok' });
  }

  // Mevcut üyeleri bul
  const existingMembers = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true }
  });
  const existingUserIds = new Set(existingMembers.map((m) => m.userId));

  // Yeni üyeleri ekle
  const newUserIds = body.data.userIds.filter((id) => !existingUserIds.has(id));
  
  if (newUserIds.length > 0) {
    await prisma.groupMember.createMany({
      data: newUserIds.map((uid) => ({
        groupId,
        userId: uid,
        role: 'member'
      }))
    });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'update', 'Group', groupId, { addedMembers: newUserIds });
  return res.json({ 
    group, 
    message: `${newUserIds.length} üye eklendi`,
    addedCount: newUserIds.length
  });
});

// Gruptan üye çıkar
groupsRouter.delete('/:id/members/:userId', async (req, res) => {
  const Params = z.object({ 
    id: z.string().min(1),
    userId: z.string().min(1)
  });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const currentUserId = req.userId!;
  const groupId = params.data.id;
  const targetUserId = params.data.userId;

  // Grup lideri veya group.manage yetkisi kontrolü
  const hasManagePermission = await prisma.rolePermission.findFirst({
    where: {
      role: { users: { some: { userId: currentUserId } } },
      permission: { code: 'group.manage' }
    }
  });

  if (!hasManagePermission && !(await isGroupLeader(groupId, currentUserId))) {
    return res.status(403).json({ message: 'Üye çıkarma yetkiniz yok' });
  }

  // Grup liderini çıkaramaz
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { leaderId: true }
  });

  if (group?.leaderId === targetUserId) {
    return res.status(400).json({ message: 'Grup liderini çıkaramazsınız. Önce liderliği devredin.' });
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId: targetUserId }
  });

  const updatedGroup = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      leader: { select: { id: true, email: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      },
      _count: { select: { members: true } }
    }
  });

  await audit(req, 'update', 'Group', groupId, { removedMember: targetUserId });
  return res.json({ group: updatedGroup, message: 'Üye gruptan çıkarıldı' });
});

// Gruptan ayrıl (kendi kendine)
groupsRouter.post('/:id/leave', requireAuth, async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const userId = req.userId!;
  const groupId = params.data.id;

  // Grup lideriyse ayrılamaz
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { leaderId: true }
  });

  if (group?.leaderId === userId) {
    return res.status(400).json({ message: 'Grup lideri olarak ayrılamazsınız. Önce liderliği devredin.' });
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId }
  });

  return res.json({ message: 'Gruptan ayrıldınız' });
});

// Grup sil
groupsRouter.delete('/:id', requirePermission('group.manage'), async (req, res) => {
  const Params = z.object({ id: z.string().min(1) });
  const params = Params.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: 'Geçersiz istek' });

  const group = await prisma.group.findUnique({
    where: { id: params.data.id },
    select: { name: true }
  });

  await prisma.group.delete({ where: { id: params.data.id } });
  
  await audit(req, 'delete', 'Group', params.data.id, { name: group?.name });
  return res.status(204).send();
});
