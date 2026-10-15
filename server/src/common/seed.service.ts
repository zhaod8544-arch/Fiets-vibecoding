import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';

/**
 * 种子数据初始化服务
 *
 * 编译进 dist，生产环境无需 ts-node 即可运行。
 * 幂等：所有写入用 upsert / 存在性检查，可重复执行。
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 执行种子数据初始化（超级管理员 + 默认角色 + 系统菜单） */
  async run(): Promise<void> {
    this.logger.log('开始初始化种子数据...');

    const password = await bcrypt.hash('123456', 12);

    const admin = await this.prisma.sysUser.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password,
        name: '超级管理员',
        nickName: 'Admin',
        status: 1,
        passwordV: 1,
      },
    });

    const adminRole = await this.prisma.sysRole.upsert({
      where: { label: 'admin' },
      update: {},
      create: {
        name: '管理员',
        label: 'admin',
        remark: '系统默认管理员角色',
        relevance: 1,
        status: 1,
      },
    });

    await this.prisma.sysUserRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });

    await this.seedMenus();
    await this.seedPositions();

    this.logger.log('种子数据初始化完成，请登录后立即修改默认管理员密码');
  }
  // PART_2

  /** 初始化系统菜单（type: 0=目录 1=菜单 2=权限按钮）；已存在则跳过 */
  private async seedMenus(): Promise<void> {
    const existing = await this.prisma.sysMenu.count();
    if (existing > 0) {
      this.logger.log('菜单已存在，跳过菜单初始化');
      return;
    }

    // 组织管理
    const orgDir = await this.prisma.sysMenu.create({
      data: { name: '组织管理', type: 0, router: '/organization', icon: 'OfficeBuilding', orderNum: 1 },
    });
    await this.prisma.sysMenu.create({
      data: { name: '部门管理', type: 1, router: '/organization/department', perms: 'sys:department:list', orderNum: 1, parentId: orgDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '人员管理', type: 1, router: '/organization/user', perms: 'sys:user:list', orderNum: 2, parentId: orgDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '岗位管理', type: 1, router: '/organization/position', perms: 'sys:position:list', orderNum: 3, parentId: orgDir.id },
    });

    // 权限管理
    const permDir = await this.prisma.sysMenu.create({
      data: { name: '权限管理', type: 0, router: '/permission', icon: 'Lock', orderNum: 2 },
    });
    // 仅建目录与菜单（type 0/1）；按钮（type 2）由 PermsSyncService 启动时自动登记
    await this.prisma.sysMenu.create({
      data: { name: '角色管理', type: 1, router: '/permission/role', perms: 'sys:role:list', orderNum: 1, parentId: permDir.id },
    });
    await this.prisma.sysMenu.create({
      data: { name: '菜单管理', type: 1, router: '/permission/menu', perms: 'sys:menu:list', orderNum: 2, parentId: permDir.id },
    });

    this.logger.log('系统菜单已初始化（按钮权限由 PermsSyncService 自动登记）');
  }

  /** 初始化默认岗位数据（巡检员/维修工等）；已存在则跳过 */
  private async seedPositions(): Promise<void> {
    const existing = await this.prisma.sysPosition.count();
    if (existing > 0) {
      this.logger.log('岗位已存在，跳过岗位初始化');
      return;
    }

    await this.prisma.sysPosition.createMany({
      data: [
        { name: '巡检员', description: '负责日常设备巡检工作', orderNum: 1 },
        { name: '维修工', description: '负责设备维修保养工作', orderNum: 2 },
        { name: '安全员', description: '负责安全监督检查工作', orderNum: 3 },
        { name: '班组长', description: '负责班组日常管理工作', orderNum: 4 },
        { name: '部门经理', description: '负责部门整体管理工作', orderNum: 5 },
      ],
    });

    this.logger.log('默认岗位已初始化');
  }
}
