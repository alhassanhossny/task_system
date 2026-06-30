import { PrismaClient, CompanyPlan, CompanyStatus, Locale, SystemRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ids = {
  platformCompany: "00000000-0000-4000-8000-000000000001",
  advancedTech: "00000000-0000-4000-8000-000000000101",
  leadingGroup: "00000000-0000-4000-8000-000000000102",
  platformAdmin: "00000000-0000-4000-8000-000000001001",
  companyAdmin: "00000000-0000-4000-8000-000000001101",
  manager: "00000000-0000-4000-8000-000000001102",
  employee: "00000000-0000-4000-8000-000000001103",
  itDept: "00000000-0000-4000-8000-000000002101",
  hrDept: "00000000-0000-4000-8000-000000002102"
};

const permissionSeeds = [
  ["read", "companies", "Read companies"],
  ["write", "companies", "Create and update companies"],
  ["read", "users", "Read users"],
  ["write", "users", "Create and update users"],
  ["read", "roles", "Read roles"],
  ["write", "roles", "Create and update roles"],
  ["read", "departments", "Read departments"],
  ["write", "departments", "Create and update departments"],
  ["read", "audit_logs", "Read audit logs"],
  ["read", "activities", "Read activity feed"]
] as const;

const tenantRoleSeeds = [
  [SystemRole.COMPANY_ADMIN, "Company Admin", "Full tenant administration"],
  [SystemRole.MANAGER, "Manager", "Department and team management"],
  [SystemRole.EMPLOYEE, "Employee", "Employee self-service access"]
] as const;

async function seedCompany(company: {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  defaultLocale: Locale;
}) {
  await prisma.company.upsert({
    where: { id: company.id },
    update: company,
    create: company
  });
}

async function seedPermissions(companyId: string) {
  for (const [action, subject, description] of permissionSeeds) {
    await prisma.permission.upsert({
      where: { companyId_action_subject: { companyId, action, subject } },
      update: { description },
      create: { companyId, action, subject, description }
    });
  }
}

async function seedRoles(companyId: string, includeSuperAdmin: boolean) {
  const roles = includeSuperAdmin
    ? [[SystemRole.SUPER_ADMIN, "Super Admin", "Platform administration"] as const]
    : tenantRoleSeeds;

  for (const [systemName, name, description] of roles) {
    await prisma.role.upsert({
      where: { companyId_systemName: { companyId, systemName } },
      update: { name, description },
      create: { companyId, systemName, name, description }
    });
  }
}

async function linkRolePermissions(companyId: string) {
  const roles = await prisma.role.findMany({ where: { companyId } });
  const permissions = await prisma.permission.findMany({ where: { companyId } });

  for (const role of roles) {
    const allowed = permissions.filter((permission) => {
      if (role.systemName === SystemRole.SUPER_ADMIN || role.systemName === SystemRole.COMPANY_ADMIN) {
        return true;
      }

      if (role.systemName === SystemRole.MANAGER) {
        return permission.action === "read" || ["users", "departments", "activities"].includes(permission.subject);
      }

      return permission.action === "read" && ["users", "departments", "activities"].includes(permission.subject);
    });

    for (const permission of allowed) {
      await prisma.rolePermission.upsert({
        where: {
          companyId_roleId_permissionId: {
            companyId,
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: { companyId, roleId: role.id, permissionId: permission.id }
      });
    }
  }
}

async function assignRole(companyId: string, userId: string, systemName: SystemRole) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { companyId_systemName: { companyId, systemName } }
  });

  await prisma.userRole.upsert({
    where: { companyId_userId_roleId: { companyId, userId, roleId: role.id } },
    update: {},
    create: { companyId, userId, roleId: role.id }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await seedCompany({
    id: ids.platformCompany,
    name: "TASK Flow Platform",
    slug: "taskflow-platform",
    plan: CompanyPlan.ENTERPRISE,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.EN
  });

  await seedCompany({
    id: ids.advancedTech,
    name: "شركة التقنية المتقدمة",
    slug: "advanced-tech",
    plan: CompanyPlan.ENTERPRISE,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.AR
  });

  await seedCompany({
    id: ids.leadingGroup,
    name: "مجموعة الأعمال الرائدة",
    slug: "leading-business-group",
    plan: CompanyPlan.PROFESSIONAL,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.AR
  });

  for (const companyId of [ids.platformCompany, ids.advancedTech, ids.leadingGroup]) {
    await seedPermissions(companyId);
    await seedRoles(companyId, companyId === ids.platformCompany);
  }

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.platformCompany, email: "super@taskflow.local" } },
    update: { name: "Platform Super Admin", passwordHash, status: UserStatus.ACTIVE },
    create: {
      id: ids.platformAdmin,
      companyId: ids.platformCompany,
      email: "super@taskflow.local",
      passwordHash,
      name: "Platform Super Admin",
      jobTitle: "Super Admin",
      locale: Locale.EN,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "admin@company.com" } },
    update: { name: "أحمد محمد العلي", passwordHash, status: UserStatus.ACTIVE },
    create: {
      id: ids.companyAdmin,
      companyId: ids.advancedTech,
      email: "admin@company.com",
      passwordHash,
      name: "أحمد محمد العلي",
      jobTitle: "مدير الشركة",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "sara@company.com" } },
    update: { name: "سارة خالد الفارسي", passwordHash, status: UserStatus.ACTIVE },
    create: {
      id: ids.manager,
      companyId: ids.advancedTech,
      email: "sara@company.com",
      passwordHash,
      name: "سارة خالد الفارسي",
      jobTitle: "مدير الموارد البشرية",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "mohammed@company.com" } },
    update: { name: "محمد عبدالله الحربي", passwordHash, status: UserStatus.ACTIVE },
    create: {
      id: ids.employee,
      companyId: ids.advancedTech,
      email: "mohammed@company.com",
      passwordHash,
      name: "محمد عبدالله الحربي",
      jobTitle: "موظف مبيعات",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.department.upsert({
    where: { companyId_code: { companyId: ids.advancedTech, code: "IT" } },
    update: { managerId: ids.companyAdmin, name: "تقنية المعلومات" },
    create: {
      id: ids.itDept,
      companyId: ids.advancedTech,
      managerId: ids.companyAdmin,
      name: "تقنية المعلومات",
      code: "IT"
    }
  });

  await prisma.department.upsert({
    where: { companyId_code: { companyId: ids.advancedTech, code: "HR" } },
    update: { managerId: ids.manager, name: "الموارد البشرية" },
    create: {
      id: ids.hrDept,
      companyId: ids.advancedTech,
      managerId: ids.manager,
      name: "الموارد البشرية",
      code: "HR"
    }
  });

  await prisma.user.update({ where: { id: ids.companyAdmin }, data: { departmentId: ids.itDept } });
  await prisma.user.update({ where: { id: ids.manager }, data: { departmentId: ids.hrDept } });
  await prisma.user.update({ where: { id: ids.employee }, data: { departmentId: ids.hrDept } });

  await assignRole(ids.platformCompany, ids.platformAdmin, SystemRole.SUPER_ADMIN);
  await assignRole(ids.advancedTech, ids.companyAdmin, SystemRole.COMPANY_ADMIN);
  await assignRole(ids.advancedTech, ids.manager, SystemRole.MANAGER);
  await assignRole(ids.advancedTech, ids.employee, SystemRole.EMPLOYEE);

  for (const companyId of [ids.platformCompany, ids.advancedTech, ids.leadingGroup]) {
    await linkRolePermissions(companyId);
  }

  await prisma.auditLog.create({
    data: {
      companyId: ids.advancedTech,
      actorId: ids.companyAdmin,
      action: "seed.phase1",
      entityType: "system",
      metadata: { source: "prisma/seed.ts", phase: "foundation" }
    }
  });

  await prisma.activity.createMany({
    data: [
      {
        companyId: ids.advancedTech,
        actorId: ids.companyAdmin,
        type: "user.login",
        title: "Company admin account created",
        titleAr: "تم إنشاء حساب مدير الشركة",
        metadata: { email: "admin@company.com" }
      },
      {
        companyId: ids.advancedTech,
        actorId: ids.manager,
        type: "department.ready",
        title: "HR department configured",
        titleAr: "تم إعداد قسم الموارد البشرية",
        metadata: { code: "HR" }
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
